// 关卡进阶曲线：level -> Cfg（移植自 docs/qoder/levels.mjs 饱和版，母本优先）
// 数值依据见 docs/drafts/balance-v1.md；验收带：真人 ≈ bot × 0.6~0.8
// 注意：本文件零运行时 import（Cfg 仅作类型），tools/smoke.ts 可直接 import 做漂移断言
import type { Cfg } from './config';

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

// 饱和版（2026-09-21 Qoder 重做）：加深只跑两个 loop 然后收敛——
// 实测 f/k 越过饱和点后供给崩成 3~13% 胜率墙；终局平台 ≈35~55% 胜率 + 每 loop 地图更长更新
export function cfgForLevel(level: number, base: Cfg): Cfg {
  const idx = (Math.max(1, level) - 1) % CURVE.length;
  const loop = Math.floor((Math.max(1, level) - 1) / CURVE.length);
  const f = 1 + Math.min(loop, 1) * 0.1;
  const [length, gateCost, gwMin, gwMax, giMin, giMax, runSpeed, maxSpeed, speedPerBrick] = CURVE[idx];
  return {
    ...base,
    levelLength: length + loop * 20,
    gateCost: Math.round(gateCost * f * f),
    gapWidthMin: Math.min(4.5, gwMin * f),
    gapWidthMax: Math.min(7.0, gwMax * f),
    gapIntervalMin: Math.max(6, giMin / f),
    gapIntervalMax: Math.max(10, giMax / f),
    runSpeed, maxSpeed, speedPerBrick,
    supplyMargin: marginFor(level),
    // 人形有效拾取率≈0.62，k 低于 1/0.62≈1.6 后密度越高越饿死；1.5=实测终局平台下限
    supplyRatio: Math.max(1.5, ratioFor(level) - loop * 0.1),
  };
}
