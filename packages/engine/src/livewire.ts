import { DomainError, LIVEWIRE_VERSION, LivewireCommandSchema } from '@torchline/contracts';
import type {
  Actor,
  LivewireCommand,
  LivewireOption,
  WorldEvent,
  WorldState,
} from '@torchline/contracts';

function fail(code: string, message: string): never {
  throw new DomainError(code, message);
}
export function livewireUnresolved(s: WorldState) {
  return !!s.livewire && ['open', 'paused', 'locked'].includes(s.livewire.stake.status);
}
export function livewireOptions(s: WorldState): LivewireOption[] {
  return (['navigation', 'hull', 'oxygen'] as const).flatMap((target) => {
    const part = s.systems[target === 'oxygen' ? 'lifeSupport' : target];
    if (
      part.integrity <= 0 ||
      ['destroyed', 'sealed'].includes(part.condition) ||
      s.resources[target] <= 0
    )
      return [];
    return [
      {
        target,
        success: Math.min(3, 100 - s.resources[target]),
        failure: -Math.min(6, s.resources[target] - 1),
      },
    ];
  });
}
export function applyLivewire(
  previous: WorldState,
  raw: LivewireCommand,
  actor: Actor,
  context: { commandId: string; at: string },
): { state: WorldState; event: WorldEvent } {
  const command = LivewireCommandSchema.parse(raw);
  if (previous.rulesVersion !== 'ark-v3')
    fail('RULES_VERSION', 'LIVEWIRE v0 requires ark-v3; historical worlds are unchanged.');
  if (actor.role !== 'host' || !actor.id || !actor.community)
    fail('HOST_REQUIRED', 'Only the current captain controls missions.');
  if (
    previous.phase !== 'ready' ||
    previous.chapter >= 5 ||
    previous.outcome ||
    previous.resources.hull <= 0 ||
    previous.resources.oxygen <= 0 ||
    previous.resources.passengers <= 0
  )
    fail('INVALID_PHASE', 'Missions run only between playable chapters.');
  const now = Date.parse(context.at);
  if (!Number.isFinite(now)) fail('INVALID_TIME', 'A valid persisted timestamp is required.');
  const s = structuredClone(previous);
  const id = `${s.id}:${s.version + 1}`;
  const cues: WorldEvent['cues'] = [];
  let summary = '';
  const causes: string[] = [];
  if (command.type === 'livewire-open') {
    if (livewireUnresolved(s))
      fail('LIVEWIRE_PENDING', 'Resolve or cancel the existing mission first.');
    if (s.livewire?.spentChapters.includes(s.chapter))
      fail('CHARGE_SPENT', 'This chapter boundary already used its mission allowance.');
    if (s.resources.supplies < 1)
      fail('INSUFFICIENT_RESOURCES', 'Opening a mission consumes one supply.');
    const options = livewireOptions(s);
    if (!options.length) fail('NO_TARGET', 'No repairable system is available.');
    s.resources.supplies -= 1;
    s.livewire = {
      policy: LIVEWIRE_VERSION,
      spentChapters: [...(s.livewire?.spentChapters ?? []), s.chapter],
      stake: {
        id: command.stakeId,
        policy: LIVEWIRE_VERSION,
        channel: actor.community,
        author: actor.id,
        chapter: s.chapter,
        game: command.game,
        label: command.label,
        preset: command.preset,
        status: 'open',
        openedAt: context.at,
        deadlineAt: new Date(now + 45000).toISOString(),
        remainingMs: null,
        pauseReason: null,
        openedVersion: s.version,
        options,
      },
    };
    summary = `LIVEWIRE mission opened: ${command.label} (${command.game}). One supply and this boundary's allowance committed.`;
  } else {
    const stake = s.livewire?.stake;
    if (!stake || stake.id !== command.stakeId)
      fail('STAKE_MISMATCH', 'This is not the current mission.');
    if (stake.channel !== actor.community)
      fail('FORBIDDEN', 'The mission belongs to its opening channel.');
    const elapsed = stake.deadlineAt !== null && now >= Date.parse(stake.deadlineAt);
    if (command.type === 'livewire-lock') {
      if (stake.status !== 'open' || elapsed)
        fail('WINDOW_CLOSED', 'The selection window has closed. No attempt was committed.');
      const total = command.tallies.reduce((a, b) => a + b, 0);
      if (total > 10000) fail('BALLOT_LIMIT', 'Mission participation is bounded.');
      const targets = ['navigation', 'hull', 'oxygen'] as const;
      if (
        command.tallies.some((n, i) => n > 0 && !stake.options.some((o) => o.target === targets[i]))
      )
        fail('INVALID_OPTION', 'Unavailable systems cannot receive ballots.');
      let target = command.solo;
      if (total) {
        if (command.solo) fail('CREW_SELECTION', 'Solo selection cannot override crew ballots.');
        target = targets[command.tallies.indexOf(Math.max(...command.tallies))];
      }
      if (!target || !stake.options.some((o) => o.target === target))
        fail('SOLO_REQUIRED', 'With no votes, explicitly choose a solo system.');
      stake.target = target;
      stake.tallies = command.tallies;
      stake.selection = total ? 'crew' : 'solo';
      stake.evidence = command.evidence;
      stake.status = 'locked';
      stake.lockedAt = context.at;
      stake.lockedVersion = s.version;
      stake.lockEventId = id;
      stake.deadlineAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
      summary = `LIVEWIRE locked ${target} before the attempt. ${total ? `${total} crew ballots` : 'Explicit solo selection'}; result will be streamer-attested.`;
    } else if (command.type === 'livewire-resolve') {
      if (stake.status !== 'locked' || elapsed)
        fail('WINDOW_CLOSED', 'Only an unexpired locked mission can be attested.');
      const option = stake.options.find((o) => o.target === stake.target)!;
      const delta = option[command.outcome];
      s.resources[option.target] += delta;
      const system = s.systems[option.target === 'oxygen' ? 'lifeSupport' : option.target];
      if (delta !== 0) {
        system.integrity = Math.max(1, Math.min(100, system.integrity + delta));
        system.condition = delta > 0 ? 'repaired' : 'damaged';
        system.lastEventId = id;
        system.marks.push({
          kind: delta > 0 ? 'repair' : 'damage',
          eventId: id,
          chapter: s.chapter,
          community: actor.community,
        });
        cues.push({ kind: delta > 0 ? 'repair' : 'damage', systemId: system.id, eventId: id });
      }
      stake.status = command.outcome;
      stake.resolvedAt = context.at;
      stake.deadlineAt = null;
      causes.push(stake.lockEventId!);
      summary = `Streamer-attested ${command.outcome}: ${stake.label} (${stake.game}). ${option.target} ${delta >= 0 ? '+' : ''}${delta}; the Ark keeps this consequence.`;
    } else if (command.type === 'livewire-cancel') {
      if (!['open', 'paused', 'locked'].includes(stake.status))
        fail('STAKE_CLOSED', 'This mission is already final.');
      stake.status = 'cancelled';
      stake.deadlineAt = null;
      stake.remainingMs = null;
      summary =
        'LIVEWIRE cancelled. No result applied; the supply and mission allowance remain spent.';
    } else if (command.type === 'livewire-expire') {
      if (!['open', 'locked'].includes(stake.status) || !elapsed)
        fail('NOT_DUE', 'Mission expiry is not due.');
      stake.status = 'expired';
      stake.deadlineAt = null;
      summary =
        'LIVEWIRE expired without a result. No repair or damage applied; the allowance remains spent.';
    } else if (command.type === 'livewire-pause') {
      if (stake.status !== 'open') fail('INVALID_PHASE', 'Only selection can be paused.');
      stake.remainingMs = Math.max(0, Date.parse(stake.deadlineAt!) - now);
      stake.deadlineAt = null;
      stake.status = 'paused';
      stake.pauseReason = command.reason;
      summary = 'LIVEWIRE selection paused. Captain must explicitly resume after recovery.';
    } else if (command.type === 'livewire-resume') {
      if (stake.status !== 'paused' || !stake.remainingMs)
        fail('WINDOW_CLOSED', 'No remaining selection time. Cancel this mission.');
      stake.status = 'open';
      stake.windowOpenedAt = context.at;
      stake.deadlineAt = new Date(now + stake.remainingMs).toISOString();
      stake.remainingMs = null;
      stake.pauseReason = null;
      summary = 'LIVEWIRE selection resumed with its saved remaining time.';
    }
  }
  s.version++;
  return {
    state: s,
    event: {
      id,
      worldId: s.id,
      sequence: s.version,
      rulesVersion: s.rulesVersion,
      extensionVersion: LIVEWIRE_VERSION,
      evidence: command.type === 'livewire-resolve' ? 'streamer_attested' : 'host_control',
      commandId: context.commandId,
      command,
      actor: structuredClone(actor),
      at: context.at,
      chapter: s.chapter,
      summary,
      resourceDelta: Object.fromEntries(
        Object.entries(s.resources)
          .filter(([key, value]) => value !== previous.resources[key as keyof typeof s.resources])
          .map(([key, value]) => [
            key,
            value - previous.resources[key as keyof typeof s.resources],
          ]),
      ),
      cues,
      causes,
    },
  };
}
