export interface ColorPalette {
  name: string;
  id: string;
  description: string;
  waterDeep: string;
  waterShallow: string;
  waterFoam: string;
  trackColor: string;
  trackBorder: string;
  plankColor: string;
  playerColor: string;
  accentColor: string;
  finishColor: string;
  skyTop: string;
  skyBottom: string;
  isGraybox?: boolean;
}

export type CharacterModelType =
  | 'wukong'
  | 'nezha'
  | 'guofeng_hero'
  | 'panda_hero'
  | 'runner_boy'
  | 'chibi_ninja'
  | 'beach_dude'
  | 'voxel_bot'
  | 'stickman';

export type PlankStyleType = 'bamboo_raft' | 'jade_slab' | 'wood_plank' | 'neon_crystal' | 'gold_bar';

export interface VisualSettings {
  paletteId: string;
  characterType: CharacterModelType;
  plankStyle: PlankStyleType;
  waterWaves: boolean;
  waterFoam: boolean;
  planarShadows: boolean;
  pickupVFX: boolean;
  soundEnabled: boolean;
  cameraTilt: number; // 45 to 70 deg
  showOpponent: boolean; // AI competitor runner
}

export interface GameMetrics {
  score: number;
  planksCarried: number;
  planksPlaced: number;
  multiplier: number;
  state: 'idle' | 'running' | 'bridging' | 'drowned' | 'finished';
  drawCalls: number;
  fps: number;
}
