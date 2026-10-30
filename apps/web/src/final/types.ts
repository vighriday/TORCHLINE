export type Mode =
  | 'awakening'
  | 'mission'
  | 'livewire'
  | 'inheritance'
  | 'hangar'
  | 'broadcast'
  | 'archive'
  | 'codex'
  | 'simulator'
  | 'settings';
export type Sector = 'bridge' | 'cryo' | 'reactor' | 'life';
export type GameContext = 'voxel' | 'rocket' | 'souls';
export type Risk = 'Navigation' | 'Hull' | 'Life Support';
export type World = {
  hull: number;
  oxygen: number;
  power: number;
  navigation: number;
  supplies: number;
  passengers: number;
  custodian: string;
  log: { time: string; text: string; tone: 'loss' | 'gain' | 'info' }[];
};
