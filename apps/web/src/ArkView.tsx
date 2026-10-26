import type { Resources, ShipSystem } from '@torchline/contracts';
export interface ArkRendererProps {
  systems: ShipSystem[];
  resources: Resources;
  reducedMotion?: boolean;
}
const labels: Record<string, string> = {
  hull: 'Hull',
  navigation: 'Navigation',
  lifeSupport: 'Life support',
  shields: 'Shields',
  cargo: 'Cargo',
  habitat: 'Habitat',
  reactor: 'Reactor',
};
const positions: Record<string, [number, number]> = {
  navigation: [100, 50],
  shields: [280, 50],
  reactor: [460, 50],
  habitat: [100, 135],
  lifeSupport: [280, 135],
  cargo: [460, 135],
};

// Reference schematic. Claude Design can replace this renderer without changing game state or API calls.
export function ArkView({ systems, resources }: ArkRendererProps) {
  return (
    <section className="panel" aria-label="Persistent Ark condition">
      <div className="section-heading">
        <h2>Ark condition</h2>
        <small>Persistent systems · reference renderer</small>
      </div>
      <svg
        viewBox="0 0 720 240"
        role="img"
        aria-label={`Ark hull ${resources.hull}. ${systems.map((s) => `${labels[s.id]} ${s.condition}`).join('. ')}`}
      >
        <path
          d="M20 120 90 30 620 30 700 120 620 210 90 210Z"
          className="ship-outline"
          data-system="hull"
          data-condition={systems.find((s) => s.id === 'hull')?.condition}
        />
        {systems
          .filter((s) => s.id !== 'hull')
          .map((system) => (
            <g
              key={system.id}
              data-system={system.id}
              data-condition={system.condition}
              className={`ship-module condition-${system.condition}`}
              transform={`translate(${positions[system.id][0]} ${positions[system.id][1]})`}
            >
              <rect width="160" height="65" rx="6" />
              <text x="10" y="24">
                {labels[system.id]}
              </text>
              <text x="10" y="47" className="system-subtitle">
                {system.condition} · {system.integrity}%
              </text>
              {system.marks.length > 0 && <path d="m140 4-12 18 14 15-12 22" className="scar" />}
            </g>
          ))}
      </svg>
      <div className="system-list">
        {systems.map((system) => (
          <div key={system.id} className="system-state">
            <strong>{labels[system.id]}</strong>
            <span>{system.condition}</span>
            <small>
              {system.marks.length} recorded {system.marks.length === 1 ? 'change' : 'changes'}
            </small>
          </div>
        ))}
      </div>
      <p className="muted">
        Repairs change current condition. Scars and their history survive chapters, saving, and
        handoffs.
      </p>
    </section>
  );
}
