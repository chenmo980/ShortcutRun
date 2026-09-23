// 终点倍率 Bonus Run（原版 Shortcut Run 核心计分玩法）
// 规则：冲过终点后进入奖励区，一排带倍率的悬浮台(×2~×15)。剩余板子是"汽油"——
// 每移动 1 米烧 1.4 块（回头也烧），烧完即停，停在哪个台就乘该倍率。
// M10（原版高分核心策略）：奖励区可以回头——入口后埋着气垛（板堆），
// 按 S 回头捡气再冲刺，用低气博高倍率；倍率台站过即锁定不降。
// 分数 = 100 × 倍率 + 结算时剩余板数。cc-free 纯逻辑，双端复用。
import type { Cfg } from './config';

export interface BonusPad {
  z: number;        // 在奖励区中的位置（米，入口=0）
  multiplier: number;
}

// 气垛：奖励区里散落的板堆（原版“回头捡板”的载体）。负 z = 入口后方（回头才拿得到）
export interface BonusPile {
  z: number;
  planks: number;
  taken: boolean;
}

export interface BonusRunState {
  traveled: number;   // 相对入口的位置（米，回头为负）
  remainingPlanks: number; // 剩余汽油
  multiplier: number; // 当前锁定的倍率（站过台即翻倍不降）
  finished: boolean;
}

export const BONUS_BURN = 1.4;        // 每米烧板（汽油费率，双端一致）
export const BONUS_BACK_LIMIT = -13;  // 回头最远距离（入口后 13m）
export const BONUS_BACK_SPEED = 0.65; // 回头速度系数（冲刺 1.0）

// 倍率台布局：从近到远 ×2 ×3 ×5 ×8 ×10 ×12 ×15（原版为 15 个岛，取 7 档够表达）
export function genBonusPads(cfg: Cfg): BonusPad[] {
  const mults = [2, 3, 5, 8, 10, 12, 15];
  const pads: BonusPad[] = [];
  let z = 3;
  for (const m of mults) {
    pads.push({ z, multiplier: m });
    z += 5 + m * 0.7; // 高倍率台更远，冲刺有渐进感
  }
  return pads;
}

// 气垛布局：入口后 3.5m/11m 各 +15（回头货），前方 20m/42m 各 +18（冲刺路上顺手）
export function genGasPiles(cfg: Cfg): BonusPile[] {
  return [
    { z: -3.5, planks: 15, taken: false },
    { z: -11, planks: 15, taken: false },
    { z: 20, planks: 18, taken: false },
    { z: 42, planks: 18, taken: false },
  ];
}

export function createBonusRun(planks: number): BonusRunState {
  return { traveled: 0, remainingPlanks: planks, multiplier: 1, finished: false };
}

// 移动 adv 米（回头为负）：烧 |adv|×BONUS 板、收走过的气垛、过半台即锁倍率（不降）。
// 返回是否仍在跑
export function stepBonusRun(s: BonusRunState, pads: BonusPad[], piles: BonusPile[], adv: number): boolean {
  if (s.finished) return false;
  s.traveled = Math.max(BONUS_BACK_LIMIT, s.traveled + adv);
  s.remainingPlanks = Math.max(0, s.remainingPlanks - Math.abs(adv) * BONUS_BURN);
  // 站上/越过某个台 → 锁定其倍率（取已越过台中的最大值，单调不减）
  for (const p of pads) {
    if (s.traveled >= p.z && p.multiplier > s.multiplier) s.multiplier = p.multiplier;
  }
  // 气垛：走过即收（回头/冲刺都能拿，一次性）；返回本次新增汽油供调用方播音效
  for (const p of piles) {
    if (p.taken) continue;
    if (Math.abs(s.traveled - p.z) < 1.3) {
      p.taken = true;
      s.remainingPlanks += p.planks;
    }
  }
  if (s.remainingPlanks <= 0) { s.finished = true; return false; }
  return true;
}

// 结算：100 × 倍率 + 剩余板数（原版基础分 100）
export function bonusScore(s: BonusRunState): number {
  return 100 * s.multiplier + Math.floor(s.remainingPlanks);
}

// 星级：≥×8 三星，≥×5 二星，其余一星（与 progression 的 PAR 线互补，按倍率评）
export function bonusStars(s: BonusRunState): number {
  if (s.multiplier >= 8) return 3;
  if (s.multiplier >= 5) return 2;
  return 1;
}
