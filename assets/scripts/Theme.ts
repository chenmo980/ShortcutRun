// 主题系统：换皮 = 换一张色表，几何/逻辑零改动
// 色表规范：docs/qoder/theme.mjs（Qoder Q5 交付）——关键对对比度/色盲残余
// 全部可机验（docs/qoder/sim.mjs §20 逐张体检本文件，漂了就红）
import { Color } from 'cc';

export interface Theme {
  name: string;
  sky: number;    // 背景 + 雾
  ground: number; // 地面
  road: number;   // 跑道
  brick: number;  // 砖块/拖砖堆
  bridge: number; // 桥
  player: number; // 角色身体
  limb: number;   // 四肢
  skin: number;   // 头
  gate: number;   // 终点门
  pillar: number; // 门柱
  shoe?: number;  // v4 加速鞋（Q5 推荐键；鞋 vs 路对比 >=2.0 由规范把关）
  building1?: number; // 两侧建筑群（J2 视觉纵深）
  building2?: number;
  night?: boolean;    // 夜/昏盘：verifyTheme 跳过天空亮度下限与天路明暗序（Q5 night 通道）
}

export const THEMES: Record<string, Theme> = {
  // 白天（默认，原版 Voodoo 配方）：中性深土道当底板，前景全走高饱和且互为
  // 色盲安全轴（天蓝砖堆/奶白小人/大红门/柠檬鞋）——回应"太丑/照抄原版"
  day: {
    name: '白天（原版）', sky: 0xaee6ff, ground: 0x43a047, road: 0x6d4c41,
    brick: 0x4dd0ff, bridge: 0xc98d4f, player: 0xffffff,
    limb: 0x90a4ae, skin: 0xffe0b2, gate: 0xff3b30, pillar: 0x263238, shoe: 0xffee58,
    building1: 0xeceff1, building2: 0xb0bec5,
  },
  // 城市：暗沥青路 + 琥珀砖 + 红门。player 深蓝化修复（Q5 体检：淡蓝 vs 琥珀砖
  // 绿色盲残余 1.00=同色，改一键全过），城市身份不变
  city: {
    name: '城市', sky: 0x8fb3d9, ground: 0x7d8a99, road: 0x3d444d,
    brick: 0xffc107, bridge: 0x8d6e63, player: 0x0288d1,
    limb: 0x2196f3, skin: 0xffe0b2, gate: 0xe53935, pillar: 0x455a64, shoe: 0xffee58,
    building1: 0x78909c, building2: 0x546e7a,
  },
  // 糖果：粉嫩休闲（Q5 修复表：紫砖/可可桥/白角色——原表浅粉路+黄砖=拾取物隐身）
  candy: {
    name: '糖果', sky: 0xffe4ef, ground: 0x66bb6a, road: 0xd8b8ca,
    brick: 0xab27d3, bridge: 0x4e342e, player: 0xffffff,
    limb: 0xbdbdbd, skin: 0xffe0b2, gate: 0xc51162, pillar: 0x6a1b9a, shoe: 0x006064,
    building1: 0xf8bbd0, building2: 0xb39ddb,
  },
  // ---- 以下四盘移植自 art-studio 重制版（参数见 docs/qoder/art-pack.md §1，Q5 ARTSTUDIO 已过验）----
  // 马卡龙：白路面盘。原盘砖/桥在白道上不可见已修（砖改深棕、桥改冷灰），
  // 角色由品红改青蓝（品红 vs 棕砖色盲塌陷）。白路校不下柠檬黄鞋（1.54<2.0），改品红
  voodoo: {
    name: '马卡龙', sky: 0xbee1e6, ground: 0x48cae4, road: 0xffffff,
    brick: 0xb45309, bridge: 0x94a3b8, player: 0x06b6d4,
    limb: 0x3a86ff, skin: 0xffe0b2, gate: 0x8338ec, pillar: 0x1098f7, shoe: 0xff4081,
    building1: 0xd7f0f5, building2: 0x80cbc4,
  },
  // 海岛：沙滩跑道去饱和提亮为白沙（原表抢戏且违反天路明暗序），砖深一档
  tropical: {
    name: '海岛', sky: 0xc8e7f5, ground: 0x00b4d8, road: 0xf5f5f4,
    brick: 0xd97706, bridge: 0x8b5e34, player: 0x005f73,
    limb: 0x94d2bd, skin: 0xffe0b2, gate: 0xae2012, pillar: 0x0077b6, shoe: 0xff4081,
    building1: 0xe0f2f7, building2: 0x48cae4,
  },
  // 落日（夜盘）：暖沙路 + 深紫天。night 通道跳过天空亮度下限与天路明暗序
  sunset: {
    name: '落日', night: true, sky: 0x6d28d9, ground: 0x0e7490, road: 0xe8dcc4,
    brick: 0xb91c1c, bridge: 0x7c2d12, player: 0x1e40af,
    limb: 0xfde047, skin: 0xffe0b2, gate: 0xdc2626, pillar: 0x581845, shoe: 0xff4081,
    building1: 0x8b5cf6, building2: 0x4c1d95,
  },
  // 霓虹（夜盘）：海平线加发光青（原盘水色与夜空在暗端糊成一团，groundvssky 1.11）
  cyberpunk: {
    name: '霓虹', night: true, sky: 0x0d0826, ground: 0x0e7490, road: 0x1a1e29,
    brick: 0x00f5d4, bridge: 0x7000ff, player: 0xff007f,
    limb: 0xfee440, skin: 0xffe0b2, gate: 0x9b5de5, pillar: 0x050517, shoe: 0xffee58,
    building1: 0x2a2140, building2: 0x120e2b,
  },
};

export function colorOf(hex: number): Color {
  return new Color((hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255);
}

let currentKey = 'day';
let theme: Theme = THEMES[currentKey];

export function currentTheme(): Theme {
  return theme;
}

export function setTheme(key: string): Theme {
  if (THEMES[key]) {
    currentKey = key;
    theme = THEMES[key];
  }
  return theme;
}

export function cycleTheme(): Theme {
  const keys = Object.keys(THEMES);
  return setTheme(keys[(keys.indexOf(currentKey) + 1) % keys.length]);
}
