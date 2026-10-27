import { DomainError, RULES_VERSION, CURRENT_RULES_VERSION } from '@torchline/contracts';
import type { Actor, Command, RulesVersion, WorldEvent, WorldState } from '@torchline/contracts';
import * as v2 from './ark-v2.ts';
import * as v3 from './ark-v3.ts';
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
  return rules(version).replayEvents(id, events);
}
