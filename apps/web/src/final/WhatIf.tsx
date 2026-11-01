import { useEffect, useState } from 'react';
import type { DecisionAlternatives, Resources } from '@torchline/contracts';
import { debtCopy } from './Dossier.tsx';
import { systemLabels } from './condition.ts';

export type AlternativesLoader = (eventId: string) => Promise<DecisionAlternatives>;

const columns: [keyof Resources, string][] = [
  ['passengers', 'PASSENGERS'],
  ['hull', 'HULL'],
  ['power', 'POWER'],
  ['oxygen', 'O₂'],
  ['navigation', 'NAV'],
  ['supplies', 'SUPPLIES'],
];
const endings = { colony: 'Colony', partial: 'Survivors land', wreck: 'Ark lost' } as const;

/** Decisions and attested results are the only saved events with a road not taken. */
export function hasAlternatives(summary: string) {
  return summary.includes(': committed by ') || summary.startsWith('Streamer-attested');
}

/**
 * The road not taken for one saved decision: every option replayed once from the pinned state
 * just before it, under the same rules. Read only; later chapters are never simulated. Uses plain
 * buttons because the public Chronicle renders it without a dashboard session.
 */
export function WhatIf({
  eventId,
  summary,
  load,
}: {
  eventId: string;
  summary: string;
  load: AlternativesLoader;
}) {
  const [result, setResult] = useState<{
    eventId: string;
    data?: DecisionAlternatives;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => setResult(null), [eventId]);
  if (!hasAlternatives(summary)) return null;
  const data = result?.eventId === eventId ? result.data : undefined;
  const failure = result?.eventId === eventId ? result.error : undefined;
  if (!data)
    return (
      <div className="what-if what-if--closed">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            load(eventId)
              .then((next) => setResult({ eventId, data: next }))
              .catch((error: Error) => setResult({ eventId, error: error.message }))
              .finally(() => setLoading(false));
          }}
        >
          {loading ? 'REPLAYING…' : 'WHAT IF THEY HAD CHOSEN DIFFERENTLY?'}
        </button>
        {failure && <p role="alert">{failure}</p>}
      </div>
    );
  const chosen = data.branches.find((branch) => branch.chosen);
  return (
    <section className="what-if" aria-label="Alternatives to this decision">
      <header>
        <span>ONE-STEP REPLAY · SAME RULES · LATER CHAPTERS NOT SIMULATED</span>
        <strong>{data.title}</strong>
        <small>
          {data.kind === 'decision' ? 'Captain decision' : 'Streamer-attested LIVEWIRE result'} ·
          chapter {data.chapter} · {data.community.label}
        </small>
        <em data-verified={data.verified}>
          {data.verified
            ? 'Recomputed choice matches the saved record'
            : 'Recomputed choice differs from the saved record'}
        </em>
      </header>
      <ol>
        {data.branches.map((branch) => (
          <li
            key={branch.option}
            data-chosen={branch.chosen}
            data-available={branch.available}
            data-option={branch.option}
          >
            <div className="what-if-head">
              <b>{branch.chosen ? 'CHOSEN' : 'NOT TAKEN'}</b>
              <strong>{branch.label}</strong>
            </div>
            {branch.resources ? (
              <>
                <div className="what-if-grid">
                  {columns.map(([key, name]) => {
                    const value = branch.resources![key];
                    const diff = chosen?.resources ? value - chosen.resources[key] : 0;
                    return (
                      <span key={key}>
                        <small>{name}</small>
                        <b>{value}</b>
                        {!branch.chosen && diff !== 0 && (
                          <i data-tone={diff > 0 ? 'gain' : 'loss'}>
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </i>
                        )}
                      </span>
                    );
                  })}
                </div>
                <p>
                  {branch.outcome
                    ? `Ends the voyage: ${endings[branch.outcome]}.`
                    : branch.debts.length
                      ? `Leaves ${branch.debts
                          .map(
                            (debt) =>
                              `${debtCopy[debt.kind].title.toLowerCase()} due ch.${debt.dueChapter}`,
                          )
                          .join(', ')}.`
                      : 'Leaves no new debt.'}
                  {branch.lost.length > 0 &&
                    ` Destroys ${branch.lost.map((id) => systemLabels[id].toLowerCase()).join(', ')}.`}
                </p>
              </>
            ) : (
              <p>Not legal from this saved state: {branch.unavailableReason}</p>
            )}
          </li>
        ))}
      </ol>
      <footer>
        Each branch starts from the saved state just before this decision. What later crews would
        have done differently is not guessed.
      </footer>
    </section>
  );
}
