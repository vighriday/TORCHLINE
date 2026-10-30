import { DomainError, RULES_VERSION, CURRENT_RULES_VERSION } from '@torchline/contracts';
import type { Actor, Command, RulesVersion, WorldEvent, WorldState } from '@torchline/contracts';
import * as v2 from './ark-v2.ts';
import * as v3 from './ark-v3.ts';
import { applyLivewire, livewireUnresolved } from './livewire.ts';
import { LivewireCommandSchema } from '@torchline/contracts';
export { livewireOptions, livewireUnresolved } from './livewire.ts';
export {
  INITIAL_RESOURCES,
  TITLES,
  getChoices,
  puzzleRules,
  routeError,
  routeSolutions,
} from './ark-v2.ts';
export { normalizeAllocation } from './ark-v3.ts';
const legacyCommands = new Set([
  'start',
  'scan',
  'route',
  'patch',
  'close-challenge',
  'vote',
  'commit',
  'pause',
  'resume',
]);
function rules(version: RulesVersion) {
  if (version === RULES_VERSION) return v2;
  if (version === CURRENT_RULES_VERSION) return v3;
  throw new DomainError('RULES_VERSION', 'Unsupported immutable world rules.');
}
// Historical default stays stable for fixtures. Storage explicitly selects current rules.
export function createWorld(id: string, version: RulesVersion = RULES_VERSION) {
  return rules(version).createWorld(id);
}
export function applyCommand(
  state: WorldState,
  command: Command,
  actor: Actor,
  context: { commandId: string; at: string },
) {
  if (command.type.startsWith('livewire-'))
    return applyLivewire(state, LivewireCommandSchema.parse(command), actor, context);
  if (livewireUnresolved(state))
    throw new DomainError(
      'LIVEWIRE_PENDING',
      'Resolve or cancel the mission before continuing the chapter.',
    );
  if (state.rulesVersion === RULES_VERSION && !legacyCommands.has(command.type))
    throw new DomainError(
      'RULES_VERSION',
      'This command requires a new ark-v3 world. Existing Ark rules remain unchanged.',
    );
  return rules(state.rulesVersion).applyCommand(state, command, actor, context);
}
export function getPuzzle(state: WorldState) {
  return rules(state.rulesVersion).getPuzzle(state);
}
export function previewChoices(state: WorldState) {
  return rules(state.rulesVersion).previewChoices(state);
}
export function replayEvents(
  id: string,
  events: WorldEvent[],
  version: RulesVersion = events[0]?.rulesVersion ?? RULES_VERSION,
) {
  if (
    events.some(
      (event) =>
        event.extensionVersion === 'livewire-v0' || event.command.type.startsWith('livewire-'),
    )
  ) {
    let state = createWorld(id, version);
    const canonical = (value: unknown): string =>
      Array.isArray(value)
        ? `[${value.map(canonical).join(',')}]`
        : value !== null && typeof value === 'object'
          ? `{${Object.keys(value)
              .sort()
              .map(
                (key) =>
                  `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
              )
              .join(',')}}`
          : JSON.stringify(value);
    for (const event of events) {
      if (
        event.worldId !== id ||
        event.rulesVersion !== version ||
        event.sequence !== state.version + 1
      )
        throw new DomainError(
          'REPLAY_SEQUENCE',
          'Event history has a gap or incompatible version.',
        );
      const next = applyCommand(state, event.command, event.actor, {
        commandId: event.commandId,
        at: event.at,
      });
      if (canonical(next.event) !== canonical(event))
        throw new DomainError('REPLAY_MISMATCH', 'Stored effects do not match pinned rules.');
      state = next.state;
    }
    return state;
  }
  return rules(version).replayEvents(id, events);
}
