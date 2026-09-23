// 孤岛生成（原版 Shortcut Run 经典机制复刻）
// 规则：主路外侧的悬浮小平台，上面有板堆——离开主路花板子冒险过去，回报大于成本，
// 鼓励熟练玩家切弯抄近路时顺路捡便宜。确定性（同种子同分布），不改动 LevelGen
// 数据（parity 锁不受影响），只在表现层叠加。
import type { Cfg } from './config';
import type { LevelDef } from './LevelGen';

export interface IslandDef {
  x: number;      // level-space 横向偏移
  z: number;
  planks: number; // 岛上板堆价值
  radius: number; // 平台半径
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genIslands(seed: number, cfg: Cfg, level: LevelDef): IslandDef[] {
  const rnd = mulberry32(seed * 31 + 7);
  const out: IslandDef[] = [];

  // 可跑区间（与 LevelGen 的 runZones 同构）
  const zones: Array<[number, number]> = [];
  let prev = 0;
  for (const g of level.gaps) { zones.push([prev, g.zStart]); prev = g.zEnd; }
  zones.push([prev, level.gateZ - 4]);

  for (const [z0, z1] of zones) {
    if (z1 - z0 < 12) continue;        // 区间太短不放
    if (rnd() < 0.35) continue;        // 不是每个区间都有
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (cfg.trackHalfWidth + 2.5 + rnd() * 2.5);
    const z = z0 + 4 + rnd() * Math.max(1, z1 - z0 - 8);
    // 到达成本 ≈ (|x|-halfW)+radius ≈ 4m ≈ 4 板；回报 6~10 板 > 成本（风险回报为正）
    out.push({ x, z, planks: 6 + Math.floor(rnd() * 5), radius: 1.4 });
  }
  return out;
}
