// 关卡进阶曲线：level -> Cfg（移植自 docs/qoder/levels.mjs，母本优先）
// 数值依据见 docs/drafts/balance-v1.md；验收带：真人 ≈ bot × 0.6~0.8
import type { Cfg } from './config';
import { CFG } from './config';

// [length, gateCost, gwMin, gwMax, giMin, giMax, runSpeed, maxSpeed, speedPerBrick]
const CURVE: Array<[number, number, number, number, number, number, number, number, number]> = [
  [120, 10, 2.5, 4.0, 18, 28, 6.0, 10.0, 0.08], // L1 教学关：宽间隔低门需
  [140, 12, 2.5, 4.5, 16, 26, 6.0, 10.0, 0.08], // L2 = 默认
  [150, 14, 2.6, 4.8, 15, 25, 6.0, 10.0, 0.08],
  [160, 15, 2.7, 5.0, 14, 23, 6.5, 10.5, 0.09],
  [170, 16, 2.8, 5.3, 13, 22, 6.5, 11.0, 0.09],
  [180, 18, 3.0, 5.5, 12, 20, 7.0, 11.0, 0.10],
  [190, 20, 3.2, 5.7, 11, 19, 7.0, 11.5, 0.10],
  [200, 22, 3.4, 6.0, 10, 17, 7.0, 12.0, 0.10],
  [210, 24, 3.5, 6.0, 10, 16, 7.5, 12.0, 0.11],
  [220, 26, 3.5, 6.0, 10, 16, 7.5, 12.0, 0.11], // L10
];

// 供给余量带：全程每个前缀点至少剩 margin 块砖。
// L1-3 给 4（=一颗拾取，新手漏吃一个不死）；L4-7 给 2；L8-10 给 1（保留压迫感）
export function marginFor(level: number): number {
  const l = ((Math.max(1, level) - 1) % 10) + 1;
  if (l <= 3) return 4;
  if (l <= 7) return 2;
  return 1;
}

// 供给倍率：漏吃是胜率唯一瓶颈（sim.mjs §11 归因），按累计供给 >= k×累计需求 溢出补砖
export function ratioFor(level: number): number {
  const l = ((Math.max(1, level) - 1) % 10) + 1;
  if (l <= 3) return 2.0;
  if (l <= 7) return 1.8;
  return 1.55;
}

export function cfgForLevel(level: number, base: Cfg = CFG): Cfg {
  const idx = (Math.max(1, level) - 1) % CURVE.length;
  const loop = Math.floor((Math.max(1, level) - 1) / CURVE.length); // 第 11 关起循环加深
  const [length, gateCost, gwMin, gwMax, giMin, giMax, runSpeed, maxSpeed, speedPerBrick] = CURVE[idx];
  const f = 1 + loop * 0.1;
  return {
    ...base,
    levelLength: length + loop * 10,
    gateCost: Math.round(gateCost * f),
    gapWidthMin: Math.min(4.0, gwMin * f),
    gapWidthMax: Math.min(7.0, gwMax * f),
    gapIntervalMin: Math.max(8, giMin / f),
    gapIntervalMax: Math.max(12, giMax / f),
    runSpeed, maxSpeed, speedPerBrick,
    supplyMargin: marginFor(level),
    supplyRatio: ratioFor(level),
  };
}
