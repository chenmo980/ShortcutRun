// 终点倍率 Bonus Run（原版 Shortcut Run 核心计分玩法）
// 规则：冲过终点后进入奖励区，一排带倍率的悬浮台(×2~×15)。剩余板子是"汽油"——
// 每前进 1 米烧 1 块，烧完即停，停在哪个台就乘该倍率。
// 分数 = 100 × 倍率 + 结算时剩余板数。cc-free 纯逻辑，双端复用。
import type { Cfg } from './config';

export interface BonusPad {
  z: number;        // 在奖励区中的位置（米，从 0 起）
  multiplier: number;
}

export interface BonusRunState {
  traveled: number;   // 已在奖励区前进的距离（米）
  remainingPlanks: number; // 剩余汽油
  multiplier: number; // 当前锁定的倍率（站上台即翻倍不降）
  finished: boolean;
}

// 倍率台布局：从近到远 ×2 ×3 ×5 ×8 ×10 ×12 ×15（原版为 15 个岛，取 7 档够表达）
export function genBonusPads(cfg: Cfg): BonusPad[] {
  const mults = [2, 3, 5, 8, 10, 12, 15];
  const pads: BonusPad[] = [];
  let z = 3;
  for (const m of mults) {
    pads.push({ z, multiplier: m });
    z += 4 + m * 0.4; // 高倍率台更远，冲刺有渐进感
  }
  return pads;
}

export function createBonusRun(planks: number): BonusRunState {
  return { traveled: 0, remainingPlanks: planks, multiplier: 1, finished: false };
}

// 前进 adv 米：烧板、过半台即锁定倍率（不降）。返回是否仍在跑
export function stepBonusRun(s: BonusRunState, pads: BonusPad[], adv: number): boolean {
  if (s.finished) return false;
  s.traveled += adv;
  s.remainingPlanks = Math.max(0, s.remainingPlanks - adv);
  // 站上/越过某个台 → 锁定其倍率（取已越过台中的最大值，单调不减）
  for (const p of pads) {
    if (s.traveled >= p.z && p.multiplier > s.multiplier) s.multiplier = p.multiplier;
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
