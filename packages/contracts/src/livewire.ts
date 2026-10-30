import { z } from 'zod';

export const LIVEWIRE_VERSION = 'livewire-v0' as const;
export const LivewireTarget = z.enum(['navigation', 'hull', 'oxygen']);
export type LivewireTarget = z.infer<typeof LivewireTarget>;
export const LivewireText = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[\p{L}\p{N} .,!?'’():+\-]+$/u, 'Use a short plain-text label without links or markup.');
export const LivewirePreset = z.enum(['boss', 'match', 'challenge']);
const stakeId = z.string().uuid();
const counts = z.tuple([
  z.number().int().min(0).max(10000),
  z.number().int().min(0).max(10000),
  z.number().int().min(0).max(10000),
]);
export const livewireCommands = [
  z
    .object({
      type: z.literal('livewire-open'),
      stakeId,
      preset: LivewirePreset,
      game: LivewireText,
      label: LivewireText,
    })
    .strict(),
  z
    .object({
      type: z.literal('livewire-lock'),
      stakeId,
      tallies: counts,
      evidence: z.enum(['twitch_signed', 'simulation']),
      solo: LivewireTarget.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('livewire-resolve'),
      stakeId,
      outcome: z.enum(['success', 'failure']),
    })
    .strict(),
  z.object({ type: z.literal('livewire-cancel'), stakeId }).strict(),
  z.object({ type: z.literal('livewire-expire'), stakeId }).strict(),
  z
    .object({
      type: z.literal('livewire-pause'),
      stakeId,
      reason: z.enum(['restart', 'chat_unavailable', 'offline', 'disconnected']),
    })
    .strict(),
  z.object({ type: z.literal('livewire-resume'), stakeId }).strict(),
] as const;
export const LivewireCommandSchema = z.discriminatedUnion('type', livewireCommands);
export type LivewireCommand = z.infer<typeof LivewireCommandSchema>;
export const LivewireRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    commandId: z.string().min(8).max(100),
    action: z.discriminatedUnion('type', [
      z
        .object({
          type: z.literal('open'),
          preset: LivewirePreset,
          game: LivewireText,
          label: LivewireText,
        })
        .strict(),
      z.object({ type: z.literal('lock'), stakeId, solo: LivewireTarget.optional() }).strict(),
      z
        .object({ type: z.literal('resolve'), stakeId, outcome: z.enum(['success', 'failure']) })
        .strict(),
      z.object({ type: z.literal('cancel'), stakeId }).strict(),
      z.object({ type: z.literal('resume'), stakeId }).strict(),
    ]),
  })
  .strict();
export type LivewireRequest = z.infer<typeof LivewireRequestSchema>;
export interface LivewireOption {
  target: LivewireTarget;
  success: number;
  failure: number;
}
export interface LivewireStake {
  id: string;
  policy: typeof LIVEWIRE_VERSION;
  channel: string;
  author: string;
  chapter: number;
  game: string;
  label: string;
  preset: z.infer<typeof LivewirePreset>;
  status: 'open' | 'paused' | 'locked' | 'success' | 'failure' | 'cancelled' | 'expired';
  openedAt: string;
  windowOpenedAt?: string;
  deadlineAt: string | null;
  remainingMs: number | null;
  pauseReason: string | null;
  openedVersion: number;
  lockedVersion?: number;
  lockedAt?: string;
  resolvedAt?: string;
  options: LivewireOption[];
  target?: LivewireTarget;
  tallies?: [number, number, number];
  selection?: 'crew' | 'solo';
  evidence?: 'twitch_signed' | 'simulation';
  lockEventId?: string;
}
export interface LivewireState {
  policy: typeof LIVEWIRE_VERSION;
  spentChapters: number[];
  stake: LivewireStake;
}
export interface LivewirePresentation {
  enabled: boolean;
  available: boolean;
  reason: string;
  chargeAvailable: boolean;
  stake: Omit<LivewireStake, 'author' | 'channel'> | null;
  tallies: [number, number, number];
  participants: number;
  revision: number;
  lastInputAt: string | null;
  canControl: boolean;
}
