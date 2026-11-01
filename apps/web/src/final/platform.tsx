import { useEffect, useState } from 'react';
import type { HandoffPreview, RecordedWorldEvent, WorldPresentation } from '@torchline/contracts';
import { ArkShip } from './App.tsx';
import { Brand, Button, Icon } from './primitives.tsx';
import { useGame } from './session.tsx';
import { PhysicalSystems, PracticeChat } from './GameControls.tsx';
import { request } from '../api.ts';
import { useWorldHistory } from '../useWorldHistory.ts';
import type { Mode } from './types.ts';
import { systemLabels } from './condition.ts';
import { Rehearsal } from './Rehearsal.tsx';
import { Lineage, SeasonRecord } from './Lineage.tsx';

export function AccountPanel() {
  const { data, busy, perform, botSetup } = useGame();
  const [key, setKey] = useState('');
  if (!data) return null;
  return (
    <section className="account-panel" aria-label="Account and Twitch setup">
      <span className="eyebrow">
        {data.mode === 'live' ? 'TWITCH AUTHORIZATION' : 'PRACTICE IDENTITIES'}
      </span>
      <h2>{data.me?.label ?? 'Connect your captain'}</h2>
      {data.mode === 'simulation' ? (
        <>
          <p>Separate saved communities. Switching does not reset their worlds.</p>
          <div className="controls-row">
            {['alpha', 'beta', 'gamma'].map((channel) => (
              <Button
                key={channel}
                disabled={busy}
                onClick={() => void perform(() => request('/api/simulator/login', { channel }))}
              >
                Use simulation {channel}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>Creator consent and dedicated bot authorization remain separate.</p>
          {!data.me && (
            <a className="platform-primary" href="/auth/twitch">
              Connect creator with Twitch
            </a>
          )}
          {data.me && (
            <Button
              disabled={busy}
              onClick={() => void perform(() => request('/api/twitch/disconnect', {}))}
            >
              Disconnect Twitch authorization
            </Button>
          )}
          <details>
            <summary>Dedicated bot setup · operator access</summary>
            <p>
              Use the separate bot account. Enter the local bot setup secret, never the Twitch
              client secret.
            </p>
            <label>
              Bot setup secret
              <input
                type="password"
                value={key}
                autoComplete="off"
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <Button
              disabled={busy || !key}
              onClick={() =>
                void perform(async () => {
                  const next = await request<{ url: string }>(
                    '/api/operator/bot-authorization',
                    {},
                    { Authorization: `Bearer ${key}` },
                  );
                  setKey('');
                  location.assign(next.url);
                })
              }
            >
              Authorize dedicated bot
            </Button>
          </details>
          {botSetup && (
            <div role="status">
              <h3>Use {botSetup.accountLabel} as the dedicated bot?</h3>
              <p>
                Confirm only the named dedicated account. Accounts with world history cannot become
                the bot.
              </p>
              <Button
                disabled={busy}
                onClick={() => void perform(() => request('/api/operator/bot-setup/confirm', {}))}
              >
                Convert {botSetup.accountLabel} to the dedicated bot
              </Button>
              <Button
                disabled={busy}
                onClick={() => void perform(() => request('/api/operator/bot-setup/cancel', {}))}
              >
                Cancel bot conversion
              </Button>
            </div>
          )}
        </>
      )}
      {data.me && (
        <Button disabled={busy} onClick={() => void perform(() => request('/auth/logout', {}))}>
          Sign out
        </Button>
      )}
    </section>
  );
}

export function Inheritance({
  setMode,
  navigation,
}: {
  setMode: (mode: Mode) => void;
  navigation: number;
}) {
  const { data, canonical: world, busy, perform } = useGame();
  const [receiveDraft, setReceiveDraft] = useState<boolean | null>(null);
  const [target, setTarget] = useState('sim-beta'),
    [selected, setSelected] = useState(''),
    [preview, setPreview] = useState<HandoffPreview | null>(null),
    [error, setError] = useState(''),
    [acceptRequested, setAcceptRequested] = useState(false),
    [acceptedWorld, setAcceptedWorld] = useState('');
  const offers = data?.handoffs ?? [];
  const offer =
    offers.find((item) => item.id === selected) ??
    offers.find((item) => ['prepared', 'verified'].includes(item.status)) ??
    null;
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError('');
    if (offer && ['prepared', 'verified'].includes(offer.status))
      void request<HandoffPreview>(`/api/handoffs/${encodeURIComponent(offer.id)}/preview`)
        .then((next) => {
          if (active) setPreview(next);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [offer?.id, offer?.status]);
  const recipients =
    data?.mode === 'simulation'
      ? ['alpha', 'beta', 'gamma']
          .filter((name) => `sim-${name}` !== data.me?.id)
          .map((name) => ({ id: `sim-${name}`, label: `Simulation ${name}` }))
      : (data?.recipients ?? []);
  const unresolvedMission =
    !!world?.livewire?.stake && ['open', 'paused', 'locked'].includes(world.livewire.stake.status);
  const blocked = !world
    ? ''
    : world.chapter === 0
      ? 'Finish chapter one before handing this Ark on.'
      : world.handoffPending
        ? 'A relay for this Ark is already pending.'
        : world.outcome
          ? 'This voyage has ended; its record stays in the Chronicle.'
          : world.phase !== 'ready'
            ? 'Hand off at a finished chapter boundary, between chapters.'
            : unresolvedMission
              ? 'Resolve or cancel the LIVEWIRE mission first.'
              : !recipients.length
                ? 'No receiving creator has opted in yet.'
                : '';
  useEffect(() => {
    if (recipients.length && !recipients.some((item) => item.id === target))
      setTarget(recipients[0].id);
  }, [data?.recipients, data?.me?.id, target]);
  const accepted =
    acceptRequested &&
    offer?.status === 'committed' &&
    world?.worldId === acceptedWorld &&
    data?.me?.id === offer.target_id;
  useEffect(() => {
    if (!accepted) return;
    const timeout = setTimeout(() => setMode('mission'), 2200);
    return () => clearTimeout(timeout);
  }, [accepted]);
  const inherited = preview?.world ?? world;
  const receiving = offer?.target_id === data?.me?.id;
  return (
    <main className={`inheritance ${accepted ? 'inheritance--accepted' : ''}`}>
      <div className="inheritance-noise" />
      <div className="incoming-copy">
        <span className="transmission-label">
          {data?.mode === 'live'
            ? 'NATIVE RAID + RECEIVER CONSENT'
            : 'SAVED SIMULATION / NOT A NATIVE RAID'}
        </span>
        <strong className="incoming-title">
          ARK—001
          <br />
          <em>{offer ? 'INCOMING' : 'RELAY STANDBY'}</em>
        </strong>
        <div className="transmission-line" />
        <p>
          {preview?.world.recap ??
            'The same vessel carries its resources, scars and history. A real Twitch raid is required for live custody; ordinary chapters need no raid.'}
        </p>
      </div>
      <div className="inheritance-ship">
        <ArkShip
          navigation={inherited?.resources.navigation ?? navigation}
          selected="bridge"
          presentation={inherited}
        />
      </div>
      <div className="captain-transfer">
        <span className="eyebrow">CHAIN OF COMMAND / {offer?.status ?? 'NO OPEN OFFER'}</span>
        <div className="captain-names">
          <div>
            <small>PREVIOUS CAPTAIN</small>
            <strong>{preview?.source.label ?? world?.host ?? 'AWAITING SOURCE'}</strong>
            <span>PREPARATION REQUIRED</span>
          </div>
          <Icon name="transfer" size={34} />
          <div>
            <small>INCOMING CAPTAIN</small>
            <strong>{preview?.target.label ?? (receiving ? data?.me?.label : 'RECEIVER')}</strong>
            <span>
              {offer?.status === 'verified' ? 'EVIDENCE RECORDED' : 'AUTHORIZATION PENDING'}
            </span>
          </div>
        </div>
        <div className="inherited-stats">
          <div>
            <span>PASSENGERS</span>
            <strong>{inherited?.resources.passengers ?? '—'}</strong>
            <small>SAVED MANIFEST</small>
          </div>
          <div className={inherited?.resources.navigation === 0 ? 'critical' : ''}>
            <span>NAVIGATION</span>
            <strong>{inherited ? `${inherited.resources.navigation}%` : '—'}</strong>
            <small>PHYSICAL STATE PRESERVED</small>
          </div>
          <div>
            <span>SUPPLIES</span>
            <strong>{inherited ? inherited.resources.supplies : '—'}</strong>
            <small>CRATES · NO HANDOFF REWARD</small>
          </div>
        </div>
      </div>
      <div className="legacy-panel">
        <div className="legacy-quote">
          <span>LAST SAVED LOG</span>
          <p>
            {inherited?.events.at(-1)?.summary ??
              'No offer is ready. Prepare a transfer at a completed chapter boundary.'}
          </p>
        </div>
        <div className="sacrifice-list">
          <span>INHERITED HISTORY</span>
          {!inherited?.events.length && <p>No saved decisions yet.</p>}
          <ul>
            {inherited?.events
              .slice(-3)
              .reverse()
              .map((event) => (
                <li key={event.id}>
                  <b>CH. {event.chapter}</b>
                  <span>{event.summary}</span>
                </li>
              ))}
          </ul>
        </div>
        {data?.me && (
          <>
            <label className="receive-toggle">
              <input
                type="checkbox"
                checked={receiveDraft ?? data.me.receiveOptIn}
                disabled={busy}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setReceiveDraft(enabled);
                  void perform(() => request('/api/receive-opt-in', { enabled })).finally(() =>
                    setReceiveDraft(null),
                  );
                }}
              />
              Accept incoming world offers
            </label>
            {world && (
              <div className="relay-preparation">
                <label>
                  Receiving creator
                  <select value={target} onChange={(e) => setTarget(e.target.value)}>
                    {recipients.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={busy || !!blocked}
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
                </Button>
                {blocked && <small className="relay-blocked">{blocked}</small>}
              </div>
            )}
          </>
        )}
        {offers.length > 0 && (
          <label>
            World offers
            <select value={offer?.id ?? ''} onChange={(e) => setSelected(e.target.value)}>
              {offers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.status} · {item.source_label ?? item.source_id} →{' '}
                  {item.target_label ?? item.target_id}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p role="status">{error}</p>}
      </div>
      <div className="inheritance-action">
        <span>ONE SHIP. ONE CONTINUING WORLD.</span>
        <strong>
          THEIR DECISIONS.
          <br />
          YOUR CONSEQUENCES.
        </strong>
        {receiving && offer?.status === 'verified' ? (
          <Button
            disabled={busy}
            onClick={() => {
              setAcceptRequested(true);
              setAcceptedWorld(preview?.world.worldId ?? '');
              void perform(() => request(`/api/handoffs/${offer.id}/accept`, {}));
            }}
          >
            Accept inherited Ark
            <Icon name="chevron" />
          </Button>
        ) : (
          <p>
            {offer
              ? 'Waiting for verified evidence and the receiver’s acceptance.'
              : 'No incoming offer. Existing worlds stay playable.'}
          </p>
        )}
        {offer && ['prepared', 'verified'].includes(offer.status) && (
          <>
            {data?.mode === 'simulation' && offer.status === 'prepared' && (
              <Button
                disabled={busy}
                onClick={() =>
                  void perform(() => request(`/api/handoffs/${offer.id}/simulate-raid`, {}))
                }
              >
                Inject simulated raid evidence
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  request(`/api/handoffs/${offer.id}/${receiving ? 'decline' : 'cancel'}`, {}),
                )
              }
            >
              {receiving ? 'Decline' : 'Cancel'} handoff
            </Button>
          </>
        )}
        <small>
          {data?.mode === 'live'
            ? 'SIGNED NATIVE EVIDENCE REQUIRED · NO CHAT SHORTCUT'
            : 'SIMULATED CUSTODY ONLY · CANNOT AUTHORIZE LIVE TRANSFER'}
        </small>
      </div>
      <div className="relay-account">
        <Button onClick={() => setMode('settings')}>CAPTAIN / ACCOUNT SETUP</Button>
      </div>
      {accepted && (
        <div className="accept-flash">
          <Brand />
          <span>COMMAND AUTHORITY ACCEPTED</span>
        </div>
      )}
    </main>
  );
}

// Every Ark keeps the vessel name; a short registry code tells saved worlds apart.
export const registry = (worldId: string) => worldId.replaceAll('-', '').slice(0, 4).toUpperCase();
export function Hangar({ setMode }: { setMode: (mode: Mode) => void }) {
  const { data, canonical, busy, perform, launch, setArchiveWorld } = useGame();
  const [selected, setSelected] = useState(''),
    [record, setRecord] = useState<WorldPresentation | null>(null),
    [error, setError] = useState('');
  const worlds = data?.worlds ?? [];
  const id = worlds.some((item) => item.id === selected)
    ? selected
    : (canonical?.worldId ?? worlds[0]?.id);
  const summary = worlds.find((item) => item.id === id);
  useEffect(() => {
    let active = true;
    setRecord(null);
    setError('');
    if (id === canonical?.worldId) {
      setRecord(canonical);
      return;
    }
    if (id)
      void request<WorldPresentation>(`/api/worlds/${encodeURIComponent(id)}/view`)
        .then((next) => {
          if (active) setRecord(next);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, canonical]);
  return (
    <main className="platform-page hangar-page">
      <div className="platform-title">
        <span className="eyebrow">WORLD LIBRARY / {worlds.length} VESSELS</span>
        <strong>THE HANGAR</strong>
        <p>
          Every Ark is a continuing world with its own custodians, obligations and physical history.
        </p>
      </div>
      <section className="hangar-layout">
        <div className="world-list">
          {worlds.map((item, index) => (
            <Button
              key={item.id}
              className={id === item.id ? 'active' : ''}
              onClick={() => setSelected(item.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <b>
                  ARK·{registry(item.id)} /{' '}
                  {item.chapter === 0 ? 'PRE-LAUNCH' : `CHAPTER ${item.chapter}`}
                </b>
                <strong>
                  {item.outcome
                    ? ({ colony: 'COLONY', partial: 'PARTIAL LANDING', wreck: 'WRECK' }[
                        item.outcome
                      ] ?? item.outcome.toUpperCase())
                    : item.parked
                      ? 'PARKED'
                      : 'ACTIVE'}
                </strong>
                <small>
                  {id === record?.worldId ? `HULL ${record.resources.hull}%` : 'SELECT TO INSPECT'}
                </small>
              </div>
              <Icon name="chevron" />
            </Button>
          ))}
          <Button
            className="new-world"
            disabled={busy || (!!canonical && !canonical.outcome)}
            onClick={() => {
              if (!data?.me) launch();
              else void perform(() => request('/api/worlds', {}));
            }}
          >
            <span>＋</span>
            <div>
              <strong>CREATE NEW WORLD</strong>
              <small>
                {canonical && !canonical.outcome
                  ? 'PARK THE ACTIVE ARK FIRST'
                  : 'BEGIN WITH 216 PASSENGERS'}
              </small>
            </div>
          </Button>
        </div>
        <div className="hangar-bay">
          <div className="bay-label">
            <span>DIGITAL VESSEL TWIN</span>
            <b>{record ? `ARK·${registry(record.worldId)}` : 'NO WORLD SELECTED'}</b>
          </div>
          <ArkShip
            navigation={record?.resources.navigation ?? 100}
            presentation={record ?? undefined}
            selected={record?.resources.navigation === 0 ? 'bridge' : 'cryo'}
          />
        </div>
        <aside className="world-inspector">
          <span className="eyebrow">SELECTED WORLD</span>
          <strong>{record?.title ?? 'AWAITING DEPARTURE'}</strong>
          <small>
            {record
              ? `${record.chapter === 0 ? 'Pre-launch' : `Chapter ${record.chapter}`} · ${record.phase.replaceAll('-', ' ')}`
              : 'Create or resume an Ark'}
          </small>
          <div className="inspector-data">
            <div>
              <span>CUSTODIAN</span>
              <b>{record?.host ?? data?.me?.label ?? '—'}</b>
            </div>
            <div>
              <span>CHAPTER</span>
              <b>{record?.chapter ?? '—'}</b>
            </div>
            <div>
              <span>HULL</span>
              <b>{record ? `${record.resources.hull}%` : '—'}</b>
            </div>
            <div>
              <span>NAVIGATION</span>
              <b>{record ? `${record.resources.navigation}%` : '—'}</b>
            </div>
          </div>
          <div className="scar-summary">
            <span>PERMANENT SCARS</span>
            <p>
              {record
                ? record.systems
                    .flatMap((system) =>
                      system.marks.map((mark) => `${systemLabels[system.id]}: ${mark.kind}`),
                    )
                    .join(' · ') || 'No recorded damage.'
                : 'No invented world or history is shown.'}
            </p>
          </div>
          {error && <p role="alert">{error}</p>}
          {record && (
            <>
              <Button
                className="platform-primary"
                disabled={busy}
                onClick={() => {
                  if (record.outcome) {
                    setArchiveWorld(record);
                    setMode('archive');
                  } else if (summary?.parked)
                    void perform(async () => {
                      await request(`/api/worlds/${record.worldId}/hosting`, { resume: true });
                      setMode('mission');
                    });
                  else setMode('mission');
                }}
              >
                {record.outcome ? 'OPEN MEMORIAL' : 'RESUME WORLD'}
                <Icon name="chevron" />
              </Button>
              <Button
                onClick={() => {
                  setArchiveWorld(record);
                  setMode('archive');
                }}
              >
                Read saved Chronicle
              </Button>
            </>
          )}
        </aside>
      </section>
      {!data?.me && <AccountPanel />}
    </main>
  );
}

export function BroadcastStudio() {
  const { data, canonical, overlayUrl, makeOverlay, busy, perform } = useGame();
  const [preset, setPreset] = useState<'dock' | 'expedition' | 'auto'>('dock'),
    [step, setStep] = useState(1),
    [copied, setCopied] = useState(false);
  const integration = data?.integration,
    details = integration?.details;
  const privateUrl = overlayUrl
    ? overlayUrl.replace(
        '/#',
        preset === 'dock' ? '/?view=compact#' : preset === 'auto' ? '/?view=auto#' : '/#',
      )
    : '';
  const health = [
    ['BOT PERMISSION', integration?.botAuthorized ? 'AUTHORIZED' : 'PENDING'],
    ['EVENTSUB', details?.chatReady ? 'CHAT READY' : 'PENDING'],
    ['NATIVE RAID', details?.raidReady ? 'SUBSCRIBED · NOT LIVE PROOF' : 'PENDING'],
    ['OVERLAY ACCESS', overlayUrl ? 'GENERATED' : 'NOT GENERATED'],
    [
      'BOT REPLIES',
      integration?.botRepliesEnabled === false ? 'PAUSED · OPTIONAL' : 'SEPARATE VERIFICATION',
    ],
  ];
  return (
    <main className="platform-page broadcast-page">
      <div className="platform-title">
        <span className="eyebrow">
          CREATOR OPERATIONS / {data?.mode === 'live' ? 'TWITCH' : 'SAVED PRACTICE'}
        </span>
        <strong>BROADCAST STUDIO</strong>
        <p>Configure Twitch, OBS and captain-only controls without interrupting the stream.</p>
      </div>
      <section className="broadcast-grid">
        <div className="setup-column">
          <div className="connection-card">
            <div className={`connection-orb ${data?.me ? 'online' : ''}`}>
              <span />
            </div>
            <div>
              <span>{data?.mode === 'live' ? 'TWITCH BROADCASTER' : 'SIMULATED CAPTAIN'}</span>
              <strong>{data?.me?.label ?? 'NOT CONNECTED'}</strong>
              <small>
                {data?.mode === 'live'
                  ? details?.chatReady
                    ? 'SIGNED CHAT SUBSCRIBED'
                    : 'CONFIGURATION / ACCEPTANCE PENDING'
                  : 'NO TWITCH MESSAGES SENT'}
              </small>
            </div>
            {!data?.me && (
              <a href={data?.mode === 'live' ? '/auth/twitch' : '?screen=awakening'}>CONNECT</a>
            )}
          </div>
          <div className="setup-steps">
            {[
              'Connect broadcaster',
              'Authorize dedicated bot',
              'Select overlay preset',
              'Copy OBS source',
              'Verify real delivery',
            ].map((label, index) => (
              <Button
                key={label}
                className={step === index + 1 ? 'active' : ''}
                onClick={() => setStep(index + 1)}
              >
                <b>0{index + 1}</b>
                <span>{label}</span>
                <small>
                  {index === 0 && data?.me
                    ? 'CONNECTED'
                    : index === 1 && integration?.botAuthorized
                      ? 'AUTHORIZED'
                      : index === 3 && overlayUrl
                        ? 'READY'
                        : 'REVIEW'}
                </small>
              </Button>
            ))}
          </div>
          <div className="studio-actions">
            <Button disabled={busy || !data?.me} onClick={makeOverlay}>
              Generate / rotate private OBS source
              <Icon name="chevron" />
            </Button>
            {data?.mode === 'live' && (
              <Button
                disabled={busy || !data.me}
                onClick={() => void perform(() => request('/api/twitch/reconcile', {}))}
              >
                Check / repair Twitch subscriptions
              </Button>
            )}
          </div>
          {privateUrl && (
            <div className="private-source">
              <label>
                Private OBS source
                <input
                  type="password"
                  readOnly
                  value={privateUrl}
                  aria-label="Private OBS source"
                />
              </label>
              <Button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(privateUrl)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }
              >
                {copied ? 'COPIED' : 'COPY SOURCE'}
              </Button>
              <a href={privateUrl} target="_blank" rel="noreferrer">
                Open read-only overlay
              </a>
              <p>
                Private access link. Rotating it ends previous access. Keep it out of screenshots
                and chat.
              </p>
            </div>
          )}
          <AccountPanel />
        </div>
        <div className="obs-preview">
          <div className="preview-header">
            <span>OBS PREVIEW / CANONICAL ARK</span>
            <div>
              {(['dock', 'expedition', 'auto'] as const).map((item) => (
                <Button
                  key={item}
                  className={preset === item ? 'active' : ''}
                  onClick={() => {
                    setPreset(item);
                    setCopied(false);
                  }}
                >
                  {item === 'dock'
                    ? 'TACTICAL DOCK'
                    : item === 'auto'
                      ? 'AUTOMATIC'
                      : 'FULL EXPEDITION'}
                </Button>
              ))}
            </div>
          </div>
          <div className="preview-game">
            <div className="preview-world" />
            <div className={`preview-overlay preview-overlay--${preset}`}>
              <Brand compact />
              <span>{canonical?.livewire?.stake?.label ?? 'ARK STANDBY'}</span>
              <b>
                {canonical
                  ? `HULL ${canonical.resources.hull}% · O₂ ${canonical.resources.oxygen}%`
                  : 'WAITING FOR AN ARK'}
              </b>
              <i />
            </div>
          </div>
          <p>
            Layout preview. Actual OBS compatibility and broadcast readability require the source in
            OBS.
          </p>
        </div>
        <aside className="studio-health">
          <span className="eyebrow">CONNECTION HEALTH</span>
          {health.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
          <p>
            Signed deliveries: {details?.deliveries.chat ?? 0} chat ·{' '}
            {details?.deliveries.raid ?? 0} raids. Applied chat actions:{' '}
            {details?.deliveries.appliedChat ?? 0}. Native transfers:{' '}
            {details?.deliveries.custodyChanges ?? 0}.
          </p>
          {details?.reconcileError && <p role="status">{details.reconcileError}</p>}
          {details?.inbox && (
            <p>
              Input recovery: {details.inbox.pending} pending · {details.inbox.retrying} retrying ·{' '}
              {details.inbox.quarantined} quarantined.
            </p>
          )}
          {!!details?.inbox?.quarantined && (
            <Button
              disabled={busy}
              onClick={() => void perform(() => request('/api/twitch/retry-inputs', {}))}
            >
              Retry quarantined chat in the current window
            </Button>
          )}
          <p>
            Subscription health is separate from genuine game changes, visible replies and native
            raid acceptance.
          </p>
        </aside>
      </section>
    </main>
  );
}

function ChronicleRecords({ world }: { world: WorldPresentation }) {
  const { record, error, loading, load } = useWorldHistory(world.worldId);
  const [selected, setSelected] = useState('');
  // Lineage nodes can point at events older than the loaded page; keep the chosen one visible.
  const [pinned, setPinned] = useState<RecordedWorldEvent | null>(null);
  useEffect(() => {
    if (record && world.gameVersion > record.throughSequence && !loading) void load('refresh');
  }, [world.gameVersion, record?.throughSequence, loading]);
  const event =
    record?.events.find((item) => item.id === selected) ??
    (pinned?.id === selected ? pinned : undefined) ??
    record?.events[0];
  return (
    <>
      <SeasonRecord world={world} />
      <section className="archive-layout">
        <div className="archive-ship">
          <ArkShip
            mini
            navigation={world.resources.navigation}
            presentation={world}
            selected="bridge"
          />
          <div className="scar-legend">
            <span>{world.systems.reduce((sum, s) => sum + s.marks.length, 0)} PERMANENT MARKS</span>
            <b>
              CHAPTER {world.chapter} / {world.phase}
            </b>
          </div>
          <PhysicalSystems world={world} />
        </div>
        <div className="timeline" aria-label="Saved world events">
          {record?.events.map((item) => (
            <Button
              key={item.id}
              className={event?.id === item.id ? 'active' : ''}
              onClick={() => setSelected(item.id)}
            >
              <span>CH. {item.chapter}</span>
              <i />
              <div>
                <strong>{item.summary}</strong>
                <small>
                  {new Date(item.at).toLocaleString()} · {item.community.label}
                </small>
              </div>
            </Button>
          ))}
          {record?.nextCursor !== null && record && (
            <Button disabled={loading} onClick={() => void load()}>
              Load earlier events
            </Button>
          )}
          <Button disabled={loading} onClick={() => void load('refresh')}>
            Refresh Chronicle
          </Button>
          {loading && <p role="status">Loading saved record…</p>}
          {error && <p role="alert">{error}</p>}
        </div>
        <aside className="event-record">
          <span className="eyebrow">
            {event ? `CH. ${event.chapter} / CONSEQUENCE RECORD` : 'FLIGHT RECORDER'}
          </span>
          <strong>{event?.summary ?? 'No events loaded'}</strong>
          <b>{event?.community.label ?? world.host}</b>
          <p>{event ? new Date(event.at).toLocaleString() : 'Saved history appears here.'}</p>
          <div className="record-delta">
            {event &&
              Object.entries(event.resourceDelta).map(([key, value]) => (
                <span key={key}>
                  {key}
                  <b>
                    {value! > 0 ? '+' : ''}
                    {value}
                  </b>
                </span>
              ))}
          </div>
          {event?.causes.length ? (
            <div className="cause-links">
              <span>INHERITED CAUSES</span>
              {event.causes.map((cause) => {
                const found = record?.events.find((item) => item.id === cause);
                return found ? (
                  <Button key={cause} onClick={() => setSelected(cause)}>
                    Read cause: {found.summary}
                  </Button>
                ) : (
                  <Button
                    key={cause}
                    disabled={loading || record?.nextCursor === null}
                    onClick={() => void load()}
                  >
                    Load earlier cause record
                  </Button>
                );
              })}
            </div>
          ) : null}
          <div className="custody-chain">
            <span>CUSTODY CHAIN</span>
            {record?.custody.length ? (
              record.custody.map((step) => (
                <p key={step.id}>
                  {step.source.label} → {step.target.label}
                  <small>
                    {step.mode === 'live'
                      ? 'NATIVE EVIDENCE / RECEIVER CONSENT'
                      : 'SIMULATED TRANSFER'}{' '}
                    · {new Date(step.at).toLocaleString()}
                  </small>
                </p>
              ))
            ) : (
              <p>No custody changes recorded.</p>
            )}
            {record?.nextCustodyCursor && (
              <Button disabled={loading} onClick={() => void load('custody')}>
                Load earlier custody
              </Button>
            )}
          </div>
        </aside>
      </section>
      <section className="lineage-panel" aria-label="Lineage across communities">
        <div className="section-label">
          <span>LINEAGE · WHO CAUSED WHAT</span>
          <small>HOVER TO TRACE A CONSEQUENCE · SELECT TO READ ITS RECORD</small>
        </div>
        <Lineage
          world={world}
          onSelect={(item) => {
            setPinned(item);
            setSelected(item.id);
            document.querySelector('.event-record')?.scrollIntoView({ block: 'nearest' });
          }}
        />
      </section>
    </>
  );
}
export function Archive() {
  const { canonical, archiveWorld, setMode } = useGame();
  const world =
    archiveWorld?.worldId === canonical?.worldId ? canonical : (archiveWorld ?? canonical);
  return (
    <main className="platform-page archive-page">
      <div className="platform-title">
        <span className="eyebrow">ARK / IMMUTABLE VOYAGE RECORD</span>
        <strong>WORLD CHRONICLE</strong>
        <p>The ship remembers every custodian, sacrifice, repair and unresolved obligation.</p>
      </div>
      {world ? (
        <ChronicleRecords key={world.worldId} world={world} />
      ) : (
        <div className="empty-platform">
          <p>No selected Ark. Choose a saved world from the Hangar.</p>
          <Button className="platform-primary" onClick={() => setMode('hangar')}>
            Open Hangar
          </Button>
        </div>
      )}
    </main>
  );
}

const codexEntries = [
  [
    '01',
    'Command Authority',
    'The captain commits irreversible decisions. Chat investigates, solves, allocates and votes. Viewers and overlays never gain captain authority.',
  ],
  [
    '02',
    'Crisis Anatomy',
    'Each authored chapter can include investigation, a shared challenge, repair allocation and a frozen decision. The captain commits the consequence. Server clocks can be manual or timed.',
  ],
  [
    '03',
    'Resource Doctrine',
    'Hull, oxygen, power, navigation and supplies constrain survival. Physical system losses, repairs and sacrifices remain in canonical history. Navigation loss changes later choices; fatal hull, oxygen or passenger loss ends the voyage.',
  ],
  [
    '04',
    'Livewire Protocol',
    'Lock a target before the real gaming attempt. The streamer attests its result. A mission costs one supply, allows one opening per chapter boundary and grants at most +3 repair or −6 damage, stopping at one. Lost systems cannot be resurrected.',
  ],
  [
    '05',
    'Relay & Custody',
    'A prepared source offer, authentic native Twitch raid evidence and receiving consent transfer the exact Ark. Practice evidence cannot authorize a live transfer.',
  ],
];
export function Codex() {
  const [entry, setEntry] = useState(0);
  const { canonical } = useGame();
  return (
    <main className="platform-page codex-page">
      <div className="platform-title">
        <span className="eyebrow">CAPTAIN'S FIELD MANUAL / LIVEWIRE v0</span>
        <strong>THE CODEX</strong>
        <p>
          Operating doctrine for a persistent generation vessel controlled by creators and their
          communities.
        </p>
      </div>
      <section className="codex-layout">
        <nav>
          {codexEntries.map((item, index) => (
            <Button
              key={item[0]}
              className={entry === index ? 'active' : ''}
              onClick={() => setEntry(index)}
            >
              <span>{item[0]}</span>
              <strong>{item[1]}</strong>
              <Icon name="chevron" />
            </Button>
          ))}
        </nav>
        <article>
          <span className="eyebrow">PROTOCOL / {codexEntries[entry][0]}</span>
          <strong>{codexEntries[entry][1]}</strong>
          <p>{codexEntries[entry][2]}</p>
          <div className="codex-diagram">
            <div className="diagram-core">ARK—001</div>
            {['AUDIENCE', 'CAPTAIN', 'WORLD STATE', 'NEXT CUSTODIAN'].map((label, i) => (
              <div key={label} className={`diagram-node node-${i}`}>
                {label}
              </div>
            ))}
          </div>
          <div className="command-reference">
            <span>QUICK COMMAND REFERENCE</span>
            <code>!scan A</code>
            <code>!route S A C T</code>
            <code>!patch A</code>
            <code>!allocate 1 0</code>
            <code>!vote 1</code>
            <code>!stake 2</code>
            <small>
              Use the displayed legal command during its open window. Bot replies are optional.
            </small>
          </div>
        </article>
        <aside>
          <span className="eyebrow">FIVE-CHAPTER SEASON</span>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index}>
              <b>0{index + 1}</b>
              <span>
                {canonical?.chapter === index + 1 ? canonical.title : `Chapter ${index + 1}`}
              </span>
              <small>
                {canonical && canonical.chapter > index + 1
                  ? 'RECORDED'
                  : canonical?.chapter === index + 1
                    ? 'CURRENT'
                    : 'AHEAD'}
              </small>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}

export function Simulator({ setMode }: { setMode: (mode: Mode) => void }) {
  const { data } = useGame();
  return (
    <main className="platform-page simulator-page">
      <div className="simulation-banner">
        {data?.mode === 'simulation'
          ? 'SAVED SIMULATION / NO TWITCH MESSAGES'
          : 'LIVE MODE / PRACTICE INPUTS DISABLED'}
      </div>
      <div className="platform-title">
        <span className="eyebrow">JUDGE ARENA / REAL SAVED GAMEPLAY</span>
        <strong>THE RELAY REHEARSAL</strong>
        <p>
          Two practice communities, one Ark. Watch one crew&rsquo;s decision become the next
          crew&rsquo;s crisis. Every step runs the real engine, database and custody rules; no
          Twitch messages are sent.
        </p>
      </div>
      {data?.mode === 'simulation' ? (
        <>
          <Rehearsal setMode={setMode} />
          <section className="rehearsal-extras" aria-label="More practice">
            <Button onClick={() => setMode('livewire')}>
              <b>BONUS</b>
              <span>Open a LIVEWIRE mission between chapters</span>
              <Icon name="chevron" />
            </Button>
            <Button onClick={() => setMode('mission')}>
              <b>FREE PLAY</b>
              <span>Fly the current Ark yourself in Mission Control</span>
              <Icon name="chevron" />
            </Button>
            <details className="rehearsal-tools">
              <summary>Practice identities and chat</summary>
              <AccountPanel />
              <PracticeChat />
            </details>
          </section>
        </>
      ) : (
        <div className="empty-platform">
          <p>
            This deployment runs genuine Twitch worlds, so practice identities and simulated raid
            evidence are refused. Use a simulation deployment for the guided rehearsal.
          </p>
          <Button className="platform-primary" onClick={() => setMode('mission')}>
            Open Mission Control
          </Button>
        </div>
      )}
    </main>
  );
}

export function Settings() {
  const { data, preferences, setPreferences } = useGame();
  const [tab, setTab] = useState('ACCESSIBILITY');
  const [viewport, setViewport] = useState(`${innerWidth}×${innerHeight}`);
  useEffect(() => {
    const update = () => setViewport(`${innerWidth}×${innerHeight}`);
    addEventListener('resize', update);
    return () => removeEventListener('resize', update);
  }, []);
  const options = [
    ['CINEMATIC AUDIO', 'audio', 'Short synthesized consequence cues after you enable audio.'],
    ['FULL MOTION', 'motion', 'Camera orbit, ship drift, particles and cinematic transitions.'],
    ['HIGH CONTRAST HUD', 'contrast', 'Increase panel separation and diagnostic brightness.'],
    ['CAPTIONS', 'captions', 'Keep saved consequence text visible.'],
  ] as const;
  return (
    <main className="platform-page settings-page">
      <div className="platform-title">
        <span className="eyebrow">COMMAND OS / LOCAL PROFILE</span>
        <strong>SETTINGS</strong>
        <p>Display, audio, controls, accessibility and account preferences.</p>
      </div>
      <section className="settings-layout">
        <nav>
          {['DISPLAY', 'AUDIO', 'CONTROLS', 'ACCESSIBILITY', 'ACCOUNT'].map((item, index) => (
            <Button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              <span>0{index + 1}</span>
              {item}
            </Button>
          ))}
        </nav>
        <div className="settings-panel">
          <span className="eyebrow">{tab} / INTERFACE</span>
          <strong>PLAYER EXPERIENCE</strong>
          {tab === 'ACCOUNT' ? (
            <AccountPanel />
          ) : tab === 'CONTROLS' ? (
            <>
              <p>
                Use Tab/Shift+Tab and Enter to operate the interface. Escape closes Command OS. Drag
                the ship to orbit; the cockpit lever changes only the illustration.
              </p>
              <p>
                Mobile Twitch viewers participate directly through the displayed short chat
                commands.
              </p>
            </>
          ) : (
            <>
              {options
                .filter(([, key]) => tab !== 'AUDIO' || key === 'audio')
                .map(([label, key, detail]) => (
                  <Button
                    key={key}
                    className="setting-row"
                    onClick={() => setPreferences({ ...preferences, [key]: !preferences[key] })}
                  >
                    <div>
                      <strong>{label}</strong>
                      <p>{detail}</p>
                    </div>
                    <span className={preferences[key] ? 'on' : ''}>
                      <i />
                    </span>
                  </Button>
                ))}
              <div className="scale-control">
                <div>
                  <strong>HUD TEXT SCALE</strong>
                  <small>{preferences.scale}%</small>
                </div>
                <input
                  aria-label="HUD scale"
                  type="range"
                  min="80"
                  max="130"
                  value={preferences.scale}
                  onChange={(e) =>
                    setPreferences({ ...preferences, scale: Number(e.target.value) })
                  }
                />
              </div>
            </>
          )}
        </div>
        <aside>
          <span className="eyebrow">CURRENT PROFILE</span>
          <strong>CAPTAIN / {data?.me?.label ?? 'VISITOR'}</strong>
          <div>
            <span>VIEWPORT</span>
            <b>{viewport}</b>
          </div>
          <div>
            <span>RENDERER</span>
            <b>WEBGL / R3F · FALLBACK SUPPORTED</b>
          </div>
          <div>
            <span>INPUT</span>
            <b>KEYBOARD + POINTER + TOUCH</b>
          </div>
          <div>
            <span>REDUCED MOTION</span>
            <b>{preferences.motion ? 'OFF' : 'ON'}</b>
          </div>
          <Button
            onClick={() =>
              setPreferences({
                audio: false,
                motion: !matchMedia('(prefers-reduced-motion: reduce)').matches,
                contrast: false,
                captions: true,
                scale: 100,
              })
            }
          >
            RESTORE DEFAULTS
          </Button>
        </aside>
      </section>
    </main>
  );
}
