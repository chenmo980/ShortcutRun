// 关卡程序化生成：给定种子确定性产出跑道/断崖/砖块拾取/终点门
// 纯逻辑模块，不依赖 cc，可用 node tools/smoke.ts 直接测试
//
// genLevel = v1（parity 基线，与 docs/qoder/bridge-rules.mjs 逐 seed 一致）
// genLevelV2 = Qoder 评审修复版：兜底补砖改补进「最早缺砖区间」，保证前缀可行
//   - D1：v1 有 2.75% 关卡全局砖不足（数学上不可能通关）
//   - D2：v1 有 16.4% 关卡存在前缀死局（走到第 i 崖时累计余砖 < 0）
import type { Cfg } from './config';

export interface GapDef {
  zStart: number;
  zEnd: number;
  cost: number;       // 铺桥消耗砖数
  bridged?: boolean;  // 运行时状态
}

export interface PickupDef {
  x: number;
  z: number;
}

export interface LevelDef {
  length: number;
  gaps: GapDef[];
  pickups: PickupDef[];
  gateZ: number;
  gateCost: number;
}

// 确定性随机数（同种子同关卡，方便复现和测试）
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genLevel(seed: number, cfg: Cfg): LevelDef {
  const rnd = mulberry32(seed);
  const halfW = cfg.trackHalfWidth - 0.8; // 拾取物不贴边

  // 1. 断崖
  const gaps: GapDef[] = [];
  let z = 8; // 起步安全跑道
  while (z < cfg.levelLength - 14) {
    const width = cfg.gapWidthMin + rnd() * (cfg.gapWidthMax - cfg.gapWidthMin);
    gaps.push({ zStart: z, zEnd: z + width, cost: Math.ceil(width) });
    z = z + width + cfg.gapIntervalMin + rnd() * (cfg.gapIntervalMax - cfg.gapIntervalMin);
  }
  const gateZ = cfg.levelLength - 6;

  // 2. 可跑区间（断崖之间 + 起点到第一个断崖 + 最后一个断崖到终点门）
  const runZones: Array<[number, number]> = [];
  let prev = 0;
  for (const g of gaps) { runZones.push([prev, g.zStart]); prev = g.zEnd; }
  runZones.push([prev, gateZ - 2]);

  // 3. 砖块拾取：每个可跑区间放 1~2 组
  const pickups: PickupDef[] = [];
  for (const [z0, z1] of runZones) {
    if (z1 - z0 < 6) continue;
    const n = 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      pickups.push({
        x: (rnd() * 2 - 1) * halfW,
        z: z0 + 2 + rnd() * Math.max(1, z1 - z0 - 4),
      });
    }
  }

  // 4. 兜底：保证全图可获得砖数 >= 需求（铺桥总消耗 + 终点门），否则在可跑区间补拾取
  const need = cfg.gateCost + gaps.reduce((s, g) => s + g.cost, 0);
  while (pickups.length * cfg.brickCluster < need) {
    const zone = runZones[Math.floor(rnd() * runZones.length)];
    if (!zone || zone[1] - zone[0] < 6) break;
    pickups.push({ x: (rnd() * 2 - 1) * halfW, z: zone[0] + 2 + rnd() * Math.max(1, zone[1] - zone[0] - 4) });
  }

  return { length: cfg.levelLength, gaps, pickups, gateZ, gateCost: cfg.gateCost };
}

export function levelStats(level: LevelDef, cfg: Cfg) {
  const obtainable = level.pickups.length * cfg.brickCluster;
  const need = level.gateCost + level.gaps.reduce((s, g) => s + g.cost, 0);
  return { obtainable, need, ok: obtainable >= need };
}

// ================= v2 修复（移植自 docs/qoder/bridge-rules.mjs，母本优先） =================

// 可跑区间（注意：末段到 gateZ，与 genLevel 里排版用的 runZones 略有差异）
export function zonesOf(level: LevelDef): Array<[number, number]> {
  const zones: Array<[number, number]> = [];
  let prev = 0;
  for (const g of level.gaps) { zones.push([prev, g.zStart]); prev = g.zEnd; }
  zones.push([prev, level.gateZ]);
  return zones;
}

// 前缀供需：玩家顺序前进，走到第 i 个断崖时只花得起前 i 段吃到的砖。
// surplus 任一项 < 0 = 该关卡对顺序玩家存在死局（D2）。
export function prefixBalance(level: LevelDef, cfg: Cfg) {
  const zones = zonesOf(level);
  const perZone = zones.map(([z0, z1]) =>
    level.pickups.filter((p) => p.z >= z0 && p.z < z1).length * cfg.brickCluster);
  const surplus: number[] = [];
  let acc = 0;
  for (let i = 0; i < level.gaps.length; i++) {
    acc += perZone[i] - level.gaps[i].cost;
    surplus.push(acc);
  }
  acc += perZone[perZone.length - 1] - level.gateCost;
  surplus.push(acc);
  const minSurplus = Math.min(...surplus);
  return { perZone, surplus, feasible: surplus.every((s) => s >= 0), minSurplus, minAt: surplus.indexOf(minSurplus) };
}

function chooseZoneToFix(zones: Array<[number, number]>, badGapIdx: number): number {
  for (let i = badGapIdx; i >= 0; i--) {
    if (zones[i][1] - zones[i][0] >= 6) return i;
  }
  return -1;
}

// v2：兜底补砖改为「补进最早缺砖的可跑区间」，保证前缀可行（D1/D2 双修）
export function genLevelV2(seed: number, cfg: Cfg): LevelDef {
  const level = genLevel(seed, cfg);
  const zones = zonesOf(level);
  let guard = 0;
  while (guard++ < 500) {
    const { surplus } = prefixBalance(level, cfg);
    const bad = surplus.findIndex((s) => s < 0);
    if (bad === -1) break;
    const zoneIdx = chooseZoneToFix(zones, bad);
    if (zoneIdx < 0) break;
    const [z0, z1] = zones[zoneIdx];
    const rnd = mulberry32(seed * 7919 + guard); // 修复用独立子种子，保持确定性
    level.pickups.push({
      x: (rnd() * 2 - 1) * (cfg.trackHalfWidth - 0.8),
      z: z0 + 2 + rnd() * Math.max(1, z1 - z0 - 4),
    });
  }
  return level;
}
