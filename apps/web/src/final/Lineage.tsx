import { useEffect, useMemo, useState } from 'react';
import type {
  CustodyStep,
  RecordedWorldEvent,
  WorldHistoryPage,
  WorldPresentation,
} from '@torchline/contracts';
import { request } from '../api.ts';

export type HistoryLoader = (params: URLSearchParams) => Promise<WorldHistoryPage>;
// The signed-in custodian reads history through their session; a public Chronicle link supplies
// its own loader that posts the share token instead.
const sessionLoader =
  (worldId: string): HistoryLoader =>
  (params) =>
    request<WorldHistoryPage>(`/api/worlds/${encodeURIComponent(worldId)}/history?${params}`);
// The whole saved record for one world, pinned to a single sequence so later pages can never
// mix two different versions of the history.
export function useFullHistory(worldId: string, gameVersion: number, loader?: HistoryLoader) {
  const [record, setRecord] = useState<{
    events: RecordedWorldEvent[];
    custody: CustodyStep[];
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    void (async () => {
      const load = loader ?? sessionLoader(worldId);
      const first = await load(new URLSearchParams({ limit: '100' }));
      const events = [...first.events];
      const custody = [...first.custody];
      let cursor = first.nextCursor;
      let custodyCursor = first.nextCustodyCursor;
      for (let page = 0; page < 20 && (cursor !== null || custodyCursor); page++) {
        const params = new URLSearchParams({
          limit: '100',
          through: String(first.throughSequence),
        });
        if (cursor !== null) params.set('before', String(cursor));
        if (custodyCursor) params.set('custodyBefore', custodyCursor);
        const next = await load(params);
        if (cursor !== null) {
          events.push(...next.events);
          cursor = next.nextCursor;
        }
        if (custodyCursor) {
          custody.push(...next.custody);
          custodyCursor = next.nextCustodyCursor;
        }
      }
      if (active)
        setRecord({
          events: events.sort((a, b) => a.sequence - b.sequence),
          custody: custody.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
        });
    })().catch((e) => {
      if (active) setError((e as Error).message);
    });
    return () => {
      active = false;
    };
  }, [worldId, gameVersion]);
  return { record, error };
}

type Kind = 'arrival' | 'solve' | 'decision' | 'livewire';
interface LineageNode {
  id: string;
  chapter: number;
  community: { id: string; label: string };
  kind: Kind;
  title: string;
  summary: string;
  causes: string[];
  ended: boolean;
  loss: boolean;
}
const kindLabel: Record<Kind, string> = {
  arrival: 'CHAPTER ARRIVAL',
  solve: 'CREW SOLVED',
  decision: 'CAPTAIN COMMITTED',
  livewire: 'LIVEWIRE RESULT',
};

/** The events that change what later communities inherit; routine inputs stay in the log. */
export function lineageNodes(events: RecordedWorldEvent[]): LineageNode[] {
  const nodes: LineageNode[] = [];
  for (const event of events) {
    const cues = event.cues.map((cue) => cue.kind);
    const decision = event.summary.includes(': committed by ');
    const kind: Kind | null = decision
      ? 'decision'
      : cues.includes('challenge-solved')
        ? 'solve'
        : event.summary.startsWith('Streamer-attested')
          ? 'livewire'
          : cues.includes('chapter-arrived')
            ? 'arrival'
            : null;
    if (!kind || event.chapter < 1) continue;
    const title =
      kind === 'decision'
        ? event.summary.split(': committed by ')[0]
        : kind === 'arrival'
          ? event.summary.split(':')[0]
          : kind === 'livewire'
            ? event.summary.split('.')[0].replace('Streamer-attested ', 'LIVEWIRE ')
            : event.chapter === 3
              ? 'Life support restored'
              : event.chapter === 4
                ? 'Precision salvage plotted'
                : 'Relay route solved';
    nodes.push({
      id: event.id,
      chapter: event.chapter,
      community: event.community,
      kind,
      title,
      summary: event.summary,
      causes: event.causes,
      ended: cues.includes('world-ended'),
      // Only environmental arrivals are tinted as damage; nearly every commitment spends something.
      loss:
        kind === 'arrival' && Object.values(event.resourceDelta).some((value) => (value ?? 0) < 0),
    });
  }
  return nodes;
}

const COLUMN = 196;
const NODE_W = 172;
const NODE_H = 30;
const LEFT = 132;
const TOP = 46;
const clip = (text: string, length = 27) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

/**
 * Who changed this Ark, in what chapter, and which earlier decision caused each consequence.
 * Rows are communities, columns are chapters, arrows are the saved cause links, and vertical
 * markers are custody changes.
 */
export function Lineage({
  world,
  onSelect,
  loader,
}: {
  world: WorldPresentation;
  onSelect?: (event: RecordedWorldEvent) => void;
  loader?: HistoryLoader;
}) {
  const { record, error } = useFullHistory(world.worldId, world.gameVersion, loader);
  const [focus, setFocus] = useState<string | null>(null);
  const layout = useMemo(() => {
    if (!record) return null;
    const nodes = lineageNodes(record.events);
    const communities: { id: string; label: string }[] = [];
    for (const node of nodes)
      if (!communities.some((item) => item.id === node.community.id))
        communities.push(node.community);
    for (const step of record.custody)
      for (const party of [step.source, step.target])
        if (!communities.some((item) => item.id === party.id)) communities.push(party);
    const cell = new Map<string, number>();
    const rowHeight = communities.map((community) => {
      let tallest = 1;
      for (let chapter = 1; chapter <= 5; chapter++)
        tallest = Math.max(
          tallest,
          nodes.filter((n) => n.community.id === community.id && n.chapter === chapter).length,
        );
      return 34 + tallest * (NODE_H + 8);
    });
    const rowTop = rowHeight.map((_, index) =>
      rowHeight.slice(0, index).reduce((sum, height) => sum + height, TOP),
    );
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      const row = communities.findIndex((item) => item.id === node.community.id);
      const key = `${row}:${node.chapter}`;
      const slot = cell.get(key) ?? 0;
      cell.set(key, slot + 1);
      positions.set(node.id, {
        x: LEFT + (node.chapter - 1) * COLUMN + 12,
        y: rowTop[row] + 20 + slot * (NODE_H + 8),
      });
    }
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const edges = nodes.flatMap((node) =>
      node.causes
        .filter((cause) => byId.has(cause) && cause !== node.id)
        .map((cause) => ({ from: byId.get(cause)!, to: node })),
    );
    // A custody change happens at a chapter boundary: place it after the last chapter whose
    // events were saved before the transfer committed.
    const custody = record.custody.map((step) => {
      const before = record.events.filter((event) => Date.parse(event.at) <= Date.parse(step.at));
      const chapter = Math.max(1, before.at(-1)?.chapter ?? 1);
      return {
        step,
        x: LEFT + chapter * COLUMN - 2,
        from: communities.findIndex((item) => item.id === step.source.id),
        to: communities.findIndex((item) => item.id === step.target.id),
      };
    });
    const height = rowTop.at(-1)! + rowHeight.at(-1)! + 16;
    const events = new Map(record.events.map((event) => [event.id, event]));
    return { nodes, communities, rowTop, rowHeight, positions, edges, custody, height, events };
  }, [record]);
  if (error)
    return (
      <p className="lineage-empty" role="alert">
        {error}
      </p>
    );
  if (!layout) return <p className="lineage-empty">Reading the saved lineage…</p>;
  if (!layout.nodes.length)
    return (
      <p className="lineage-empty">
        No consequential decisions yet. Start chapter one; every arrival, crew solution and captain
        commitment will appear here.
      </p>
    );
  const width = LEFT + 5 * COLUMN + 16;
  const linked = new Set(
    focus
      ? layout.edges
          .filter((edge) => edge.from.id === focus || edge.to.id === focus)
          .flatMap((edge) => [edge.from.id, edge.to.id])
      : [],
  );
  return (
    <div className="lineage" aria-label="World lineage">
      <div className="lineage-legend">
        <span data-kind="decision">Captain commitment</span>
        <span data-kind="solve">Crew solution</span>
        <span data-kind="arrival">Chapter arrival</span>
        <span data-kind="livewire">LIVEWIRE result</span>
        <span data-kind="custody">Custody change</span>
      </div>
      <div className="lineage-scroll">
        <svg
          viewBox={`0 0 ${width} ${layout.height}`}
          preserveAspectRatio="xMinYMin meet"
          role="group"
          aria-label={`${layout.nodes.length} consequential events across ${layout.communities.length} communities`}
        >
          <defs>
            <marker
              id="lineage-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0 L8 4 L0 8 z" className="lineage-arrowhead" />
            </marker>
          </defs>
          {Array.from({ length: 5 }, (_, index) => (
            <g key={index} className="lineage-column">
              <rect
                x={LEFT + index * COLUMN}
                y={TOP - 30}
                width={COLUMN - 4}
                height={layout.height - TOP + 22}
              />
              <text x={LEFT + index * COLUMN + 12} y={TOP - 12}>
                CHAPTER {index + 1}
              </text>
            </g>
          ))}
          {layout.communities.map((community, row) => (
            <g key={community.id} className="lineage-row">
              <line
                x1={8}
                x2={width - 8}
                y1={layout.rowTop[row] + layout.rowHeight[row]}
                y2={layout.rowTop[row] + layout.rowHeight[row]}
              />
              <text x={10} y={layout.rowTop[row] + 30}>
                {clip(community.label, 16)}
              </text>
              <text className="lineage-row-sub" x={10} y={layout.rowTop[row] + 46}>
                {row === 0 ? 'FIRST CREW' : `RELAY ${row}`}
              </text>
            </g>
          ))}
          {layout.custody.map(({ step, x, from, to }) =>
            from < 0 || to < 0 ? null : (
              <g key={step.id} className="lineage-custody" data-mode={step.mode}>
                <line
                  x1={x}
                  x2={x}
                  y1={layout.rowTop[from] + 26}
                  y2={layout.rowTop[to] + 26}
                  markerEnd="url(#lineage-arrow)"
                />
                <text x={x + 6} y={(layout.rowTop[from] + layout.rowTop[to]) / 2 + 30}>
                  {step.mode === 'live' ? 'NATIVE RAID' : 'SIMULATED RELAY'}
                </text>
              </g>
            ),
          )}
          {layout.edges.map(({ from, to }) => {
            const a = layout.positions.get(from.id)!,
              b = layout.positions.get(to.id)!;
            const sx = a.x + NODE_W,
              sy = a.y + NODE_H / 2,
              ex = b.x - 2,
              ey = b.y + NODE_H / 2;
            const bend = Math.max(40, Math.abs(ex - sx) / 2);
            const path =
              ex > sx
                ? `M${sx} ${sy} C${sx + bend} ${sy}, ${ex - bend} ${ey}, ${ex} ${ey}`
                : `M${a.x + NODE_W / 2} ${a.y + NODE_H} C${a.x + NODE_W / 2} ${a.y + NODE_H + 40}, ${b.x + NODE_W / 2} ${b.y - 40}, ${b.x + NODE_W / 2} ${b.y}`;
            return (
              <path
                key={`${from.id}>${to.id}`}
                d={path}
                className={`lineage-edge lineage-edge--${from.kind} ${
                  focus && (linked.has(from.id) && linked.has(to.id) ? 'is-focus' : 'is-dim')
                }`}
                markerEnd="url(#lineage-arrow)"
              />
            );
          })}
          {layout.nodes.map((node) => {
            const position = layout.positions.get(node.id)!;
            return (
              <g
                key={node.id}
                className={`lineage-node ${focus && !linked.has(node.id) && focus !== node.id ? 'is-dim' : ''}`}
                data-kind={node.kind}
                data-loss={node.loss || undefined}
                data-ended={node.ended || undefined}
                transform={`translate(${position.x} ${position.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${kindLabel[node.kind]}, chapter ${node.chapter}, ${node.community.label}: ${node.summary}`}
                onMouseEnter={() => setFocus(node.id)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(node.id)}
                onBlur={() => setFocus(null)}
                onClick={() => onSelect?.(layout.events.get(node.id)!)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect?.(layout.events.get(node.id)!);
                  }
                }}
              >
                <title>{node.summary}</title>
                <path
                  d={`M0 0 H${NODE_W - 8} L${NODE_W} 8 V${NODE_H} H8 L0 ${NODE_H - 8} Z`}
                  className="lineage-chip"
                />
                <text x={10} y={12} className="lineage-kind">
                  {kindLabel[node.kind]}
                </text>
                <text x={10} y={25} className="lineage-title">
                  {clip(node.title)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const endingTitle = {
  colony: 'A NEW HOME',
  partial: 'SURVIVORS REACH LAND',
  wreck: 'THE ARK IS LOST',
};

/**
 * The season's closing record: how the voyage ended and what each community contributed. It
 * reads only saved events; nothing here is scored or invented.
 */
export function SeasonRecord({
  world,
  loader,
}: {
  world: WorldPresentation;
  loader?: HistoryLoader;
}) {
  const { record } = useFullHistory(world.worldId, world.gameVersion, loader);
  const nodes = record ? lineageNodes(record.events) : [];
  const crews: {
    community: { id: string; label: string };
    chapters: number[];
    decisions: LineageNode[];
    solved: number;
  }[] = [];
  for (const node of nodes) {
    let crew = crews.find((item) => item.community.id === node.community.id);
    if (!crew) {
      crew = { community: node.community, chapters: [], decisions: [], solved: 0 };
      crews.push(crew);
    }
    if (!crew.chapters.includes(node.chapter)) crew.chapters.push(node.chapter);
    if (node.kind === 'decision') crew.decisions.push(node);
    if (node.kind === 'solve') crew.solved++;
  }
  return (
    <section
      className={`season-record ${world.outcome ? `season-record--${world.outcome}` : ''}`}
      aria-label={world.outcome ? 'Season record' : 'Crew ledger'}
    >
      <header>
        <span className="eyebrow">
          {world.outcome ? 'SEASON RECORD / VOYAGE COMPLETE' : 'CREW LEDGER / VOYAGE IN PROGRESS'}
        </span>
        <strong>
          {world.outcome ? endingTitle[world.outcome] : `CHAPTER ${world.chapter} OF 5`}
        </strong>
        <p>
          {world.outcome
            ? world.endingReason
            : 'Every community that has commanded this Ark, and what it decided. The voyage is still open.'}
        </p>
        <div className="season-resources">
          {(
            [
              ['PASSENGERS', world.resources.passengers, ''],
              ['HULL', world.resources.hull, '%'],
              ['OXYGEN', world.resources.oxygen, '%'],
              ['POWER', world.resources.power, '%'],
              ['NAVIGATION', world.resources.navigation, '%'],
              ['SUPPLIES', world.resources.supplies, ''],
            ] as const
          ).map(([name, value, unit]) => (
            <div key={name}>
              <span>{name}</span>
              <b>
                {value}
                {unit}
              </b>
            </div>
          ))}
        </div>
      </header>
      <ol className="season-crews">
        {crews.map((crew) => (
          <li key={crew.community.id}>
            <span>CH. {crew.chapters.sort((a, b) => a - b).join(' · ')}</span>
            <strong>{crew.community.label}</strong>
            <p>
              {crew.decisions.length
                ? crew.decisions.map((node) => node.title).join(' → ')
                : 'No captain commitment yet'}
            </p>
            <small>
              {crew.solved
                ? `${crew.solved} shared ${crew.solved === 1 ? 'challenge' : 'challenges'} solved by the crew`
                : 'No shared challenge solved'}
            </small>
          </li>
        ))}
        {!crews.length && <li className="season-crews-empty">No saved commitments yet.</li>}
      </ol>
    </section>
  );
}
