import { useEffect, useRef, useState } from 'react';
import type { WorldPresentation } from '@torchline/contracts';

export const encounterNames = [
  'Departure bay',
  'Radiation front',
  'Vesper Shoals',
  'Life-support emergency',
  'Derelict field',
  'Colony approach',
];
export const encounterObjectives = [
  'Launch the first chapter',
  'Reroute the shields',
  'Find a safe trajectory',
  'Contain the life-support breach',
  'Recover the drifting cargo',
  'Thread the landing corridor',
];

/** Presentation only. Arrival, damage and rewards always come from canonical events. */
export function EncounterLayer({
  world,
  readonly,
}: {
  world: WorldPresentation;
  readonly: boolean;
}) {
  const previous = useRef({ id: world.worldId, chapter: world.chapter });
  const [arrival, setArrival] = useState<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { id: world.worldId, chapter: world.chapter };
    if (before.id !== world.worldId || before.chapter === world.chapter || world.chapter === 0) {
      setArrival(null);
      return;
    }
    setArrival(world.chapter);
    const timer = setTimeout(() => setArrival(null), 4200);
    return () => clearTimeout(timer);
  }, [world.worldId, world.chapter]);
  return (
    <>
      <div
        className={`encounter-atmosphere encounter-${world.chapter} ${world.resources.hull <= 25 ? 'hull-alert' : ''}`}
        aria-hidden="true"
      >
        <div className="encounter-horizon" />
        <div className="encounter-dust" />
        <div className="encounter-sweep" />
        <div className="encounter-orbit orbit-one" />
        <div className="encounter-orbit orbit-two" />
      </div>
      {arrival !== null && (
        <section
          className="encounter-transmission"
          aria-label="Sector arrival"
          aria-live="polite"
          key={`${world.worldId}:${arrival}`}
        >
          <span>INCOMING TRANSMISSION / CHAPTER {String(arrival).padStart(2, '0')}</span>
          <h2>{world.title}</h2>
          <p>{encounterObjectives[arrival]}</p>
          {!readonly && <button onClick={() => setArrival(null)}>Dismiss transmission</button>}
        </section>
      )}
    </>
  );
}

export function SectorLocator({ chapter }: { chapter: number }) {
  return (
    <div className="sector-locator" aria-label={`Current sector: ${encounterNames[chapter]}`}>
      <span className="locator-cross" aria-hidden="true">
        ⌖
      </span>
      <span>
        SECTOR {String(chapter).padStart(2, '0')}
        <b>{encounterNames[chapter]}</b>
      </span>
      <i aria-hidden="true" />
    </div>
  );
}

export function CrewUplink({ world }: { world: WorldPresentation }) {
  const [copied, setCopied] = useState(false);
  const workOrder = world.challenge?.kind === 'work-order';
  const nextRelay = world.challenge?.nodes.find(
    (n) => !['S', 'T'].includes(n.id) && (!workOrder || n.id !== 'D') && !n.revealed,
  );
  const nextPatch = workOrder
    ? world.challenge?.nodes.find(
        (n) =>
          ['A', 'B', 'C'].includes(n.id) &&
          n.revealed &&
          !n.patched &&
          (n.id !== 'C' ||
            world.challenge?.nodes
              .filter((p) => ['A', 'B'].includes(p.id))
              .every((p) => p.patched)),
      )
    : undefined;
  const accepting =
    ['investigation', 'challenge', 'allocation', 'decision'].includes(world.phase) &&
    !world.handoffPending &&
    !world.outcome;
  const command = !accepting
    ? '!status'
    : world.phase === 'investigation'
      ? '!inspect life'
      : world.phase === 'allocation'
        ? '!allocate 3 2'
        : world.phase === 'decision'
          ? '!vote 1'
          : world.phase === 'challenge'
            ? nextPatch
              ? `!patch ${nextPatch.id}`
              : nextRelay
                ? `!scan ${nextRelay.id}`
                : '!status'
            : '!status';
  const liveChannel =
    world.mode === 'live' && /^[a-z\d_]{1,25}$/i.test(world.host) ? world.host : null;
  useEffect(() => {
    setCopied(false);
  }, [command]);
  return (
    <section className="crew-uplink" aria-label="How to join the crew">
      <div>
        <span className="uplink-status" aria-hidden="true" />
        <span>
          {liveChannel
            ? 'YOUR CREW PLAYS IN TWITCH CHAT'
            : 'YOU ARE THE CAPTAIN · SAVED SIMULATION'}
        </span>
      </div>
      <p>
        {liveChannel
          ? `Open ${world.host}’s chat. ${accepting ? 'Cooperate using the mission commands and watch the Ark respond.' : 'Ask for status while the captain prepares the next step.'}`
          : 'Use the mission controls, or open Simulation chat to rehearse viewer commands.'}
      </p>
      <div className="uplink-actions">
        {liveChannel && (
          <a
            href={`https://www.twitch.tv/popout/${encodeURIComponent(liveChannel)}/chat`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Twitch chat ↗
          </a>
        )}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          aria-label={`Copy command ${command}`}
        >
          {copied ? 'COPIED' : command}
          <small>{copied ? 'PASTE IN CHAT' : 'COPY COMMAND'}</small>
        </button>
      </div>
    </section>
  );
}
