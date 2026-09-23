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

export type PhysicsFeelPreset =
  | 'voodoo_classic'
  | 'slippery_drift'
  | 'viscous_heavy'
  | 'bouncy_spring'
  | 'custom';

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
  autoPilot: boolean; // 自动巡航持续测试（全关卡自动寻路跑图）
  infinitePlanks: boolean; // 无限木板（测试模式不死）
  autoLoop: boolean; // 冲线/结束自动循环跑图

  // VOODOO 核心手感与材质碰撞物理参数
  trackFriction: number; // 跑道地面摩擦力系数 (0.2 ~ 1.0, 默认 0.85)
  lateralDrift: number; // 转向侧滑惯性系数 (0.0 ~ 0.8, 默认 0.20)
  waterDamping: number; // 木板水面漂浮阻尼 (0.1 ~ 0.95, 默认 0.75)
  buoyancySpring: number; // 木板浮力回弹刚度 (0.4 ~ 2.0, 默认 1.20)
  collisionRestitution: number; // 碰撞/边界反弹吸收系数 (0.0 ~ 0.8, 默认 0.18)
  runSpeed: number; // 跑酷巡航速度 (12 ~ 26, 默认 18)
  feelPreset: PhysicsFeelPreset;

  // 拾取动作与手部 IK 动画参数
  pickupAmplitude: number; // 拾取动作幅度 (0.4 ~ 2.0, 默认 1.0)
  pickupDuration: number; // 拾取动画时长 (0.15 ~ 1.2 秒, 默认 0.45s)
  holdingArmSpread: number; // 抱持手部横向间距开合 (IK X, -0.25 ~ +0.25, 默认 0.0)
  holdingArmHeight: number; // 抱持手部垂直高度托举 (IK Y, -0.25 ~ +0.25, 默认 0.0)
  holdingArmReach: number; // 抱持手部向前纵深伸展 (IK Z, -0.20 ~ +0.25, 默认 0.0)
  testPickupTrigger?: number; // 触发拾取动作预览时间戳
}

export interface GameMetrics {
  score: number;
  planksCarried: number;
  planksPlaced: number;
  multiplier: number;
  state: 'idle' | 'running' | 'bridging' | 'drowned' | 'finished';
  drawCalls: number;
  fps: number;
  renderMs?: number;
}
