import { useState } from 'react';
import type { Command, PuzzleGraph } from '@torchline/contracts';
export interface ChallengeRendererProps {
  challenge: PuzzleGraph;
  interactive: boolean;
  onCommand: (command: Command) => void;
  busy: boolean;
}
const positions: Record<string, [number, number]> = {
  S: [40, 115],
  A: [200, 50],
  B: [200, 180],
  C: [410, 50],
  D: [410, 180],
  T: [570, 115],
};
export function ChallengeView({ challenge, interactive, onCommand, busy }: ChallengeRendererProps) {
  const [route, setRoute] = useState('');
  return (
    <section className="panel" aria-label="Cooperative challenge">
      <div className="section-heading">
        <h2>{challenge.title}</h2>
        <span className="badge">
          {challenge.solved ? 'Solved · reward persisted' : 'Cooperation open'}
        </span>
      </div>
      <p>{challenge.prompt}</p>
      <p className="reward">Mechanical reward: {challenge.reward}</p>
      {challenge.kind === 'route' && (
        <>
          <div className="constraint-row">
            <span>Signal budget: {challenge.budget}</span>
            <span>Required: {challenge.requiredNode ?? 'scan to discover'}</span>
            <span>Unsafe: {challenge.blockedNode ?? 'scan to discover'}</span>
          </div>
          <svg viewBox="0 0 610 230" role="img" aria-label="Relay connections and signal costs">
            {challenge.edges.map((e) => {
              const a = positions[e.from],
                b = positions[e.to];
              return (
                <g key={e.from + e.to}>
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                  <text className="edge-cost" x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 5}>
                    {e.cost}
                  </text>
                </g>
              );
            })}
            {challenge.nodes.map((n) => (
              <g key={n.id} transform={`translate(${positions[n.id][0]} ${positions[n.id][1]})`}>
                <circle r="22" className={n.revealed ? 'revealed' : ''} />
                <text textAnchor="middle" y="5">
                  {n.id}
                </text>
              </g>
            ))}
          </svg>
        </>
      )}
      <div className="clues">
        {challenge.nodes
          .filter(
            (n) => !['S', 'T'].includes(n.id) && (challenge.kind !== 'work-order' || n.id !== 'D'),
          )
          .map((node) => (
            <article key={node.id}>
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
              {interactive && challenge.kind === 'work-order' && node.revealed && !node.patched && (
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
      {challenge.kind === 'route' && interactive && (
        <div className="route-entry">
          <label>
            Candidate route
            <input
              aria-label="Candidate route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="S A C T"
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
      )}
      <p className="muted">
        Mobile Twitch viewers use !scan, !route or !patch in chat. One person can solve this; larger
        crews can share discovery and repairs.
      </p>
    </section>
  );
}
