// 关卡程序化生成：给定种子确定性产出跑道/断崖/砖块拾取/终点门
// 纯逻辑模块，不依赖 cc，可用 node tools/smoke.ts 直接测试
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
