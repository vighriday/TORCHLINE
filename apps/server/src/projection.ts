import { PRESENTATION_VERSION, SYSTEM_IDS } from '@torchline/contracts';
import type { WorldPresentation } from '@torchline/contracts';
import { getPuzzle, previewChoices, TITLES } from '@torchline/engine';
import type { StoredWorld } from '@torchline/storage';

export function presentWorld(world: StoredWorld, hostControls = false): WorldPresentation {
  const s = world.state;
  const publicEvents = world.events.filter((event) => event.command.type !== 'vote').slice(-30);
  const last = publicEvents.at(-1);
  const votes: Record<string, number> = {};
  for (const option of Object.values(s.votes)) votes[option] = (votes[option] ?? 0) + 1;
  const enabled = hostControls && !world.frozen_by;
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
    title: s.crisis === 'safe-corridor' ? 'The Safe Corridor' : TITLES[s.chapter],
    recap:
      last?.summary ?? '216 passengers. Five chapters. One world that persists between broadcasts.',
    resources: s.resources,
    systems: SYSTEM_IDS.map((id) => ({
      ...s.systems[id],
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
    choices: s.phase === 'decision' || s.phase === 'challenge' ? previewChoices(s) : [],
    votes,
    participantCount: new Set([
      ...Object.keys(s.votes),
      ...Object.values(s.challenge.contributions),
    ]).size,
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
      canCommit: enabled && s.phase === 'decision',
      canPause: enabled && !['ended', 'paused'].includes(s.phase),
      canResume: enabled && s.phase === 'paused',
    },
  };
}
