import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Command, WorldPresentation } from '@torchline/contracts';
import { HandoffInspector } from './WorldRecords.tsx';
import { request } from './api.ts';
import type { BotSetupPreview, DashboardSnapshot } from './api.ts';
import { ArkView } from './ArkView.tsx';
import { ChallengeView } from './ChallengeView.tsx';
import {
  BroadcastOverlay,
  ChoiceForecast,
  ConsequenceSignal,
  DeckNav,
  ParticipationGuide,
  RelayProgress,
  ResourceMeters,
  WorldArchive,
} from './DeckViews.tsx';
import type { Workspace } from './DeckViews.tsx';
import './styles.css';

function App() {
  const overlayChannel = location.pathname.match(/^\/overlay\/([^/]+)\//)?.[1];
  const [workspace, setWorkspace] = useState<Workspace>('bridge');
  const [archiveWorld, setArchiveWorld] = useState<WorldPresentation | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [actor, setActor] = useState('crew-one');
  const [chat, setChat] = useState('');
  const [target, setTarget] = useState('sim-beta');
  const [overlayUrl, setOverlayUrl] = useState('');
  const [operatorKey, setOperatorKey] = useState('');
  const [botSetup, setBotSetup] = useState<BotSetupPreview | null>(null);
  useEffect(() => {
    if (!data?.me) {
      setArchiveWorld(null);
      setPreviewId(null);
      return;
    }
    setArchiveWorld((previous) =>
      previous && data.worlds?.some((item) => item.id === previous.worldId) ? previous : null,
    );
    setPreviewId((previous) =>
      data.handoffs?.some(
        (item) => item.id === previous && ['prepared', 'verified'].includes(item.status),
      )
        ? previous
        : null,
    );
  }, [data?.me?.id, data?.worlds, data?.handoffs]);
  useEffect(() => {
    if (
      data?.mode === 'live' &&
      data.recipients?.length &&
      !data.recipients.some((recipient) => recipient.id === target)
    )
      setTarget(data.recipients[0].id);
  }, [data?.recipients, target, data?.mode]);
  const refresh = useCallback(async () => {
    if (!overlayChannel) {
      const next = await request<DashboardSnapshot>('/api/state');
      setData(next);
      if (next.mode === 'live')
        setBotSetup(
          (await request<{ pending: BotSetupPreview | null }>('/api/operator/bot-setup')).pending,
        );
    }
  }, [overlayChannel]);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (overlayChannel || !data?.me) return;
    let active = true;
    const source = new EventSource('/api/live/events');
    source.addEventListener('snapshot', (event) => {
      if (active) setData(JSON.parse((event as MessageEvent).data));
    });
    source.addEventListener('unavailable', () => {
      source.close();
      void refresh()
        .then(() => {
          if (active) setError('');
        })
        .catch(() => {
          if (active) setError('Connection interrupted. Refresh to reconnect.');
        });
    });
    return () => {
      active = false;
      source.close();
    };
  }, [data?.me?.id, overlayChannel, refresh]);
  useEffect(() => {
    if (!overlayChannel) return;
    let source: EventSource | undefined;
    let stopped = false;
    const connect = async () => {
      if (location.hash.length > 1) {
        await request(`/overlay/${overlayChannel}/session`, { token: location.hash.slice(1) });
        history.replaceState(null, '', location.pathname);
      }
      if (stopped) return;
      source = new EventSource(`/overlay/${overlayChannel}/events`);
      source.addEventListener('snapshot', (event) => {
        setData(JSON.parse((event as MessageEvent).data));
        setError('');
      });
      source.addEventListener('unavailable', () => {
        setData(null);
        setError('Overlay access ended. Check its grant and connection.');
        source?.close();
      });
      source.onerror = () => setError('Overlay reconnecting. Check the grant if this persists.');
    };
    void connect().catch((e) => setError(e.message));
    return () => {
      stopped = true;
      source?.close();
    };
  }, [overlayChannel]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const world = data?.world;
  const archived = archiveWorld?.worldId === world?.worldId ? world : (archiveWorld ?? world);
  const previewOffer = data?.handoffs?.find(
    (item) => item.id === previewId && ['prepared', 'verified'].includes(item.status),
  );
  const send = (command: Command) => {
    if (world)
      void perform(() =>
        request(`/api/worlds/${world.worldId}/commands`, {
          command,
          expectedVersion: world.worldVersion,
          commandId: crypto.randomUUID(),
        }),
      );
  };
  if (overlayChannel) return <BroadcastOverlay world={world} error={error} mode={data?.mode} />;
  return (
    <main className={data?.me ? 'app command-shell' : 'app docking'}>
      <a className="skip-link" href="#deck-content">
        Skip to game
      </a>
      {data?.me && <DeckNav active={workspace} onChange={setWorkspace} />}
      <div className="deck-content" id="deck-content" tabIndex={-1} aria-busy={busy}>
        <header>
          <div>
            <h1>TORCHLINE</h1>
            <p>The stream ends. The world doesn't.</p>
          </div>
          <div className="header-status">
            <span className="badge">
              {data?.mode === 'live'
                ? 'LIVE MODE · verification pending'
                : 'SIMULATION · not Twitch footage'}
            </span>
            <small>The Ark Protocol · persistent community survival</small>
          </div>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {data?.me &&
          workspace !== 'relay' &&
          data.handoffs?.some(
            (item) =>
              item.target_id === data.me!.id && ['prepared', 'verified'].includes(item.status),
          ) && (
            <aside className="notice">
              Another community has offered you an Ark.{' '}
              <button onClick={() => setWorkspace('relay')}>Review incoming world</button>
            </aside>
          )}
        {!overlayChannel && botSetup && (
          <section className="panel" aria-labelledby="bot-conversion-title">
            <h2 id="bot-conversion-title">Use {botSetup.accountLabel} as the dedicated bot?</h2>
            <p>
              Twitch authorized {botSetup.accountLabel} for bot access. Confirming ends this
              account’s TORCHLINE creator sessions and OBS access and makes it the dedicated bot.
              Accounts with Ark or handoff history cannot be converted.
            </p>
            <button
              disabled={busy}
              onClick={() => void perform(() => request('/api/operator/bot-setup/confirm', {}))}
            >
              Convert {botSetup.accountLabel} to the dedicated bot
            </button>
            <button
              disabled={busy}
              onClick={() => void perform(() => request('/api/operator/bot-setup/cancel', {}))}
            >
              Cancel bot conversion
            </button>
          </section>
        )}
        {!overlayChannel && !data?.me && (
          <section className="panel welcome">
            <h2>Persistent gameplay flight deck</h2>
            <p>
              Play five chapters, solve shared challenges, and leave a ship with lasting
              consequences. Raids are optional; the whole season works on one channel.
            </p>
            {data?.mode !== 'live' ? (
              <>
                <p>Choose a simulated creator. These accounts never connect to Twitch.</p>
                <div className="buttons">
                  {['alpha', 'beta', 'gamma'].map((channel) => (
                    <button
                      key={channel}
                      onClick={() =>
                        void perform(() => request('/api/simulator/login', { channel }))
                      }
                    >
                      Use simulation {channel}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <a className="button" href="/auth/twitch">
                  Connect creator with Twitch
                </a>
                <p>
                  {data.integration.botAuthorized
                    ? 'Dedicated bot authorization is current. Connect the broadcaster to finish channel setup.'
                    : 'The dedicated bot still needs separate authorization.'}
                </p>
              </>
            )}
          </section>
        )}
        {!overlayChannel && data?.mode === 'live' && (
          <section
            className="panel operator-panel"
            hidden={!!data?.me && workspace !== 'broadcast'}
          >
            <details open={!data.integration.botAuthorized}>
              <summary>Dedicated bot setup · operator access</summary>
              <p>
                Use a private browser signed into the separate bot account. Enter BOT_SETUP_SECRET
                from your local .env.live, then authorize the bot. This is separate from “Connect
                creator with Twitch” and uses the same registered application.
              </p>
              <p>
                After Twitch consent, an accidentally connected creator with no world history gets a
                named confirmation step to convert it into the bot. Check the account name before
                confirming.
              </p>
              <label>
                Bot setup secret
                <input
                  type="password"
                  autoComplete="off"
                  value={operatorKey}
                  onChange={(e) => setOperatorKey(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !operatorKey}
                onClick={() =>
                  void perform(async () => {
                    const result = await request<{ url: string }>(
                      '/api/operator/bot-authorization',
                      {},
                      { Authorization: `Bearer ${operatorKey}` },
                    );
                    setOperatorKey('');
                    location.assign(result.url);
                  })
                }
              >
                Authorize the dedicated bot
              </button>
            </details>
          </section>
        )}
        {!overlayChannel && data?.me && (
          <section className="panel toolbar">
            <div>
              <strong>{data.me.label}</strong>
              <p>
                {data.mode === 'simulation'
                  ? 'Simulated creator session'
                  : 'Twitch creator session'}
              </p>
            </div>
            <div className="buttons">
              {!world && (
                <button
                  disabled={busy}
                  onClick={() => void perform(() => request('/api/worlds', {}))}
                >
                  Create an Ark
                </button>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const result = await request<{ url: string }>('/api/overlay-grant', {});
                    setOverlayUrl(result.url);
                  })
                }
              >
                Generate / rotate OBS link
              </button>
              {overlayUrl && (
                <>
                  <button
                    onClick={() =>
                      void (
                        navigator.clipboard?.writeText(overlayUrl) ??
                        Promise.reject(new Error('Clipboard unavailable'))
                      )
                        .then(() =>
                          setNotice('OBS link copied. Keep this read-only access link private.'),
                        )
                        .catch(() =>
                          setError(
                            'Clipboard unavailable. Copy the destination of Open read-only overlay.',
                          ),
                        )
                    }
                  >
                    Copy OBS link
                  </button>
                  <a href={overlayUrl} target="_blank" rel="noreferrer">
                    Open read-only overlay
                  </a>
                </>
              )}
              <button onClick={() => void perform(() => request('/auth/logout', {}))}>
                Sign out
              </button>
            </div>
          </section>
        )}
        {!world && data?.me && workspace === 'bridge' && (
          <section className="panel empty-deck">
            <span className="eyebrow">CAPTAIN, THE BRIDGE IS YOURS</span>
            <h2>A world worth carrying forward.</h2>
            <p>
              Create an Ark to begin a five-chapter voyage, resume a saved vessel from the Hangar,
              or receive another community’s ship through Relay.
            </p>
            <div className="buttons">
              <button onClick={() => setWorkspace('hangar')}>Open Hangar</button>
              <button onClick={() => setWorkspace('relay')}>Open Relay</button>
            </div>
          </section>
        )}
        {world && workspace === 'bridge' && (
          <div className="bridge-view">
            <section className="panel chapter-banner">
              <div>
                <span className="eyebrow">
                  Chapter {world.chapter}/5 · {world.phase} · {world.participantCount} contributors
                </span>
                <h2>{world.title}</h2>
                <p aria-live="polite">{world.recap}</p>
                <small>
                  World {world.worldId.slice(0, 8)} · host {world.host} · revision{' '}
                  {world.worldVersion}
                </small>
              </div>
              {world.outcome && (
                <div className={`ending ${world.outcome}`}>
                  <strong>
                    {world.outcome === 'colony'
                      ? 'Colony established'
                      : world.outcome === 'wreck'
                        ? 'Ark lost'
                        : 'Partial survival'}
                  </strong>
                  <p>{world.endingReason}</p>
                </div>
              )}
              {!overlayChannel && (
                <div className="buttons">
                  {world.capabilities.canStart && (
                    <button disabled={busy} onClick={() => send({ type: 'start' })}>
                      Start chapter {world.chapter + 1}
                    </button>
                  )}
                  {world.capabilities.canCloseChallenge && (
                    <button disabled={busy} onClick={() => send({ type: 'close-challenge' })}>
                      Open final decision
                    </button>
                  )}
                  {world.capabilities.canPause && (
                    <button disabled={busy} onClick={() => send({ type: 'pause' })}>
                      Pause
                    </button>
                  )}
                  {world.capabilities.canResume && (
                    <button disabled={busy} onClick={() => send({ type: 'resume' })}>
                      Resume
                    </button>
                  )}
                  <button
                    disabled={busy || world.handoffPending}
                    onClick={() =>
                      void perform(() =>
                        request(`/api/worlds/${world.worldId}/hosting`, { resume: false }),
                      )
                    }
                  >
                    Park / archive Ark
                  </button>
                </div>
              )}
              {world.phase === 'challenge' && (
                <p className="phase-guidance">
                  {world.challenge?.solved
                    ? 'Challenge reward secured. Open the decision when your crew is ready.'
                    : 'Keep this window open while chat solves the challenge. Closing it ends further discovery and repairs for this chapter.'}
                </p>
              )}
            </section>
            <ResourceMeters world={world} />
            <ArkView key={world.worldId} systems={world.systems} resources={world.resources} />
            <ParticipationGuide world={world} />
            {world.handoffPending && (
              <div className="notice">
                Handoff prepared. World mutations are frozen until the receiver accepts or the
                intent ends.
              </div>
            )}
            {world.challenge && (
              <ChallengeView
                challenge={world.challenge}
                interactive={
                  !overlayChannel && world.phase === 'challenge' && !world.handoffPending
                }
                onCommand={send}
                busy={busy}
              />
            )}
            {!overlayChannel && data?.mode === 'simulation' && !world.outcome && (
              <section className="panel simulator-panel">
                <h2>Simulated viewer input</h2>
                <p>
                  Exercises the same command grammar and game rules as Twitch input. No Twitch
                  messages are sent.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      await request('/api/simulator/commands', { actor, text: chat });
                      setChat('');
                    });
                  }}
                  className="chat-form"
                >
                  <label>
                    Participant alias
                    <input
                      value={actor}
                      onChange={(e) => setActor(e.target.value)}
                      maxLength={40}
                    />
                  </label>
                  <label>
                    Chat command
                    <input
                      aria-label="Chat command"
                      value={chat}
                      onChange={(e) => setChat(e.target.value)}
                      placeholder="!scan A"
                      maxLength={160}
                    />
                  </label>
                  <button disabled={busy || !chat}>Send simulated input</button>
                </form>
              </section>
            )}
            {world.choices.length > 0 && (
              <section className="panel decision-panel">
                <h2>
                  {world.phase === 'decision'
                    ? 'Commit a consequential choice'
                    : 'Upcoming decision · previews update with repairs'}
                </h2>
                <p>
                  Audience votes advise the host. Exact resource previews include challenge rewards
                  already earned.
                </p>
                <div className="choices">
                  {world.choices.map((choice, index) => (
                    <article key={choice.id}>
                      <h3>
                        {index + 1}. {choice.label}
                      </h3>
                      <p>{choice.description}</p>
                      <small>
                        Chat: !vote {index + 1} · {world.votes[choice.id] ?? 0} votes
                      </small>
                      {choice.preview && (
                        <>
                          <ChoiceForecast
                            resources={choice.preview.resources}
                            current={world.resources}
                          />
                          {choice.preview.warnings.map((warning) => (
                            <p className="warning" key={warning}>
                              {warning}
                            </p>
                          ))}
                        </>
                      )}
                      {!choice.available && <p className="warning">{choice.unavailableReason}</p>}
                      {!overlayChannel && (
                        <button
                          disabled={busy || !world.capabilities.canCommit || !choice.available}
                          onClick={() => send({ type: 'commit', option: choice.id })}
                        >
                          Commit {choice.label}
                          {choice.preview?.outcome === 'wreck' ? ' — wreck forecast' : ''}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
            <ConsequenceSignal key={world.worldId} world={world} />
            <button className="quiet archive-link" onClick={() => setWorkspace('archive')}>
              Read the Ark’s history
            </button>
          </div>
        )}
        {archived && data?.me && workspace === 'archive' && (
          <WorldArchive key={archived.worldId} world={archived} />
        )}
        {!archived && workspace === 'archive' && data?.me && (
          <section className="panel">
            <h2>No active Ark</h2>
            <p>Resume a vessel from the Hangar to inspect its physical record.</p>
          </section>
        )}
        {!overlayChannel && data?.me && (
          <>
            <section className="panel relay-view" hidden={workspace !== 'relay'}>
              <span className="eyebrow">THE TORCH DOES NOT GO OUT</span>
              <h2>World custody {data.mode === 'simulation' ? 'rehearsal' : 'readiness'}</h2>
              <p>
                Worlds move only after source preparation, verified raid evidence, and receiver
                acceptance. No raid is needed to keep playing.
              </p>
              <label className="toggle">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={data.me.receiveOptIn}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setData({ ...data, me: { ...data.me!, receiveOptIn: enabled } });
                    void perform(() => request('/api/receive-opt-in', { enabled }));
                  }}
                />
                Accept incoming world offers
              </label>
              {world && (
                <div className="buttons">
                  <label>
                    Receiving creator
                    <select value={target} onChange={(e) => setTarget(e.target.value)}>
                      {data.mode === 'simulation'
                        ? ['alpha', 'beta', 'gamma'].map((id) => (
                            <option key={id} value={`sim-${id}`}>
                              Simulation {id}
                            </option>
                          ))
                        : data.recipients?.map((recipient) => (
                            <option key={recipient.id} value={recipient.id}>
                              {recipient.label}
                            </option>
                          ))}
                    </select>
                  </label>
                  <button
                    disabled={
                      busy ||
                      world.phase !== 'ready' ||
                      world.chapter === 0 ||
                      world.handoffPending ||
                      (data.mode === 'live' && !data.recipients?.length)
                    }
                    onClick={() =>
                      void perform(() =>
                        request('/api/handoffs', {
                          worldId: world.worldId,
                          targetId: target,
                          expectedVersion: world.worldVersion,
                        }),
                      )
                    }
                  >
                    Prepare handoff
                  </button>
                </div>
              )}
              {(data.handoffs ?? []).map((h) => (
                <article className="handoff" key={h.id}>
                  <RelayProgress status={h.status} mode={h.mode} />
                  <p>
                    <strong>{h.status}</strong> · {h.source_id} → {h.target_id} · {h.mode}
                  </p>
                  <div className="buttons">
                    {['prepared', 'verified'].includes(h.status) && (
                      <button disabled={busy} onClick={() => setPreviewId(h.id)}>
                        Inspect offered Ark
                      </button>
                    )}
                    {h.status === 'prepared' && data.mode === 'simulation' && (
                      <button
                        onClick={() =>
                          void perform(() => request(`/api/handoffs/${h.id}/simulate-raid`, {}))
                        }
                      >
                        Inject simulated raid evidence
                      </button>
                    )}
                    {h.target_id === data.me!.id && h.status === 'verified' && (
                      <button
                        onClick={() =>
                          void perform(() =>
                            request(`/api/handoffs/${h.id}/accept`, {}).then(() =>
                              setWorkspace('bridge'),
                            ),
                          )
                        }
                      >
                        Accept inherited Ark
                      </button>
                    )}
                    {['prepared', 'verified'].includes(h.status) && (
                      <button
                        onClick={() =>
                          void perform(() =>
                            request(
                              `/api/handoffs/${h.id}/${h.target_id === data.me!.id ? 'decline' : 'cancel'}`,
                              {},
                            ),
                          )
                        }
                      >
                        {h.target_id === data.me!.id ? 'Decline' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {workspace === 'relay' && previewOffer && (
                <HandoffInspector
                  key={previewOffer.id}
                  id={previewOffer.id}
                  status={previewOffer.status}
                  onClose={() => setPreviewId(null)}
                />
              )}
              <p className="muted">
                Genuine native raid verification remains an external milestone. Simulated evidence
                cannot authorize a live-world transfer.
              </p>
            </section>
            <section className="panel hangar-view" hidden={workspace !== 'hangar'}>
              <span className="eyebrow">EVERY VOYAGE HAS A HOME</span>
              <h2>World library</h2>
              {(data.worlds ?? []).length === 0 && <p>No worlds currently in your custody.</p>}
              {data.worlds?.map((item) => (
                <div className="library-item" key={item.id}>
                  <span>
                    {item.id.slice(0, 8)} · chapter {item.chapter} ·{' '}
                    {item.outcome ?? (item.parked ? 'parked' : 'active')}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        const record = await request<WorldPresentation>(
                          `/api/worlds/${item.id}/view`,
                        );
                        setArchiveWorld(record);
                        setWorkspace('archive');
                      })
                    }
                  >
                    Inspect Ark history
                  </button>
                  {item.parked && !world && (
                    <button
                      onClick={() =>
                        void perform(() =>
                          request(`/api/worlds/${item.id}/hosting`, { resume: true }),
                        )
                      }
                    >
                      Resume this Ark
                    </button>
                  )}
                </div>
              ))}
            </section>
            <section className="panel broadcast-settings" hidden={workspace !== 'broadcast'}>
              <span className="eyebrow">MAKE THE WORLD VISIBLE</span>
              <h2>Twitch integration verification</h2>
              <p>
                Credentials:{' '}
                {data.integration.credentialsConfigured ? 'configured' : 'not configured'} · bot
                grant: {data.integration.botAuthorized ? 'stored' : 'not configured'} · public
                HTTPS: {data.integration.publicHttps ? 'configured' : 'not configured'}
              </p>
              <p>
                Signed fixtures and simulation are separate from genuine chat, actual OBS
                compatibility and native raid verification.
              </p>
              {data.mode === 'live' && (
                <>
                  {data.integration.details && (
                    <div aria-live="polite">
                      <p>
                        Chat subscription:{' '}
                        {data.integration.details.chatReady ? 'ready' : 'not ready'} · incoming raid
                        subscription: {data.integration.details.raidReady ? 'ready' : 'not ready'}
                      </p>
                      {!data.integration.details.botAuthorized && (
                        <p role="status">
                          Authorize the dedicated bot before setting up chat. Open this site in a
                          private browser window, sign into the separate bot account, and use the
                          dedicated bot setup section. Then check subscriptions here.
                        </p>
                      )}
                      {data.integration.details.reconcileError &&
                        data.integration.details.botAuthorized && (
                          <p role="status">
                            Connection check: {data.integration.details.reconcileError}. Reconcile
                            again after completing account and callback setup.
                          </p>
                        )}
                      <ul>
                        {data.integration.details.subscriptions.map((sub) => (
                          <li key={sub.type}>
                            {sub.type}: {sub.status}
                            {sub.current && sub.providerConfirmed
                              ? ' · configuration confirmed'
                              : ''}
                          </li>
                        ))}
                      </ul>
                      <p>
                        Signed deliveries: {data.integration.details.deliveries.chat} chat,{' '}
                        {data.integration.details.deliveries.raid} raids · chat actions applied:{' '}
                        {data.integration.details.deliveries.appliedChat} · custody changes:{' '}
                        {data.integration.details.deliveries.custodyChanges}
                      </p>
                      <p>
                        In Twitch chat, send !scan A during a challenge, or !vote 1 when the host
                        opens a decision. Watch the Ark and this delivery count for the result.
                      </p>
                      <p>
                        Send !status or !history to request a bot reply. Replies:{' '}
                        {data.integration.details.botReplies.sent} sent,{' '}
                        {data.integration.details.botReplies.pending} pending,{' '}
                        {data.integration.details.botReplies.failed} failed,{' '}
                        {data.integration.details.botReplies.uncertain} uncertain.
                      </p>
                    </div>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void perform(() => request('/api/twitch/reconcile', {}))}
                  >
                    Check / repair Twitch subscriptions
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void perform(() => request('/api/twitch/disconnect', {}))}
                  >
                    Disconnect Twitch authorization
                  </button>
                </>
              )}
            </section>
          </>
        )}
        {overlayChannel && !world && (
          <section className="panel">
            <h2>No active Ark</h2>
            <p>
              The host can create, resume or accept a world. This read-only source follows its
              channel automatically.
            </p>
          </section>
        )}
        <footer>
          TORCHLINE / THE ARK PROTOCOL · authored rules ark-v2 · design by Claude Design
        </footer>
      </div>
    </main>
  );
}
// Avoid StrictMode double-invoking the one-time overlay capability exchange.
createRoot(document.getElementById('root')!).render(
  location.pathname.startsWith('/overlay/') ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
);
