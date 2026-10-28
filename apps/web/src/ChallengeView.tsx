import { useState } from 'react';
import type { Command, PuzzleGraph } from '@torchline/contracts';
export interface ChallengeRendererProps {
  challenge: PuzzleGraph;
  interactive: boolean;
  onCommand: (command: Command) => void;
  busy: boolean;
  compact?: boolean;
  hud?: boolean;
  displayTitle?: string;
}
const positions: Record<string, [number, number]> = {
  S: [40, 115],
  A: [200, 50],
  B: [200, 180],
  C: [410, 50],
  D: [410, 180],
  T: [570, 115],
};
export function ChallengeView({
  challenge,
  interactive,
  onCommand,
  busy,
  compact = false,
  hud = false,
  displayTitle,
}: ChallengeRendererProps) {
  const [route, setRoute] = useState('');
  return (
    <section
      className={`panel challenge-panel ${compact ? 'compact-challenge' : ''} ${hud ? 'hud-challenge' : ''}`}
      aria-label="Cooperative challenge"
      data-kind={challenge.kind}
    >
      <div className="section-heading">
        <h2>{displayTitle ?? challenge.title}</h2>
        <span className="badge">
          {challenge.solved ? 'Solved · reward persisted' : 'Cooperation open'}
        </span>
      </div>
      <p className="challenge-prompt">{challenge.prompt}</p>
      <p className="reward">
        {hud ? 'SUCCESS → ' : 'Mechanical reward: '}
        {challenge.reward}
      </p>
      {challenge.kind === 'route' && (
        <>
          <div className="constraint-row">
            <span>Signal budget: {challenge.budget}</span>
            <span>Required: {challenge.requiredNode ?? 'scan to discover'}</span>
            <span>Unsafe: {challenge.blockedNode ?? 'scan to discover'}</span>
          </div>
          {hud && interactive && (
            <p className="relay-hint">SELECT A RELAY TO DISCOVER ITS SIGNAL</p>
          )}
          <svg viewBox="0 0 610 230" role="group" aria-label="Relay connections and signal costs">
            {challenge.edges.map((e) => {
              const a = positions[e.from],
                b = positions[e.to];
              return (
                <g
                  key={e.from + e.to}
                  className={
                    challenge.solved
                      ? 'signal-solved'
                      : challenge.scanned.includes(e.from) || challenge.scanned.includes(e.to)
                        ? 'signal-discovered'
                        : ''
                  }
                >
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                  <text className="edge-cost" x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 5}>
                    {e.cost}
                  </text>
                </g>
              );
            })}
            {challenge.nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${positions[n.id][0]} ${positions[n.id][1]})`}
                role={
                  interactive && !['S', 'T'].includes(n.id) && !n.revealed ? 'button' : undefined
                }
                tabIndex={interactive && !['S', 'T'].includes(n.id) && !n.revealed ? 0 : undefined}
                aria-label={`Scan relay ${n.id}`}
                aria-disabled={busy || undefined}
                onClick={() => {
                  if (interactive && !busy && !['S', 'T'].includes(n.id) && !n.revealed)
                    onCommand({ type: 'scan', node: n.id as 'A' });
                }}
                onKeyDown={(e) => {
                  if (
                    (e.key === 'Enter' || e.key === ' ') &&
                    interactive &&
                    !busy &&
                    !['S', 'T'].includes(n.id) &&
                    !n.revealed
                  ) {
                    e.preventDefault();
                    onCommand({ type: 'scan', node: n.id as 'A' });
                  }
                }}
              >
                <circle
                  r="25"
                  className={`${n.revealed ? 'revealed' : ''} ${n.id === challenge.blockedNode ? 'blocked-node' : n.id === challenge.requiredNode ? 'required-node' : ''}`}
                />
                <text textAnchor="middle" y="5">
                  {n.id}
                </text>
              </g>
            ))}
          </svg>
        </>
      )}
      {(!compact || challenge.kind === 'work-order') && (
        <div className="clues">
          {challenge.nodes
            .filter(
              (n) =>
                !['S', 'T'].includes(n.id) && (challenge.kind !== 'work-order' || n.id !== 'D'),
            )
            .map((node) => (
              <article
                key={node.id}
                className={`${node.patched ? 'task-complete' : ''} ${node.revealed ? 'clue-revealed' : 'clue-hidden'}`}
              >
                <strong>
                  {node.id} · {node.patched ? 'Patched' : node.revealed ? 'Discovered' : 'Unknown'}
                </strong>
                <p>{node.clue ?? `Chat: !scan ${node.id}`}</p>
                {interactive && !node.revealed && (
                  <button
                    disabled={busy}
                    onClick={() => onCommand({ type: 'scan', node: node.id as 'A' })}
                  >
                    Scan {node.id}
                  </button>
                )}
                {interactive &&
                  challenge.kind === 'work-order' &&
                  node.revealed &&
                  !node.patched && (
                    <button
                      disabled={busy}
                      onClick={() => onCommand({ type: 'patch', node: node.id as 'A' })}
                    >
                      Patch {node.id}
                    </button>
                  )}
              </article>
            ))}
        </div>
      )}
      {challenge.kind === 'route' && interactive && (
        <details className="route-tools" open={!hud}>
          <summary>Plot a route</summary>
          <div className="route-builder">
            <p className="muted">
              Build a route in order, or type it below. Discover the required and unsafe relays
              before submitting.
            </p>
            <div className="buttons" aria-label="Route node shortcuts">
              {challenge.nodes.map((node) => (
                <button
                  key={node.id}
                  aria-label={`Add ${node.id}`}
                  disabled={busy || challenge.solved}
                  onClick={() =>
                    setRoute((previous) =>
                      `${previous} ${node.id}`.trim().split(/\s+/).slice(-6).join(' '),
                    )
                  }
                >
                  {hud ? node.id : `Add ${node.id}`}
                </button>
              ))}
              <button disabled={!route || busy} onClick={() => setRoute('')}>
                Clear route
              </button>
            </div>
            <div className="route-entry">
              <label>
                Candidate route
                <input
                  aria-label="Candidate route"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="S … T"
                  maxLength={24}
                />
              </label>
              <button
                disabled={busy || challenge.solved || !route.trim()}
                onClick={() =>
                  onCommand({
                    type: 'route',
                    nodes: route.trim().toUpperCase().split(/\s+/) as (
                      'S' | 'A' | 'B' | 'C' | 'D' | 'T'
                    )[],
                  })
                }
              >
                Submit route
              </button>
            </div>
          </div>
        </details>
      )}
      <p className="muted">
        Mobile Twitch viewers use !scan, !route or !patch in chat. One person can solve this; larger
        crews can share discovery and repairs.
      </p>
    </section>
  );
}
