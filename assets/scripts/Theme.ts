// 主题系统：换皮 = 换一张色表，几何/逻辑零改动
// 色表依据见 docs/drafts/balance-v1.md 与 Qoder Q5 规范（未到先用临时表）
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
}

export const THEMES: Record<string, Theme> = {
  // 城市（默认）：暗沥青路 + 琥珀砖 + 红门，对比强、辨识度高
  city: {
    name: '城市', sky: 0x8fb3d9, ground: 0x7d8a99, road: 0x3d444d,
    brick: 0xffc107, bridge: 0x8d6e63, player: 0x4fc3f7,
    limb: 0x2196f3, skin: 0xffe0b2, gate: 0xe53935, pillar: 0x455a64,
  },
  // 糖果：粉嫩休闲，验证换肤链路用
  candy: {
    name: '糖果', sky: 0xffd9e8, ground: 0xb8e6c1, road: 0xff8fab,
    brick: 0xfff176, bridge: 0xce93d8, player: 0x64b5f6,
    limb: 0x42a5f5, skin: 0xffe0b2, gate: 0xff7043, pillar: 0xab47bc,
  },
};

export function colorOf(hex: number): Color {
  return new Color((hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255);
}

let currentKey = 'city';
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
