import { useEffect, useMemo, useState } from 'react';
import type {
  DecisionAlternatives,
  RecordedWorldEvent,
  ReplayVerification,
  WorldHistoryPage,
  WorldPresentation,
} from '@torchline/contracts';
import { request } from '../api.ts';
import { Brand } from './primitives.tsx';
import { Lineage, SeasonRecord } from './Lineage.tsx';
import type { HistoryLoader } from './Lineage.tsx';
import { WhatIf } from './WhatIf.tsx';
import './index.css';
import './integration.css';
import './experience.css';

interface Shared {
  mode: 'simulation' | 'live';
  world: WorldPresentation;
  history: WorldHistoryPage;
}

/**
 * The read-only public record behind a share link: no session, no controls and no live channel
 * access. Communities that handed an Ark on can keep following what became of their decisions.
 */
export function PublicChronicle() {
  const token = location.hash.slice(1);
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<RecordedWorldEvent | null>(null);
  const loader = useMemo<HistoryLoader>(
    () => async (params) =>
      (
        await request<Shared>('/api/chronicle', {
          token,
          limit: Number(params.get('limit') ?? 100),
          ...(params.get('before') ? { before: Number(params.get('before')) } : {}),
          ...(params.get('through') ? { through: Number(params.get('through')) } : {}),
          ...(params.get('custodyBefore') ? { custodyBefore: params.get('custodyBefore') } : {}),
        })
      ).history,
    [token],
  );
  useEffect(() => {
    document.title = 'TORCHLINE · Public Chronicle';
    if (!/^[a-f\d]{64}$/.test(token)) {
      setError('This Chronicle link is incomplete. Ask the creator for the full link.');
      return;
    }
    void request<Shared>('/api/chronicle', { token })
      .then(setShared)
      .catch((e) => setError((e as Error).message));
  }, [token]);
  const latest = shared?.history.events[0];
  const event = selected ?? latest;
  return (
    <main className="public-chronicle" data-design="figma-v2">
      <header className="public-chronicle-bar">
        <Brand />
        <span>
          PUBLIC CHRONICLE · READ ONLY
          {shared ? ` · ${shared.mode === 'live' ? 'TWITCH WORLD' : 'SAVED PRACTICE'}` : ''}
        </span>
      </header>
      <div className="platform-title">
        <span className="eyebrow">ONE ARK / EVERY COMMUNITY THAT CARRIED IT</span>
        <strong>WORLD CHRONICLE</strong>
        <p>
          Every decision, repair and debt this Ark carried, named by the community that made it.
          Nothing here can change the ship.
        </p>
      </div>
      {error && (
        <p className="public-chronicle-error" role="alert">
          {error}
        </p>
      )}
      {!shared && !error && <p className="lineage-empty">Reading the saved record…</p>}
      {shared && (
        <>
          <SeasonRecord
            world={shared.world}
            loader={loader}
            verify={async () =>
              (
                await request<{ verification: ReplayVerification }>('/api/chronicle/verify', {
                  token,
                })
              ).verification
            }
          />
          <section className="lineage-panel" aria-label="Lineage across communities">
            <div className="section-label">
              <span>LINEAGE · WHO CAUSED WHAT</span>
              <small>
                {shared.world.outcome
                  ? 'VOYAGE COMPLETE'
                  : `NOW COMMANDED BY ${shared.world.host.toUpperCase()}`}
              </small>
            </div>
            <Lineage world={shared.world} loader={loader} onSelect={setSelected} />
          </section>
          {event && (
            <section className="public-chronicle-record" aria-live="polite">
              <span className="eyebrow">
                CH. {event.chapter} / {event.community.label.toUpperCase()}
              </span>
              <strong>{event.summary}</strong>
              <small>{new Date(event.at).toLocaleString()}</small>
              <WhatIf
                eventId={event.id}
                summary={event.summary}
                load={async (eventId) =>
                  (
                    await request<{ alternatives: DecisionAlternatives }>(
                      '/api/chronicle/alternatives',
                      { token, event: eventId },
                    )
                  ).alternatives
                }
              />
            </section>
          )}
          <section className="public-chronicle-custody" aria-label="Custody chain">
            <span className="eyebrow">CUSTODY CHAIN</span>
            {shared.history.custody.length ? (
              [...shared.history.custody].reverse().map((step) => (
                <p key={step.id}>
                  {step.source.label} → {step.target.label}
                  <small>
                    {step.mode === 'live'
                      ? 'NATIVE RAID · RECEIVER CONSENT'
                      : 'SIMULATED RELAY · PRACTICE ONLY'}{' '}
                    · {new Date(step.at).toLocaleString()}
                  </small>
                </p>
              ))
            ) : (
              <p>This Ark has stayed with its first community so far.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
