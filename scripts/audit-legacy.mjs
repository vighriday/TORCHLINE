// Executable interpretation of the authored ark-v1 decision table, not production rules.
const initial = { passengers: 216, hull: 80, power: 60, oxygen: 65, navigation: 70, supplies: 50 };
function choices(chapter, s) {
  if (chapter === 1)
    return [
      ['burn-navigation', { ...s, navigation: 0 }],
      ['seal-bay', { ...s, passengers: s.passengers - 30 }],
    ];
  if (chapter === 2)
    return s.navigation === 0
      ? [
          ...(s.supplies >= 30 && s.power >= 15
            ? [
                [
                  'repair-navigation',
                  { ...s, supplies: s.supplies - 30, power: s.power - 15, navigation: 60 },
                ],
              ]
            : []),
          ['manual-flight', { ...s, hull: s.hull - 25 }],
        ]
      : [
          ['collect', { ...s, supplies: s.supplies + 10, hull: s.hull - 10 }],
          ['pass', s],
        ];
  if (chapter === 3) {
    s = { ...s, oxygen: s.oxygen - 25 };
    return [
      ...(s.power >= 15
        ? [['repair-life', { ...s, power: s.power - 15, oxygen: Math.max(60, s.oxygen) }]]
        : []),
      ['seal-cabins', { ...s, passengers: s.passengers - 24, oxygen: Math.max(50, s.oxygen) }],
    ];
  }
  if (chapter === 4)
    return s.supplies < 25
      ? [
          ['salvage', { ...s, supplies: s.supplies + 20, hull: s.hull - 10 }],
          ['conserve', s],
        ]
      : [
          ...(s.supplies >= 10
            ? [['reinforce', { ...s, supplies: s.supplies - 10, hull: Math.min(100, s.hull + 10) }]]
            : []),
          ['conserve', s],
        ];
  return [
    ['land', s],
    ...(s.power >= 10
      ? [['burn', { ...s, power: s.power - 10, hull: Math.min(100, s.hull + 5) }]]
      : []),
  ];
}
const terminals = [];
function walk(chapter, state, path) {
  if (state.hull <= 0 || state.oxygen <= 0 || state.passengers <= 0 || chapter > 5) {
    const outcome =
      state.hull <= 0 || state.oxygen <= 0 || state.passengers <= 0
        ? 'wreck'
        : state.supplies >= 30
          ? 'colony'
          : 'partial';
    terminals.push({ path, state, outcome });
    return;
  }
  for (const [id, next] of choices(chapter, state)) walk(chapter + 1, next, [...path, id]);
}
walk(1, initial, []);
console.log(
  JSON.stringify(
    {
      rules:
        'authored ark-v1; optional allocation zero; challenge bonuses absent (bonuses cannot introduce damage)',
      terminalPaths: terminals.length,
      endings: Object.fromEntries(
        ['colony', 'partial', 'wreck'].map((kind) => [
          kind,
          terminals.filter((p) => p.outcome === kind).length,
        ]),
      ),
      minima: Object.fromEntries(
        Object.keys(initial).map((key) => [key, Math.min(...terminals.map((p) => p.state[key]))]),
      ),
    },
    null,
    2,
  ),
);
