import { PRESENTATION_VERSION, SYSTEM_IDS, attributeSummary } from '@torchline/contracts';
import type { WorldPresentation } from '@torchline/contracts';
import { getPuzzle, previewChoices, titles } from '@torchline/engine';
import { normalizeAllocation } from '@torchline/engine';
import { livewireUnresolved } from '@torchline/engine';
import type { StoredWorld } from '@torchline/storage';

export function presentWorld(world: StoredWorld, hostControls = false): WorldPresentation {
  const s = world.state;
  const labels = world.labels ?? {};
  const publicEvents = world.events
    .filter((event) => !['vote', 'allocate', 'inspect'].includes(event.command.type))
    .slice(-30)
    .map((event) => ({
      ...event,
      summary: attributeSummary(
        event.summary,
        event.actor.community,
        labels[event.actor.community],
      ),
    }));
  const last = publicEvents.at(-1);
  const votes: Record<string, number> = {};
  for (const option of Object.values(s.votes)) votes[option] = (votes[option] ?? 0) + 1;
  const enabled =
    hostControls && !world.frozen_by && !world.input_suspended && !livewireUnresolved(s);
  return {
    schemaVersion: PRESENTATION_VERSION,
    worldId: s.id,
    worldVersion: world.revision,
    gameVersion: s.version,
    rulesVersion: s.rulesVersion,
    mode: world.mode,
    host: world.label,
    handoffPending: Boolean(world.frozen_by),
    chapter: s.chapter,
    phase: s.phase,
    title: s.crisis === 'safe-corridor' ? 'The Safe Corridor' : titles(s.rulesVersion)[s.chapter],
    recap:
      last?.summary ?? '216 passengers. Five chapters. One world that persists between broadcasts.',
    resources: s.resources,
    systems: SYSTEM_IDS.map((id) => ({
      ...s.systems[id],
      marks: s.systems[id].marks.map((mark) => ({
        ...mark,
        community: labels[mark.community] ?? mark.community,
      })),
      severity:
        s.systems[id].integrity === 0
          ? 'lost'
          : s.systems[id].integrity <= 25
            ? 'critical'
            : s.systems[id].integrity < 60
              ? 'compromised'
              : 'stable',
    })),
    obligations: s.obligations,
    challenge: getPuzzle(s),
    choices: ['awaiting-commit', 'allocation', 'decision', 'challenge'].includes(s.phase)
      ? previewChoices(s)
      : [],
    votes,
    participantCount: new Set([
      ...Object.keys(s.votes),
      ...Object.values(s.challenge.contributions),
      ...Object.keys(s.cooperation?.inspections ?? {}),
      ...Object.keys(s.cooperation?.preferences ?? {}),
    ]).size,
    ...(s.cooperation
      ? {
          cooperation: {
            budget: s.cooperation.budget,
            investigation: s.cooperation.investigation,
            inspections: Object.fromEntries(
              ['engine', 'cargo', 'life'].map((area) => [
                area,
                Object.values(s.cooperation!.inspections).filter((v) => v === area).length,
              ]),
            ),
            allocations: Object.keys(s.cooperation.preferences).length,
            plan: s.cooperation.closedByEventId
              ? s.cooperation.plan
              : normalizeAllocation(s.cooperation.preferences, s.cooperation.budget),
            closed: Boolean(s.cooperation.closedByEventId),
          },
        }
      : {}),
    ...(world.clock
      ? {
          clock: {
            durations: world.clock.durations,
            deadlineAt: world.clock.deadline_at?.toISOString() ?? null,
            remainingMs: world.clock.remaining_ms,
            serverAt: new Date().toISOString(),
            recoveryReason: world.clock.recovery_reason,
          },
        }
      : {}),
    outcome: s.outcome,
    endingReason: s.endingReason,
    events: publicEvents.map(({ id, chapter, summary, resourceDelta, cues, causes }) => ({
      id,
      chapter,
      summary,
      resourceDelta,
      cues,
      causes,
    })),
    capabilities: {
      canStart: enabled && s.phase === 'ready',
      canCloseChallenge: enabled && s.phase === 'challenge',
      canCommit: enabled && ['decision', 'awaiting-commit'].includes(s.phase),
      canCloseInvestigation: enabled && s.phase === 'investigation',
      canCloseAllocation: enabled && s.phase === 'allocation',
      canCloseVoting: enabled && s.rulesVersion === 'ark-v3' && s.phase === 'decision',
      canPause: enabled && !['ended', 'paused'].includes(s.phase),
      canResume: enabled && s.phase === 'paused',
    },
  };
}
