import type { Resources, ShipSystem, SystemId } from '@torchline/contracts';
export const systemLabels: Record<SystemId, string> = {
  hull: 'Hull',
  navigation: 'Navigation',
  lifeSupport: 'Life support',
  shields: 'Shields',
  cargo: 'Cargo',
  habitat: 'Habitat',
  reactor: 'Reactor',
};
export const conditionColor = (system: ShipSystem) =>
  system.condition === 'destroyed' || system.integrity <= 25
    ? '#d5533e'
    : system.condition === 'sealed'
      ? '#df9d47'
      : system.integrity < 60
        ? '#df9d47'
        : ['repaired', 'jury-rigged'].includes(system.condition)
          ? '#76c6c5'
          : '#73796f';
// Stable placement from canonical event IDs; reload and custody changes preserve scars.
export function markSeed(eventId: string): number {
  let hash = 2166136261;
  for (const char of eventId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
export function shipDescription(systems: ShipSystem[], resources: Resources) {
  return `Ark hull ${resources.hull}. ${systems.map((s) => `${systemLabels[s.id]} ${s.condition}, integrity ${s.integrity} percent, ${s.marks.length} permanent marks`).join('. ')}`;
}
