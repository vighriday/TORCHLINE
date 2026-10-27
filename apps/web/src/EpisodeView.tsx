import { useEffect, useMemo, useState } from 'react';
import type { Command, WorldPresentation } from '@torchline/contracts';
export function PhaseClock({
  world,
  compact = false,
}: {
  world: WorldPresentation;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const offset = useMemo(
    () => Date.now() - Date.parse(world.clock?.serverAt ?? new Date().toISOString()),
    [world.clock?.serverAt],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!world.clock) return null;
  const ms = world.clock.deadlineAt
    ? Math.max(0, Date.parse(world.clock.deadlineAt) - (now - offset))
    : world.clock.remainingMs;
  return (
    <div className={`phase-clock ${compact ? 'compact-clock' : ''}`}>
      {!compact && <span className="eyebrow">EPISODE WINDOW</span>}
      <strong role="timer">
        {ms == null
          ? world.phase === 'awaiting-commit'
            ? 'Awaiting captain'
            : 'Manual timing'
          : `${Math.ceil(ms / 1000)}s ${world.phase === 'paused' ? 'remaining · paused' : 'remaining'}`}
      </strong>
      {!compact && (
        <small>
          {world.clock.recoveryReason ??
            (world.clock.deadlineAt
              ? 'Server deadline closes participation. The captain commits the story.'
              : 'Progress is saved. No offline resource drain.')}
        </small>
      )}
    </div>
  );
}
export function CooperationView({
  world,
  compact = false,
}: {
  world: WorldPresentation;
  compact?: boolean;
}) {
  const co = world.cooperation;
  if (!co || !['investigation', 'allocation', 'decision', 'awaiting-commit'].includes(world.phase))
    return null;
  if (['decision', 'awaiting-commit'].includes(world.phase) && !co.budget) return null;
  if (compact)
    return (
      <section className="compact-cooperation">
        <h3>
          {world.phase === 'investigation'
            ? 'Choose where the crew investigates'
            : world.phase === 'allocation'
              ? 'Distribute the repair reserve'
              : 'Crew plan secured'}
        </h3>
        {world.phase === 'investigation' ? (
          <p>
            {Object.entries(co.inspections)
              .map(([area, count]) => `${area}: ${count}`)
              .join(' · ')}
          </p>
        ) : (
          <p>
            {co.budget} power reserve · +{co.plan.hull} hull / +{co.plan.oxygen * 2} oxygen ·{' '}
            {co.allocations} crew preferences{co.closed ? ' · locked' : ''}
          </p>
        )}
      </section>
    );
  return (
    <section className="panel cooperation-panel">
      <span className="eyebrow">CREW OPERATIONS</span>
      <h3>
        {world.phase === 'investigation'
          ? 'Choose where the crew investigates'
          : world.phase === 'allocation'
            ? 'Distribute the repair reserve'
            : 'Crew plan secured'}
      </h3>
      {world.phase === 'investigation' ? (
        <>
          <p>
            Prioritize a shared clue: engine reveals a route requirement, life an unsafe relay,
            cargo a general clue. In a repair work order these reveal B, C and A.
          </p>
          <div className="command-strip">
            {['engine', 'cargo', 'life'].map((area) => (
              <code key={area}>
                !inspect {area} · {co.inspections[area] ?? 0}
              </code>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>
            Reserve: <strong>{co.budget} power</strong>. Plan:{' '}
            <strong>
              {co.plan.hull} hull repairs · {co.plan.oxygen} oxygen units
            </strong>{' '}
            (+{co.plan.oxygen * 2} oxygen).{' '}
            {co.closed
              ? 'Plan is locked.'
              : 'Latest account preference counts; audience size cannot increase the reserve.'}
          </p>
          {world.phase === 'allocation' && (
            <p>
              <code>!allocate 3 2</code> assigns three hull and two oxygen preference points. Use
              1–5 points total. {co.allocations} crew preferences received.
            </p>
          )}
          <small>
            Applied with the captain’s choice. Only useful repairs cost power. Recovering oxygen
            does not repair a leak.
          </small>
        </>
      )}
    </section>
  );
}
export function EpisodeSettings({
  world,
  busy,
  onCommand,
  onTiming,
}: {
  world: WorldPresentation;
  busy: boolean;
  onCommand: (c: Command) => void;
  onTiming: (
    d: Record<'investigation' | 'challenge' | 'allocation' | 'decision', number | null>,
  ) => void;
}) {
  const [budget, setBudget] = useState(world.cooperation?.budget ?? 0);
  const [investigation, setInvestigation] = useState(world.cooperation?.investigation ?? false);
  const [timed, setTimed] = useState(true);
  if (!world.cooperation || !world.capabilities.canStart) return null;
  return (
    <section className="panel episode-settings">
      <span className="eyebrow">PREPARE YOUR NEXT CHAPTER</span>
      <h3>Crew agency & pacing</h3>
      <p>
        Declare a power reserve before the crew allocates repairs. Start at zero to keep all power
        for authored choices. This reserve resets each chapter.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCommand({ type: 'configure-cooperation', budget, investigation });
        }}
      >
        <label>
          Repair reserve (0–10 power)
          <input
            type="number"
            min="0"
            max={Math.min(10, world.resources.power)}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={investigation}
            onChange={(e) => setInvestigation(e.target.checked)}
          />
          Investigate a shared clue before the challenge
        </label>
        <button disabled={busy}>Save crew settings</button>
      </form>
      <p>
        Current reserve: {world.cooperation.budget} power · investigation{' '}
        {world.cooperation.investigation ? 'enabled' : 'disabled'}.
      </p>
      <div className="buttons">
        <label>
          Next chapter timing
          <select
            value={timed ? 'timed' : 'manual'}
            onChange={(e) => setTimed(e.target.value === 'timed')}
          >
            <option value="timed">Timed · 30s / 90s / 45s / 60s</option>
            <option value="manual">Manual · captain closes each window</option>
          </select>
        </label>
        <button
          disabled={busy}
          onClick={() =>
            onTiming({
              investigation: timed ? 30 : null,
              challenge: timed ? 90 : null,
              allocation: timed ? 45 : null,
              decision: timed ? 60 : null,
            })
          }
        >
          Save timing
        </button>
      </div>
      <small>
        Order: investigation, challenge, allocation, vote. Closing a phase early is always
        available. Story choices never commit automatically.
      </small>
    </section>
  );
}
