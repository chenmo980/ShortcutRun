// 关卡程序化生成：给定种子确定性产出跑道/断崖/砖块拾取/终点门
// 纯逻辑模块，不依赖 cc，可用 node tools/smoke.ts 直接测试
//
// 母本：docs/qoder/bridge-rules.mjs（Qoder 维护，cc-free 唯一规则源）
// 本文件是 TS 移植版，必须与母本位级一致（smoke.ts parity 断言）
// - genLevel   = v1 基线（opts.tailSafe 供 v3 使用）
// - genLevelV2 = v2.1：repairPrefixSupply(margin=0) + spaceOutPickups
// - genLevelV3 = 生产版：tailSafe（D1 几何根治）+ margin/k 双目标供给修复
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
  kind?: 'shoe'; // v4 道具:加速鞋(无 kind = 砖块拾取)
}

// v4 道具门:横跨跑道的增益拱门(加砖 /N、倍数 ×N),z 升序
export interface ItemGateDef {
  z: number;
  type: 'add' | 'mul';
  v: number;
  used?: boolean;   // 运行时状态:是否已触发
}

export interface LevelDef {
  length: number;
  gaps: GapDef[];
  pickups: PickupDef[];
  gateZ: number;
  gateCost: number;
  gates?: ItemGateDef[]; // 仅开启道具时出现(形状锁:关闭时连键都不出现,保 parity 逐字节)
}

// 道具计划(levels.mjs itemsFor 给分带;ITEMS_DEFAULT 走 cfg.enableItems)
export interface ItemsPlan {
  addGates?: number;
  mulGates?: number;
  shoes?: number;
  addValue?: number;
  mulValue?: number;
}

export const ITEMS_DEFAULT: ItemsPlan = { addGates: 1, mulGates: 1, shoes: 1 };

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

// opts.tailSafe=true：D1 根治——把最后一个断崖钳到 length-14 之前，末段恒 >=8m
export function genLevel(seed: number, cfg: Cfg, opts: { tailSafe?: boolean } = {}): LevelDef {
  const tailSafe = opts.tailSafe === true;
  const rnd = mulberry32(seed);
  const halfW = cfg.trackHalfWidth - 0.8; // 拾取物不贴边

  // 1. 断崖
  const gaps: GapDef[] = [];
  let z = 8; // 起步安全跑道
  while (z < cfg.levelLength - 14) {
    let width = cfg.gapWidthMin + rnd() * (cfg.gapWidthMax - cfg.gapWidthMin);
    if (tailSafe) {
      const room = cfg.levelLength - 14 - z;
      if (room < cfg.gapWidthMin) break;
      width = Math.min(width, room);
    }
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

// 供需只数砖拾取(v4 起 kind:'shoe' 不计入供给 = 道具可行性无关化)
export function levelStats(level: LevelDef, cfg: Cfg) {
  const obtainable = level.pickups.filter((p) => !p.kind).length * cfg.brickCluster;
  const need = level.gateCost + level.gaps.reduce((s, g) => s + g.cost, 0);
  return { obtainable, need, ok: obtainable >= need };
}

// 可跑区间（末段到 gateZ，与 genLevel 排版用的 runZones 略有差异）
export function zonesOf(level: LevelDef): Array<[number, number]> {
  const zones: Array<[number, number]> = [];
  let prev = 0;
  for (const g of level.gaps) { zones.push([prev, g.zStart]); prev = g.zEnd; }
  zones.push([prev, level.gateZ]);
  return zones;
}

// 前缀供需：玩家顺序前进，走到第 i 个断崖时只花得起前 i 段吃到的砖。
// surplus 任一项 < 0 = 对顺序玩家存在死局（D2）。
export function prefixBalance(level: LevelDef, cfg: Cfg) {
  const zones = zonesOf(level);
  const perZone = zones.map(([z0, z1]) =>
    level.pickups.filter((p) => !p.kind && p.z >= z0 && p.z < z1).length * cfg.brickCluster);
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

function chooseZoneToFix(zones: Array<[number, number]>, _level: LevelDef, badGapIdx: number): number {
  // 优先补「紧挨着死断崖之前」且长度足够的区间；往前找
  for (let i = badGapIdx; i >= 0; i--) {
    if (zones[i][1] - zones[i][0] >= 6) return i;
  }
  return -1;
}

// 供给修复：每个前缀点 i 同时满足
//   ① surplus_i >= margin（绝对容错，块）
//   ② 累计供给 >= k × 累计需求（乘法溢出；k=1 时即①的特例）
// 依据：失误人形 bot 归因实测——漏吃 25% 时纯加法 margin 在 L7 胜率 0%，瓶颈唯一是供给量
function repairPrefixSupply(level: LevelDef, cfg: Cfg, seed: number, margin: number, k = 1): void {
  const zones = zonesOf(level);
  let guard = 0;
  while (guard++ < 500) {
    const { surplus, perZone } = prefixBalance(level, cfg);
    // 累计需求：demand[i] = 过完第 i 个断崖所需总砖；末位含终点门
    const demand: number[] = [];
    let d = 0;
    for (const g of level.gaps) { d += g.cost; demand.push(d); }
    demand.push(d + level.gateCost);
    const supply: number[] = []; // 累计供给（块）
    let acc = 0;
    for (let i = 0; i < perZone.length; i++) { acc += perZone[i]; supply.push(acc); }
    let bad = -1;
    for (let i = 0; i < surplus.length; i++) {
      if (surplus[i] < margin || supply[i] < k * demand[i] - 1e-9) { bad = i; break; }
    }
    if (bad === -1) break;
    const zoneIdx = chooseZoneToFix(zones, level, bad);
    if (zoneIdx < 0) break;
    const [z0, z1] = zones[zoneIdx];
    const rnd = mulberry32(seed * 7919 + guard); // 修复用独立子种子，保持确定性
    level.pickups.push({
      x: (rnd() * 2 - 1) * (cfg.trackHalfWidth - 0.8),
      z: z0 + 2 + rnd() * Math.max(1, z1 - z0 - 4),
    });
  }
}

// 同区间内拾取沿 z 摊开：先保持首个不动逐个前推；撞区间尾则从尾部回推。
// 确定性、纯几何，不增删拾取所以不影响供需
export function spaceOutPickups(level: LevelDef, zones: Array<[number, number]>, minGap = 4): void {
  for (const [z0, z1] of zones) {
    const inZone = level.pickups
      .filter((p) => p.z >= z0 && p.z < z1)
      .sort((a, b) => a.z - b.z);
    if (inZone.length < 2) continue;
    const lo = z0 + 1, hi = z1 - 1;
    if (hi - lo < minGap * (inZone.length - 1)) {
      for (let i = 0; i < inZone.length; i++) {
        inZone[i].z = lo + ((hi - lo) * i) / (inZone.length - 1); // 区间容不下标准间距：均匀摊
      }
      continue;
    }
    for (let i = 1; i < inZone.length; i++) {
      inZone[i].z = Math.max(inZone[i].z, inZone[i - 1].z + minGap);
    }
    if (inZone[inZone.length - 1].z > hi) {
      inZone[inZone.length - 1].z = hi;
      for (let i = inZone.length - 2; i >= 0; i--) {
        inZone[i].z = Math.min(inZone[i].z, inZone[i + 1].z - minGap);
      }
    }
  }
}

// v2.1：margin=0 前缀可行 + 拾取摊开
export function genLevelV2(seed: number, cfg: Cfg): LevelDef {
  const level = genLevel(seed, cfg);
  const zones = zonesOf(level);
  repairPrefixSupply(level, cfg, seed, 0);
  spaceOutPickups(level, zones);
  return level;
}

// v3 生产版：tailSafe + margin/k 双目标供给修复 + 拾取摊开
export function genLevelV3(seed: number, cfg: Cfg, opts: { margin?: number; supplyRatio?: number; items?: ItemsPlan } = {}): LevelDef {
  const margin = opts.margin ?? cfg.supplyMargin ?? 2;
  const k = opts.supplyRatio ?? cfg.supplyRatio ?? 1;
  const level = genLevel(seed, cfg, { tailSafe: true });
  repairPrefixSupply(level, cfg, seed, margin, k);
  spaceOutPickups(level, zonesOf(level));
  // v4 道具开关:opts.items 显式传入,或 cfg.enableItems 走 ITEMS_DEFAULT。
  // **默认关闭 = 输出与 v3 逐字节一致(§14 parity 锚不失效)**;开启时仅追加 level.gates 与 kind:'shoe' 拾取。
  const items = opts.items ?? (cfg.enableItems ? ITEMS_DEFAULT : null);
  if (items) placeItems(level, cfg, seed, items);
  return level;
}

// 道具布置(独立子种子 mulberry32(seed*104729+7),确定性):
// 门放在可跑区间内、避开断崖与彼此;鞋作为 kind:'shoe' 拾取追加。
// 放不下的名额直接放弃(计数 <= 计划)。供需数学只数无 kind 砖拾取 = 道具纯增益,不可能制造新死局(母本 §19 锁死)。
function placeItems(level: LevelDef, cfg: Cfg, seed: number, plan: ItemsPlan): void {
  const rnd = mulberry32(seed * 104729 + 7);
  const zones = zonesOf(level);
  const gates: ItemGateDef[] = [];
  const putGate = (type: 'add' | 'mul', v: number, from: number, to: number) => {
    for (let tries = 0; tries < 40; tries++) {
      const z = from + rnd() * (to - from);
      const onTrack = zones.some(([z0, z1]) => z > z0 + 1.5 && z < z1 - 1.5);
      const clear = gates.every((g) => Math.abs(g.z - z) >= 6);
      if (onTrack && clear) {
        gates.push({ z: +z.toFixed(2), type, v });
        return;
      }
    }
  };
  const gateZ = level.gateZ;
  for (let i = 0; i < (plan.addGates ?? 0); i++) putGate('add', plan.addValue ?? 5, gateZ * 0.45, gateZ * 0.8);
  for (let i = 0; i < (plan.mulGates ?? 0); i++) putGate('mul', plan.mulValue ?? 2, gateZ * 0.55, gateZ * 0.85);
  gates.sort((a, b) => a.z - b.z);
  level.gates = gates;

  const shoeZones = zones.filter(([z0, z1]) => z1 - z0 >= 6);
  for (let i = 0; i < (plan.shoes ?? 0); i++) {
    if (!shoeZones.length) break;
    const [z0, z1] = shoeZones[Math.floor(rnd() * shoeZones.length)];
    level.pickups.push({
      x: +((rnd() * 2 - 1) * (cfg.trackHalfWidth - 0.8)).toFixed(2),
      z: +(z0 + 2 + rnd() * Math.max(1, z1 - z0 - 4)).toFixed(2),
      kind: 'shoe',
    });
  }
}
