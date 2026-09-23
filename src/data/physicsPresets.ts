import { PhysicsFeelPreset, VisualSettings } from '../types';

export interface PhysicsPresetConfig {
  id: PhysicsFeelPreset;
  name: string;
  tag: string;
  badgeColor: string;
  description: string;
  voodooNote: string;
  trackFriction: number;
  lateralDrift: number;
  waterDamping: number;
  buoyancySpring: number;
  collisionRestitution: number;
  runSpeed: number;
}

export const VOODOO_PHYSICS_PRESETS: PhysicsPresetConfig[] = [
  {
    id: 'voodoo_classic',
    name: 'VOODOO 原厂标杆手感',
    tag: '官方黄金配比',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: '精准对标《Shortcut Run》原版手感：微操指哪打哪，高抓地力搭配克制的微量侧倾惯性，木板落水即刻压实吸附。',
    voodooNote: '核心原则：超休闲游戏的第一要义是「零操作延迟」，玩家横向滑动时角色不拖泥带水，但在急转弯时给予细微漂移以营造速度快感。',
    trackFriction: 0.85,
    lateralDrift: 0.20,
    waterDamping: 0.75,
    buoyancySpring: 1.20,
    collisionRestitution: 0.18,
    runSpeed: 18.0,
  },
  {
    id: 'slippery_drift',
    name: '海面极速丝滑漂移',
    tag: '大角度过弯',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: '降低地面阻力并放大转向惯性，高速过弯时具有强烈的侧滑推背感，在水上冲刺抄近道时如滑雪般顺畅。',
    voodooNote: '适合追求极致竞速与大角度切角的玩家，水面铺桥速度加成更为显著，视觉动态冲击力极高。',
    trackFriction: 0.52,
    lateralDrift: 0.62,
    waterDamping: 0.50,
    buoyancySpring: 0.90,
    collisionRestitution: 0.35,
    runSpeed: 21.5,
  },
  {
    id: 'viscous_heavy',
    name: '沉稳阻尼策略铺桥',
    tag: '厚重扎实',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: '最大抓地力与高粘滞水面阻尼，木板落水几乎无震颤回弹，角色转向稳健不漂，适合高难度窄道精准走位。',
    voodooNote: '木板垂直下落阻尼接近临界阻尼（Critical Damping），落水瞬间立刻静止，杜绝水浪颠簸干扰。',
    trackFriction: 0.96,
    lateralDrift: 0.06,
    waterDamping: 0.92,
    buoyancySpring: 1.55,
    collisionRestitution: 0.05,
    runSpeed: 15.5,
  },
  {
    id: 'bouncy_spring',
    name: '活泼多巴胺 Q 弹',
    tag: '弹簧跃动',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: '高浮力回弹刚度与活泼反弹，木板落水时伴随肉眼可见的微小沉浮震荡与水花飞溅，充满卡通游戏反馈。',
    voodooNote: '强调视觉物理反馈（Juiciness），木板与水波浪产生交互浮力位移，每踩一块木板都有一记扎实的微弹手感。',
    trackFriction: 0.70,
    lateralDrift: 0.38,
    waterDamping: 0.38,
    buoyancySpring: 1.75,
    collisionRestitution: 0.48,
    runSpeed: 19.0,
  },
];

export const DEFAULT_PHYSICS_SETTINGS = {
  trackFriction: 0.85,
  lateralDrift: 0.20,
  waterDamping: 0.75,
  buoyancySpring: 1.20,
  collisionRestitution: 0.18,
  runSpeed: 18.0,
  feelPreset: 'voodoo_classic' as PhysicsFeelPreset,
};

export interface IkPresetConfig {
  id: string;
  name: string;
  tag: string;
  desc: string;
  pickupAmplitude: number;
  pickupDuration: number;
  holdingArmSpread: number;
  holdingArmHeight: number;
  holdingArmReach: number;
}

export const DEFAULT_IK_SETTINGS = {
  pickupAmplitude: 1.0,
  pickupDuration: 0.45,
  holdingArmSpread: 0.0,
  holdingArmHeight: 0.0,
  holdingArmReach: 0.0,
};

export const IK_ANIMATION_PRESETS: IkPresetConfig[] = [
  {
    id: 'standard',
    name: 'VOODOO 标准紧凑合抱',
    tag: '官方默认',
    desc: '最贴合原版《Shortcut Run》的手部托扶姿态，拾取幅度适中，环抱平稳扎实。',
    pickupAmplitude: 1.0,
    pickupDuration: 0.45,
    holdingArmSpread: 0.0,
    holdingArmHeight: 0.0,
    holdingArmReach: 0.0,
  },
  {
    id: 'dramatic',
    name: '夸张大开大合长弧捞拾',
    tag: '动态张力',
    desc: '大幅展开右臂向外下探捞砖，拾取动作时长拉长，视觉动态冲击力极强。',
    pickupAmplitude: 1.55,
    pickupDuration: 0.65,
    holdingArmSpread: 0.08,
    holdingArmHeight: 0.06,
    holdingArmReach: 0.08,
  },
  {
    id: 'snappy',
    name: '极速敏捷闪电点捞',
    tag: '轻盈迅捷',
    desc: '超短动作帧（0.24s），手臂疾速下探后光速复位，手部贴身紧凑托抱。',
    pickupAmplitude: 0.75,
    pickupDuration: 0.24,
    holdingArmSpread: -0.06,
    holdingArmHeight: -0.04,
    holdingArmReach: -0.03,
  },
  {
    id: 'wide_embrace',
    name: '大度宽臂豪迈环抱',
    tag: '稳健大抱',
    desc: '双肘外展，左右手部开合幅度更大，托举视野更开阔，适合大号或重型道具。',
    pickupAmplitude: 1.25,
    pickupDuration: 0.50,
    holdingArmSpread: 0.16,
    holdingArmHeight: -0.05,
    holdingArmReach: 0.10,
  },
];
