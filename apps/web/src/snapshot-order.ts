import type { DashboardSnapshot } from './api.ts';

// Assignment epochs are durable PostgreSQL bigint strings. World revisions only
// have meaning within one world; mission ballots have their own revision.
export function orderedSnapshot(
  previous: DashboardSnapshot | null,
  next: DashboardSnapshot,
): DashboardSnapshot {
  if (next.channelEpoch !== undefined && !/^\d+$/.test(next.channelEpoch))
    throw Error('Invalid saved channel version. Reconnect to refresh.');
  if (!previous || previous.mode !== next.mode || previous.me?.id !== next.me?.id) return next;
  if (previous.channelEpoch !== undefined && next.channelEpoch === undefined) return previous;
  if (previous.channelEpoch !== undefined && next.channelEpoch !== undefined) {
    const before = BigInt(previous.channelEpoch),
      after = BigInt(next.channelEpoch);
    if (after < before) return previous;
    if (after > before) return next;
    if (previous.world?.worldId !== next.world?.worldId) return previous;
  }
  const before = previous.world,
    after = next.world;
  if (before && after && before.worldId === after.worldId) {
    if (after.worldVersion < before.worldVersion) return previous;
    if (
      after.worldVersion === before.worldVersion &&
      after.livewire?.stake?.id === before.livewire?.stake?.id &&
      (after.livewire?.revision ?? 0) < (before.livewire?.revision ?? 0)
    )
      return previous;
  }
  return next;
}
