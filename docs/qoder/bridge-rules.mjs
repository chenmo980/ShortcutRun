// ============================================================
// 桥版规则母本（Qoder 投递，AI-HANDOFF v2 §2/§4 契约）
// cc-free、零 DOM、确定性。opencode 移植 SimCore.ts 时以本文件为唯一母本，
// 并跑 docs/qoder/sim.mjs 做 parity 断言。
// 接口签名见同目录 README.md
// ============================================================

export const DEFAULT_CFG = {
  runSpeed: 6, speedPerBrick: 0.08, maxSpeed: 10,
  steerSpeed: 10, steerPerPixel: 0.022, keySteerSpeed: 4, trackHalfWidth: 2.6,
  levelLength: 150, gapWidthMin: 2.5, gapWidthMax: 4.5,
  gapIntervalMin: 16, gapIntervalMax: 26, brickCluster: 4, gateCost: 14,
  brickUnit: 0.3,
  camOffsetY: 5.2, camOffsetZ: -7.5, camLerp: 6, camXFactor: 0.6,
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// —— 与 assets/scripts/LevelGen.ts 逐行为对齐的母本实现（parity 基线）——
export function genLevel(seed, cfg = DEFAULT_CFG) {
  const rnd = mulberry32(seed);
  const halfW = cfg.trackHalfWidth - 0.8;

  const gaps = [];
  let z = 8;
  while (z < cfg.levelLength - 14) {
    const width = cfg.gapWidthMin + rnd() * (cfg.gapWidthMax - cfg.gapWidthMin);
    gaps.push({ zStart: z, zEnd: z + width, cost: Math.ceil(width) });
    z = z + width + cfg.gapIntervalMin + rnd() * (cfg.gapIntervalMax - cfg.gapIntervalMin);
  }
  const gateZ = cfg.levelLength - 6;

  const runZones = [];
  let prev = 0;
  for (const g of gaps) { runZones.push([prev, g.zStart]); prev = g.zEnd; }
  runZones.push([prev, gateZ - 2]);

  const pickups = [];
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

  const need = cfg.gateCost + gaps.reduce((s, g) => s + g.cost, 0);
  while (pickups.length * cfg.brickCluster < need) {
    const zone = runZones[Math.floor(rnd() * runZones.length)];
    if (!zone || zone[1] - zone[0] < 6) break;
    pickups.push({ x: (rnd() * 2 - 1) * halfW, z: zone[0] + 2 + rnd() * Math.max(1, zone[1] - zone[0] - 4) });
  }

  return { length: cfg.levelLength, gaps, pickups, gateZ, gateCost: cfg.gateCost };
}

export function levelStats(level, cfg = DEFAULT_CFG) {
  const obtainable = level.pickups.length * cfg.brickCluster;
  const need = level.gateCost + level.gaps.reduce((s, g) => s + g.cost, 0);
  return { obtainable, need, ok: obtainable >= need };
}

// —— 前缀供需检查（Q4 核心不变量）——
// 全局 obtainable>=need 不够：玩家是顺序前进的，走到第 i 个断崖时，
// 只花得起「前 i 段区间里能吃到的砖」。返回每个断崖的前缀盈余，负数 = 死局。
export function zonesOf(level) {
  const zones = [];
  let prev = 0;
  for (const g of level.gaps) { zones.push([prev, g.zStart]); prev = g.zEnd; }
  zones.push([prev, level.gateZ]);
  return zones;
}

export function prefixBalance(level, cfg = DEFAULT_CFG) {
  const zones = zonesOf(level);
  const perZone = zones.map(([z0, z1]) =>
    level.pickups.filter((p) => p.z >= z0 && p.z < z1).length * cfg.brickCluster);
  const surplus = []; // surplus[i] = 到达第 i 个断崖前（含第 i 段区间）的累计余砖；最后一个是终点门后
  let acc = 0;
  for (let i = 0; i < level.gaps.length; i++) {
    acc += perZone[i] - level.gaps[i].cost;
    surplus.push(acc);
  }
  acc += perZone[perZone.length - 1] - level.gateCost;
  surplus.push(acc);
  const minAt = surplus.indexOf(Math.min(...surplus));
  return { perZone, surplus, feasible: surplus.every((s) => s >= 0), minSurplus: Math.min(...surplus), minAt };
}

// —— v2 修复：兜底补砖改为「补进最早缺砖的区间」，保证前缀可行 ——
export function genLevelV2(seed, cfg = DEFAULT_CFG) {
  const level = genLevel(seed, cfg);
  const zones = zonesOf(level);
  let guard = 0;
  while (guard++ < 500) {
    const { surplus } = prefixBalance(level, cfg);
    const bad = surplus.findIndex((s) => s < 0);
    if (bad === -1) break;
    // 在第 bad 个断崖之前的区间里补一组砖（挑余量最负点之前的可跑区间）
    const zoneIdx = chooseZoneToFix(zones, level, bad);
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

function chooseZoneToFix(zones, level, badGapIdx) {
  // 优先补「紧挨着死断崖之前」且长度足够的区间；往前找
  for (let i = badGapIdx; i >= 0; i--) {
    const [z0, z1] = zones[i];
    if (z1 - z0 >= 6) return i;
  }
  return -1;
}

// —— bot 模拟器（QA 门禁）：按 GameApp 运行时规则逐步推进，贪心吃砖 ——
// 规则镜像：速度=min(maxSpeed, runSpeed+bricks*speedPerBrick)；
// 拾取扫掠 [prevZ,z]∋p.z±0.7 且 |x-p.x|<0.95；断崖扫掠进区即 扣砖铺桥/否则掉落；门 z>=gateZ-0.5 验砖
export function botRun(level, cfg = DEFAULT_CFG, opts = {}) {
  const lateralMax = opts.lateralMax ?? 9; // 人手横移极限（m/s），保守值
  const dt = opts.dt ?? 1 / 60;
  const taken = level.pickups.map(() => false);
  const bridged = level.gaps.map(() => false);
  let x = 0, z = 0, bricks = 0, t = 0;
  const maxT = opts.maxT ?? 60;
  while (t < maxT) {
    const speed = Math.min(cfg.maxSpeed, cfg.runSpeed + bricks * cfg.speedPerBrick);
    const prevZ = z;
    z += speed * dt;
    // 目标横位 = 前方 12m 内最近未吃拾取的 x（没有就回中）
    let target = 0, bestZ = Infinity;
    for (let i = 0; i < level.pickups.length; i++) {
      const p = level.pickups[i];
      if (taken[i] || p.z < z - 0.7 || p.z > z + 12) continue;
      if (p.z < bestZ) { bestZ = p.z; target = p.x; }
    }
    const dx = target - x;
    const lim = lateralMax * dt;
    x += Math.max(-lim, Math.min(lim, dx));
    const m = cfg.trackHalfWidth - 0.45;
    x = Math.max(-m, Math.min(m, x));
    t += dt;

    for (let i = 0; i < level.pickups.length; i++) {
      if (taken[i]) continue;
      const p = level.pickups[i];
      if (z >= p.z - 0.7 && prevZ <= p.z + 0.7 && Math.abs(x - p.x) < 0.95) {
        taken[i] = true; bricks += cfg.brickCluster;
      }
    }
    for (let i = 0; i < level.gaps.length; i++) {
      if (bridged[i]) continue;
      const g = level.gaps[i];
      if (z >= g.zStart && prevZ < g.zEnd + 0.5) {
        if (bricks >= g.cost) { bricks -= g.cost; bridged[i] = true; }
        else return { outcome: 'fall', gapIndex: i, bricks, z, t };
      }
    }
    if (z >= level.gateZ - 0.5) {
      return bricks >= level.gateCost
        ? { outcome: 'win', bricks, t, collected: taken.filter(Boolean).length }
        : { outcome: 'short', bricks, t };
    }
  }
  return { outcome: 'timeout', bricks, t };
}
