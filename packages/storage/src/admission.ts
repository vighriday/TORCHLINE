import type { PoolClient } from 'pg';

// Operational backpressure, never engine rules or a claim of supported audience size.
export interface InputPolicy {
  viewerBurst: number;
  viewerPerSecond: number;
  worldBurst: number;
  worldPerSecond: number;
  maxPending: number;
}
export const DEFAULT_INPUT_POLICY: Readonly<InputPolicy> = Object.freeze({
  viewerBurst: 6,
  viewerPerSecond: 1,
  worldBurst: 60,
  worldPerSecond: 30,
  maxPending: 128,
});
export function inputPolicy(env: NodeJS.ProcessEnv): InputPolicy {
  const read = (name: string, fallback: number, max: number, integer = false) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw new Error(`Invalid ${name}.`);
    return value;
  };
  return {
    viewerBurst: read('INPUT_VIEWER_BURST', 6, 100, true),
    viewerPerSecond: read('INPUT_VIEWER_PER_SECOND', 1, 100),
    worldBurst: read('INPUT_WORLD_BURST', 60, 10000, true),
    worldPerSecond: read('INPUT_WORLD_PER_SECOND', 30, 10000),
    maxPending: read('INPUT_MAX_PENDING', 128, 10000, true),
  };
}
export async function admitInput(
  c: PoolClient,
  world: string,
  window: number,
  participant: string,
  at: Date,
  policy: InputPolicy,
) {
  // Caller owns channel -> world locks, so parallel callbacks/processes share one budget.
  const pending = (
    await c.query(
      "SELECT count(*)::integer AS count FROM eventsub_inbox WHERE processed_at IS NULL AND payload->>'kind'='chat' AND payload->>'worldId'=$1",
      [world],
    )
  ).rows[0].count;
  if (pending >= policy.maxPending) return 'INPUT_BACKLOG' as const;
  const budgets = [
    ['world', policy.worldBurst, policy.worldPerSecond],
    ['viewer:' + participant, policy.viewerBurst, policy.viewerPerSecond],
  ] as const;
  const remaining: number[] = [];
  for (const [subject, burst, rate] of budgets) {
    const row = (
      await c.query(
        'SELECT tokens,observed_at FROM input_limits WHERE world_id=$1 AND input_window=$2 AND subject=$3',
        [world, window, subject],
      )
    ).rows[0];
    const available = row
      ? Math.min(
          burst,
          Number(row.tokens) +
            Math.max(0, (at.getTime() - row.observed_at.getTime()) / 1000) * rate,
        )
      : burst;
    if (available < 1) return 'INPUT_RATE_LIMITED' as const;
    remaining.push(available - 1);
  }
  for (let i = 0; i < budgets.length; i++)
    await c.query(
      'INSERT INTO input_limits(world_id,input_window,subject,tokens,observed_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(world_id,input_window,subject) DO UPDATE SET tokens=EXCLUDED.tokens,observed_at=EXCLUDED.observed_at',
      [world, window, budgets[i][0], remaining[i], at],
    );
  return null;
}
