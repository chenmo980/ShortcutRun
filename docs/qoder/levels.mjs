// 关卡进阶（Q3 交付的可执行版）：level -> Cfg。cc-free、确定性。
// step-5 接入点：GameApp/preview 每次开局 level++，cfg = cfgForLevel(level, CFG)，
// 种子建议 seed = level * 1000 + attempt（保证同关重开同图，换关换图）。
import { DEFAULT_CFG } from './bridge-rules.mjs';

// L1-L10 曲线，数值依据见 docs/drafts/balance-v1.md
const CURVE = [
  // length, gateCost, gwMin, gwMax, giMin, giMax, runSpeed, maxSpeed, speedPerBrick
  [120, 10, 2.5, 4.0, 18, 28, 6.0, 10.0, 0.08], // L1 教学关：宽间隔低门需
  [140, 12, 2.5, 4.5, 16, 26, 6.0, 10.0, 0.08], // L2 = 现网默认
  [150, 14, 2.6, 4.8, 15, 25, 6.0, 10.0, 0.08],
  [160, 15, 2.7, 5.0, 14, 23, 6.5, 10.5, 0.09],
  [170, 16, 2.8, 5.3, 13, 22, 6.5, 11.0, 0.09],
  [180, 18, 3.0, 5.5, 12, 20, 7.0, 11.0, 0.10],
  [190, 20, 3.2, 5.7, 11, 19, 7.0, 11.5, 0.10],
  [200, 22, 3.4, 6.0, 10, 17, 7.0, 12.0, 0.10],
  [210, 24, 3.5, 6.0, 10, 16, 7.5, 12.0, 0.11],
  [220, 26, 3.5, 6.0, 10, 16, 7.5, 12.0, 0.11], // L10
];

export function cfgForLevel(level, base = DEFAULT_CFG) {
  const idx = (Math.max(1, level) - 1) % CURVE.length;
  const loop = Math.floor((Math.max(1, level) - 1) / CURVE.length);
  // 加深只跑两个 loop 然后收敛：实测 f/k 越过饱和点后供给崩成 5% 胜率墙（真人留存杀手）。
  // 终局平台 ≈35~55% 胜率 + 每 loop 地图更长更新，靠"换图不更脸"维持新鲜感。
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
    supplyRatio: Math.max(1.5, ratioFor(level) - loop * 0.1), // 人形有效拾取率≈0.62，k 低于 1/0.62≈1.6 后密度越高越饿死；1.5=实测终局平台下限
  };
}

// 验收带（真人预期≈bot×0.6~0.8，故 bot 带定得高）
export const WIN_BANDS = { min: [[1, 3, 0.95], [4, 7, 0.90], [8, 10, 0.80]] };
export function bandFor(level) {
  const l = ((level - 1) % 10) + 1;
  if (l <= 3) return 0.95;
  if (l <= 7) return 0.90;
  return 0.80;
}

// 供给余量带：全程每个前缀点至少剩 margin 块砖。
// L1-3 给 4（=一颗拾取，新手漏吃一个不死）；L4-7 给 2；L8-10 给 1（保留压迫感但不做 0 余量死局）
export function marginFor(level) {
  const l = ((level - 1) % 10) + 1;
  if (l <= 3) return 4;
  if (l <= 7) return 2;
  return 1;
}

// 供给倍率：失误人形 bot 归因显示漏吃是胜率唯一瓶颈（sim.mjs §11），
// 按"每前缀点累计供给 >= k×累计需求"溢出补砖。数值待 §11 验收带校准。
export function ratioFor(level) {
  const l = ((level - 1) % 10) + 1;
  if (l <= 3) return 2.0;
  if (l <= 7) return 1.8;
  return 1.55;
}
