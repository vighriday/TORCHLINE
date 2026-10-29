import { z } from 'zod';

export const RULES_VERSION = 'ark-v2' as const;
export const CURRENT_RULES_VERSION = 'ark-v3' as const;
export type RulesVersion = typeof RULES_VERSION | typeof CURRENT_RULES_VERSION;
export const PRESENTATION_VERSION = '2026-10-27.1' as const;
export const SYSTEM_IDS = [
  'hull',
  'navigation',
  'lifeSupport',
  'shields',
  'cargo',
  'habitat',
  'reactor',
] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];
export type ResourceId = 'passengers' | 'hull' | 'power' | 'oxygen' | 'navigation' | 'supplies';
export type Resources = Record<ResourceId, number>;
export type Ending = 'colony' | 'partial' | 'wreck';
export type Phase =
  | 'ready'
  | 'investigation'
  | 'challenge'
  | 'allocation'
  | 'decision'
  | 'awaiting-commit'
  | 'paused'
  | 'ended';
export interface CooperationState {
  budget: number;
  investigation: boolean;
  inspections: Record<string, 'engine' | 'cargo' | 'life'>;
  preferences: Record<string, { hull: number; oxygen: number }>;
  plan: { hull: number; oxygen: number };
  closedByEventId: string | null;
}
export type SystemCondition =
  'operational' | 'damaged' | 'destroyed' | 'sealed' | 'repaired' | 'jury-rigged';
export interface Actor {
  id: string;
  role: 'host' | 'viewer';
  community: string;
}
export interface PhysicalMark {
  kind: 'damage' | 'repair' | 'sacrifice' | 'seal' | 'jettison';
  eventId: string;
  chapter: number;
  community: string;
}
export interface ShipSystem {
  id: SystemId;
  integrity: number;
  condition: SystemCondition;
  marks: PhysicalMark[];
  lastEventId: string | null;
}
export interface Obligation {
  id: string;
  kind: 'blind-jump' | 'leak' | 'supply-debt';
  originEventId: string;
  dueChapter: number;
  status: 'pending' | 'applied' | 'avoided';
}
export interface ChallengeState {
  scanned: string[];
  solved: boolean;
  tasks: string[];
  contributions: Record<string, string>;
  rewardEventId: string | null;
}
export interface SystemPresentation extends ShipSystem {
  severity: 'stable' | 'compromised' | 'critical' | 'lost';
}
export interface WorldState {
  id: string;
  rulesVersion: RulesVersion;
  version: number;
  chapter: number;
  phase: Phase;
  resumePhase: Phase | null;
  window: number;
  windowOpenedAt: string | null;
  crisis: string;
  resources: Resources;
  systems: Record<SystemId, ShipSystem>;
  obligations: Obligation[];
  challenge: ChallengeState;
  votes: Record<string, string>;
  outcome: Ending | null;
  endingReason: string | null;
  cooperation?: CooperationState;
}
const NodeId = z.enum(['S', 'A', 'B', 'C', 'D', 'T']);
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }).strict(),
  z
    .object({
      type: z.literal('configure-cooperation'),
      budget: z.number().int().min(0).max(10),
      investigation: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('inspect'), area: z.enum(['engine', 'cargo', 'life']) }).strict(),
  z.object({ type: z.literal('close-investigation') }).strict(),
  z
    .object({
      type: z.literal('allocate'),
      hull: z.number().int().min(0).max(5),
      oxygen: z.number().int().min(0).max(5),
    })
    .strict()
    .refine(
      (v) => v.hull + v.oxygen >= 1 && v.hull + v.oxygen <= 5,
      'Assign one to five preference points.',
    ),
  z.object({ type: z.literal('close-allocation') }).strict(),
  z.object({ type: z.literal('close-voting') }).strict(),
  z.object({ type: z.literal('scan'), node: NodeId }).strict(),
  z.object({ type: z.literal('route'), nodes: z.array(NodeId).min(2).max(6) }).strict(),
  z.object({ type: z.literal('patch'), node: z.enum(['A', 'B', 'C']) }).strict(),
  z.object({ type: z.literal('close-challenge') }).strict(),
  z.object({ type: z.literal('vote'), option: z.string().min(1).max(40) }).strict(),
  z.object({ type: z.literal('commit'), option: z.string().min(1).max(40) }).strict(),
  z.object({ type: z.literal('pause') }).strict(),
  z.object({ type: z.literal('resume') }).strict(),
]);
export type Command = z.infer<typeof CommandSchema>;
export const CommandRequestSchema = z
  .object({
    command: CommandSchema,
    expectedVersion: z.number().int().min(0),
    commandId: z.string().min(8).max(100),
  })
  .strict();
export interface VisualCue {
  kind:
    | 'damage'
    | 'repair'
    | 'sacrifice'
    | 'discovery'
    | 'challenge-solved'
    | 'chapter-arrived'
    | 'world-ended';
  systemId?: SystemId;
  eventId: string;
}
export interface WorldEvent {
  id: string;
  worldId: string;
  sequence: number;
  rulesVersion: RulesVersion;
  commandId: string;
  command: Command;
  actor: Actor;
  at: string;
  chapter: number;
  summary: string;
  resourceDelta: Partial<Resources>;
  cues: VisualCue[];
  causes: string[];
}
export interface PuzzleGraph {
  kind: 'route' | 'work-order';
  title: string;
  prompt: string;
  nodes: { id: string; label: string; revealed: boolean; clue: string | null; patched: boolean }[];
  edges: { from: string; to: string; cost: number }[];
  budget: number;
  requiredNode: string | null;
  blockedNode: string | null;
  scanned: string[];
  solved: boolean;
  tasks: string[];
  reward: string;
}
export interface ChoicePresentation {
  id: string;
  label: string;
  description: string;
  available: boolean;
  unavailableReason: string | null;
  preview: { resources: Resources; outcome: Ending | null; warnings: string[] } | null;
}
export interface WorldPresentation {
  schemaVersion: typeof PRESENTATION_VERSION;
  worldId: string;
  worldVersion: number;
  rulesVersion: RulesVersion;
  mode: 'simulation' | 'live';
  host: string;
  gameVersion: number;
  handoffPending: boolean;
  chapter: number;
  phase: Phase;
  title: string;
  recap: string;
  resources: Resources;
  systems: SystemPresentation[];
  obligations: Obligation[];
  challenge: PuzzleGraph | null;
  choices: ChoicePresentation[];
  votes: Record<string, number>;
  participantCount: number;
  cooperation?: {
    budget: number;
    investigation: boolean;
    inspections: Record<string, number>;
    allocations: number;
    plan: { hull: number; oxygen: number };
    closed: boolean;
  };
  clock?: {
    deadlineAt: string | null;
    remainingMs: number | null;
    serverAt: string;
    recoveryReason: string | null;
  };
  outcome: Ending | null;
  endingReason: string | null;
  events: Pick<WorldEvent, 'id' | 'chapter' | 'summary' | 'resourceDelta' | 'cues' | 'causes'>[];
  capabilities: {
    canStart: boolean;
    canCloseChallenge: boolean;
    canCommit: boolean;
    canPause: boolean;
    canResume: boolean;
    canCloseInvestigation?: boolean;
    canCloseAllocation?: boolean;
    canCloseVoting?: boolean;
  };
}
export interface TwitchIntegrationStatus {
  inbox?: { pending: number; retrying: number; quarantined: number; oldestAt: string | null };
  botAuthorized: boolean;
  chatReady: boolean;
  raidReady: boolean;
  lastReconciledAt: string | null;
  reconcileError: string | null;
  botReplies: { pending: number; sent: number; failed: number; uncertain: number };
  lastBotReply?: { status: string; code: string | null; at: string } | null;
  subscriptions: { type: string; status: string; current: boolean; providerConfirmed: boolean }[];
  deliveries: {
    challenge: number;
    chat: number;
    raid: number;
    appliedChat: number;
    custodyChanges: number;
  };
}
export interface RecordedWorldEvent {
  id: string;
  sequence: number;
  chapter: number;
  at: string;
  community: { id: string; label: string };
  summary: string;
  resourceDelta: Partial<Resources>;
  cues: VisualCue[];
  causes: string[];
}
export interface CustodyStep {
  id: string;
  at: string;
  source: { id: string; label: string };
  target: { id: string; label: string };
  mode: 'simulation' | 'live';
}
export interface WorldHistoryPage {
  schemaVersion: 'world-records-2026-10-27.1';
  worldId: string;
  throughSequence: number;
  events: RecordedWorldEvent[];
  nextCursor: number | null;
  custody: CustodyStep[];
  nextCustodyCursor: string | null;
}
export interface HandoffPreview {
  schemaVersion: 'world-records-2026-10-27.1';
  intentId: string;
  status: 'prepared' | 'verified';
  expiresAt: string;
  source: { id: string; label: string };
  target: { id: string; label: string };
  world: WorldPresentation;
}
export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
