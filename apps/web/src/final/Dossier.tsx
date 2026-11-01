import type { Obligation, WorldPresentation } from '@torchline/contracts';
import { systemLabels } from './condition.ts';

// Plain-language consequences for each saved obligation. The rules engine decides when a debt
// applies; this copy only explains what the receiving crew is now responsible for.
export const debtCopy: Record<Obligation['kind'], { title: string; detail: string }> = {
  'blind-jump': {
    title: 'Blind jump',
    detail: 'Navigation is gone. The next jump flies without guidance unless the crew rebuilds it.',
  },
  leak: {
    title: 'Life-support leak',
    detail:
      'Damaged life support vents fifteen oxygen in chapter four unless it is repaired first.',
  },
  'supply-debt': {
    title: 'Colony supply check',
    detail: 'Below thirty crates in chapter four, the shortage is recorded against this voyage.',
  },
};

/**
 * What a receiving community inherits, attributed to the communities that caused it. The server
 * clears the dossier on the receiver's first command, so it is news about an arrival rather
 * than permanent decoration. The broadcast variant is sized for an OBS scene.
 */
export function ArrivalDossier({
  world,
  variant = 'dashboard',
  vitals = variant !== 'dashboard',
}: {
  world: WorldPresentation;
  variant?: 'dashboard' | 'broadcast';
  /** The Mission Control rail already shows every resource directly below the dossier. */
  vitals?: boolean;
}) {
  const arrival = world.arrival;
  if (!arrival) return null;
  const decisions = arrival.decisions ?? [];
  const debts = arrival.debts ?? [];
  return (
    <section
      className={`arrival-dossier arrival-dossier--${variant}`}
      data-arrival-from={arrival.from.id}
      aria-label="Inherited Ark dossier"
      role={variant === 'broadcast' ? 'status' : undefined}
    >
      <header>
        <span className="eyebrow">INHERITED ARK · RELAY RECEIVED</span>
        <strong>
          {arrival.from.label} <em>handed this Ark on</em>
        </strong>
        <small>
          {arrival.communities && arrival.communities > 1
            ? `${arrival.communities} communities have commanded it`
            : 'First relay of this voyage'}{' '}
          · {world.chapter} of 5 chapters behind it
        </small>
      </header>
      {vitals && (
        <div className="dossier-vitals">
          <div>
            <span>PASSENGERS</span>
            <b>{world.resources.passengers}</b>
          </div>
          <div className={world.resources.hull < 35 ? 'critical' : ''}>
            <span>HULL</span>
            <b>{world.resources.hull}%</b>
          </div>
          <div className={world.resources.navigation === 0 ? 'critical' : ''}>
            <span>NAVIGATION</span>
            <b>{world.resources.navigation}%</b>
          </div>
          <div className={world.resources.supplies < 30 ? 'critical' : ''}>
            <span>SUPPLIES</span>
            <b>{world.resources.supplies}</b>
          </div>
        </div>
      )}
      {arrival.lostSystems.length > 0 && (
        <p className="dossier-lost">
          LOST ON ARRIVAL · {arrival.lostSystems.map((id) => systemLabels[id]).join(' · ')}
        </p>
      )}
      {decisions.length > 0 && (
        <div className="dossier-block">
          <span className="dossier-label">THEIR DECISIONS</span>
          <ol className="dossier-decisions">
            {decisions.map((decision) => (
              <li key={decision.eventId}>
                <b>CH.{decision.chapter}</b>
                <span>{decision.choice}</span>
                <small>{decision.community}</small>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="dossier-block">
        <span className="dossier-label">YOUR CONSEQUENCES</span>
        {debts.length ? (
          <ul className="dossier-debts">
            {debts.map((debt) => (
              <li key={`${debt.kind}-${debt.dueChapter}`}>
                <div>
                  <b>DUE CH.{debt.dueChapter}</b>
                  <strong>{debtCopy[debt.kind].title}</strong>
                </div>
                <p>{debtCopy[debt.kind].detail}</p>
                {debt.origin && (
                  <small>
                    Created by {debt.origin.community} · “{debt.origin.choice}” · chapter{' '}
                    {debt.origin.chapter}
                  </small>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dossier-clear">
            No unpaid debts. Every scar and repair above still travels with the ship.
          </p>
        )}
      </div>
      <footer>
        {variant === 'broadcast'
          ? 'Their decisions. Your consequences. The new captain commits what happens next.'
          : 'Their decisions. Your consequences. This briefing clears when you issue your first command.'}
      </footer>
    </section>
  );
}
