import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Command, ResourceId, WorldPresentation } from '@torchline/contracts';
import { request } from './api.ts';
import type { DashboardSnapshot } from './api.ts';
import { ArkView } from './ArkView.tsx';
import { ChallengeView } from './ChallengeView.tsx';
import './styles.css';

function ResourceMeters({ world }: { world: WorldPresentation }) {
  return (
    <section className="resources" aria-label="Ark resources">
      {(['passengers', 'hull', 'power', 'oxygen', 'navigation', 'supplies'] as ResourceId[]).map(
        (key) => (
          <div key={key}>
            <span>{key}</span>
            <strong data-resource={key}>{world.resources[key]}</strong>
            <small>
              {key === 'passengers'
                ? '120 for colony'
                : key === 'supplies'
                  ? '30 for colony'
                  : key === 'navigation'
                    ? '40 for safer entry'
                    : 'remaining'}
            </small>
          </div>
        ),
      )}
    </section>
  );
}
function App() {
  const overlayChannel = location.pathname.match(/^\/overlay\/([^/]+)\//)?.[1];
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actor, setActor] = useState('crew-one');
  const [chat, setChat] = useState('');
  const [target, setTarget] = useState('sim-beta');
  const [overlayUrl, setOverlayUrl] = useState('');
  const [operatorKey, setOperatorKey] = useState('');
  useEffect(() => {
    if (
      data?.mode === 'live' &&
      data.recipients?.length &&
      !data.recipients.some((recipient) => recipient.id === target)
    )
      setTarget(data.recipients[0].id);
  }, [data?.recipients, target, data?.mode]);
  const refresh = useCallback(async () => {
    if (!overlayChannel) setData(await request<DashboardSnapshot>('/api/state'));
  }, [overlayChannel]);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (overlayChannel || !data?.me) return;
    const source = new EventSource('/api/live/events');
    source.addEventListener('snapshot', (event) =>
      setData(JSON.parse((event as MessageEvent).data)),
    );
    source.addEventListener('unavailable', () =>
      setError('Connection interrupted. Current state will return after reconnection.'),
    );
    return () => source.close();
  }, [data?.me?.id, overlayChannel]);
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
  return (
    <main className={overlayChannel ? 'app overlay' : 'app'}>
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
          <small>Functional reference interface · final visual experience by Claude Design</small>
        </div>
      </header>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {!overlayChannel && !data?.me && (
        <section className="panel welcome">
          <h2>Persistent gameplay flight deck</h2>
          <p>
            Play five chapters, solve shared challenges, and leave a ship with lasting consequences.
            Raids are optional; the whole season works on one channel.
          </p>
          {data?.mode !== 'live' ? (
            <>
              <p>Choose a simulated creator. These accounts never connect to Twitch.</p>
              <div className="buttons">
                {['alpha', 'beta', 'gamma'].map((channel) => (
                  <button
                    key={channel}
                    onClick={() => void perform(() => request('/api/simulator/login', { channel }))}
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
        <section className="panel">
          <details open={!data.integration.botAuthorized}>
            <summary>Dedicated bot setup · operator access</summary>
            <p>
              Use a private browser signed into the separate bot account. Enter BOT_SETUP_SECRET
              from your local .env.live, then authorize the bot. This is separate from “Connect
              creator with Twitch” and uses the same registered application.
            </p>
            <p>
              If the intended bot account appears as a Twitch creator session, use “Disconnect
              Twitch authorization” first, then return here. Only an account with no world history
              can change from an accidental creator connection to the bot role.
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
              {data.mode === 'simulation' ? 'Simulated creator session' : 'Twitch creator session'}
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
              <a href={overlayUrl} target="_blank" rel="noreferrer">
                Open read-only overlay
              </a>
            )}
            <button onClick={() => void perform(() => request('/auth/logout', {}))}>
              Sign out
            </button>
          </div>
        </section>
      )}
      {world && (
        <>
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
                  <button onClick={() => send({ type: 'pause' })}>Pause</button>
                )}
                {world.capabilities.canResume && (
                  <button onClick={() => send({ type: 'resume' })}>Resume</button>
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
          </section>
          <ResourceMeters world={world} />
          <ArkView systems={world.systems} resources={world.resources} />
          {world.handoffPending && (
            <div className="notice">
              Handoff prepared. World mutations are frozen until the receiver accepts or the intent
              ends.
            </div>
          )}
          {world.challenge && (
            <ChallengeView
              challenge={world.challenge}
              interactive={!overlayChannel && world.phase === 'challenge' && !world.handoffPending}
              onCommand={send}
              busy={busy}
            />
          )}
          {!overlayChannel && data?.mode === 'simulation' && !world.outcome && (
            <section className="panel">
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
                  <input value={actor} onChange={(e) => setActor(e.target.value)} maxLength={40} />
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
            <section className="panel">
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
                        <p className="preview">
                          After: hull {choice.preview.resources.hull}, oxygen{' '}
                          {choice.preview.resources.oxygen}, supplies{' '}
                          {choice.preview.resources.supplies}, passengers{' '}
                          {choice.preview.resources.passengers}
                        </p>
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
          <section className="panel">
            <h2>World lineage</h2>
            <p>Damage, repairs and consequences remain part of this Ark's history.</p>
            <ol className="history">
              {world.events
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id}>
                    <strong>Chapter {event.chapter}</strong> {event.summary}
                    {Object.keys(event.resourceDelta).length > 0 && (
                      <small>
                        {Object.entries(event.resourceDelta)
                          .map(([key, value]) => `${key} ${value! > 0 ? '+' : ''}${value}`)
                          .join(' · ')}
                      </small>
                    )}
                    {event.causes.length > 0 && (
                      <small>Inherited cause: {event.causes.join(', ')}</small>
                    )}
                  </li>
                ))}
            </ol>
          </section>
        </>
      )}
      {!overlayChannel && data?.me && (
        <>
          <section className="panel">
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
                <p>
                  <strong>{h.status}</strong> · {h.source_id} → {h.target_id} · {h.mode}
                </p>
                <div className="buttons">
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
                        void perform(() => request(`/api/handoffs/${h.id}/accept`, {}))
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
            <p className="muted">
              Genuine native raid verification remains an external milestone. Simulated evidence
              cannot authorize a live-world transfer.
            </p>
          </section>
          <section className="panel">
            <h2>World library</h2>
            {(data.worlds ?? []).length === 0 && <p>No worlds currently in your custody.</p>}
            {data.worlds?.map((item) => (
              <div className="library-item" key={item.id}>
                <span>
                  {item.id.slice(0, 8)} · chapter {item.chapter} ·{' '}
                  {item.outcome ?? (item.parked ? 'parked' : 'active')}
                </span>
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
          <section className="panel">
            <h2>Twitch integration verification</h2>
            <p>
              Credentials:{' '}
              {data.integration.credentialsConfigured ? 'configured' : 'not configured'} · bot
              grant: {data.integration.botAuthorized ? 'stored' : 'not configured'} · public HTTPS:{' '}
              {data.integration.publicHttps ? 'configured' : 'not configured'}
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
                          {sub.current && sub.providerConfirmed ? ' · configuration confirmed' : ''}
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
            The host can create, resume or accept a world. This read-only source follows its channel
            automatically.
          </p>
        </section>
      )}
      <footer>
        Functional foundation · authored rules ark-v2 · no mandatory runtime AI · final design
        integration pending
      </footer>
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
