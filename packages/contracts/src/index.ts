import { z } from 'zod';

export const RULES_VERSION = 'ark-v2' as const;
export const PRESENTATION_VERSION = '2026-10-26.1' as const;
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
export type Phase = 'ready' | 'challenge' | 'decision' | 'paused' | 'ended';
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
  rulesVersion: typeof RULES_VERSION;
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
}
const NodeId = z.enum(['S', 'A', 'B', 'C', 'D', 'T']);
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }).strict(),
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
  rulesVersion: typeof RULES_VERSION;
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
  rulesVersion: typeof RULES_VERSION;
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
  outcome: Ending | null;
  endingReason: string | null;
  events: Pick<WorldEvent, 'id' | 'chapter' | 'summary' | 'resourceDelta' | 'cues' | 'causes'>[];
  capabilities: {
    canStart: boolean;
    canCloseChallenge: boolean;
    canCommit: boolean;
    canPause: boolean;
    canResume: boolean;
  };
}
export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
