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
// opts.tailSafe=true：D1 根治——把最后一个断崖钳回 length-14 之前，末段恒 >=8m。
// 默认 false 保持与现网 TS 位级一致，仅供 genLevelV3 内部使用。
export function genLevel(seed, cfg = DEFAULT_CFG, opts = {}) {
  const tailSafe = opts.tailSafe === true;
  const rnd = mulberry32(seed);
  const halfW = cfg.trackHalfWidth - 0.8;

  const gaps = [];
  let z = 8;
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

// 供需只数砖拾取（v4 起 kind:'shoe' 不计入供给 = 道具可行性无关化）
export function levelStats(level, cfg = DEFAULT_CFG) {
  const obtainable = level.pickups.filter((p) => !p.kind).length * cfg.brickCluster;
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
    level.pickups.filter((p) => !p.kind && p.z >= z0 && p.z < z1).length * cfg.brickCluster);
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
  repairPrefixSupply(level, cfg, seed, 0);
  spaceOutPickups(level, zones); // v2.1：同区间两拾取 z 间距 >=4m，消除"二选一"贪心死角
  return level;
}

// —— v3：D1 几何根治（tailSafe）+ 按难度带的供给修复（margin + 倍率 k）——
// 修复目标（每个前缀点 i 同时满足）：
//   ① 余量 surplus_i >= margin（绝对容错，块）
//   ② 累计供给 >= k × 累计需求（乘法溢出；k=1 时即①的特例）
// 依据：失误人形 bot 归因实测（sim.mjs §11）——漏吃 25% 时纯加法 margin 下 L7 胜率 0%，
// 反应/横移/瞄准全绿；瓶颈唯一是供给量。真人有效拾取率≈65~75%，故 k 带 1.35~2.0。
// —— v4：道具门（+N / ×N）+ 加速鞋（复刻原版 Shortcut Run 道具集）——
// 开关：opts.items = { addGates, mulGates, shoes, addValue?, mulValue? }（levels.mjs itemsFor 给分带）
//      或 cfg.enableItems=true 走默认计划。**关闭时（默认）输出与 v3 逐字节一致**，
//      §14/§16 parity 锚不失效。开启时仅新增 level.gates 数组与拾取项上的 kind:'shoe'。
// 可行性不变量：供需数学（levelStats/prefixBalance/repair）全部只数无 kind 的砖拾取，
// 门与鞋是纯增益——开道具永远不可能制造新死局（sim.mjs §19 断言）。
export const ITEMS_DEFAULT = { addGates: 1, mulGates: 1, shoes: 1 };

export function genLevelV3(seed, cfg = DEFAULT_CFG, opts = {}) {
  const margin = opts.margin ?? cfg.supplyMargin ?? 2;
  const k = opts.supplyRatio ?? cfg.supplyRatio ?? 1;
  const level = genLevel(seed, cfg, { tailSafe: true });
  repairPrefixSupply(level, cfg, seed, margin, k);
  spaceOutPickups(level, zonesOf(level));
  const items = opts.items ?? (cfg.enableItems ? ITEMS_DEFAULT : null);
  if (items) placeItems(level, cfg, seed, items);
  return level;
}

// 道具布置（独立子种子，确定性）：门放在可跑区间内、避开断崖与彼此；
// 鞋作为 kind:'shoe' 拾取追加在空间足够的区间。放不下的名额直接放弃（计数<=计划）。
function placeItems(level, cfg, seed, plan) {
  const rnd = mulberry32(seed * 104729 + 7);
  const zones = zonesOf(level);
  const gates = [];
  const putGate = (type, v, from, to) => {
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

function repairPrefixSupply(level, cfg, seed, margin, k = 1) {
  const zones = zonesOf(level);
  let guard = 0;
  while (guard++ < 500) {
    const { surplus, perZone } = prefixBalance(level, cfg);
    // 累计需求：demand[i]=过完第 i 个断崖所需总砖；末位含终点门
    const demand = [];
    let d = 0;
    for (const g of level.gaps) { d += g.cost; demand.push(d); }
    demand.push(d + level.gateCost);
    const supply = []; // 累计供给（块）
    let acc = 0;
    for (let i = 0; i < perZone.length; i++) { acc += perZone[i]; supply.push(acc); }
    let bad = -1;
    for (let i = 0; i < surplus.length; i++) {
      if (surplus[i] < margin || supply[i] < k * demand[i] - 1e-9) { bad = i; break; }
    }
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
}

// 同区间内拾取沿 z 摊开：先保持首个不动逐个前推；撞区间尾则从尾部回推。
// 确定性、纯几何，不增删拾取所以不影响供需
export function spaceOutPickups(level, zones, minGap = 4) {
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

function chooseZoneToFix(zones, level, badGapIdx) {
  // 优先补「紧挨着死断崖之前」且长度足够的区间；往前找
  for (let i = badGapIdx; i >= 0; i--) {
    const [z0, z1] = zones[i];
    if (z1 - z0 >= 6) return i;
  }
  return -1;
}

// 「平均玩家」标准参数（QA 口径，sim/step-5 smoke 共用）：
// 25% 吃到仍漏 + 180ms 反应间隔 + 35cm 瞄准偏差 + 6.5m/s 横移（贪心是 9）
export const HUMAN_AVG = { pMiss: 0.25, reactSec: 0.18, jitter: 0.35, lateralMax: 6.5 };

// —— bot 模拟器（QA 门禁）：按 GameApp 运行时规则逐步推进，贪心吃砖 ——
// 规则镜像：速度=min(maxSpeed, runSpeed+bricks*speedPerBrick)；
// 拾取扫掠 [prevZ,z]∋p.z±0.7 且 |x-p.x|<0.95；断崖扫掠进区即 扣砖铺桥/否则掉落；门 z>=gateZ-0.5 验砖
// opts 全缺省 = 零失误贪心（既有断言口径）；传 reactSec/pMiss/jitter 变"失误人形 bot"：
//   reactSec 目标重算间隔（>0 时不再逐帧完美规划）、pMiss 每次吃到时漏吃概率、
//   jitter 瞄准横偏（±米）、look 前瞻距离。seed 保证确定，漏吃用 missed[] 标记防重复掷骰。
export function botRun(level, cfg = DEFAULT_CFG, opts = {}) {
  const lateralMax = opts.lateralMax ?? 9; // 人手横移极限（m/s），保守值
  const dt = opts.dt ?? 1 / 60;
  const reactSec = opts.reactSec ?? 0;
  const pMiss = opts.pMiss ?? 0;
  const jitter = opts.jitter ?? 0;
  const look = opts.look ?? 12;
  // v4 道具镜像：shoeMul/shoeDur=提速鞋参数；chaseShoes=false（默认）bot 不专门为鞋横跳，
  // 鞋只按顺路判定吃到——保证 bot 口径下道具纯增益、胜率断言不因绕路抖动而脆
  const shoeMul = opts.shoeMul ?? 1.35;
  const shoeDur = opts.shoeDur ?? 3.5;
  const chaseShoes = opts.chaseShoes === true;
  const gates = level.gates ?? [];
  const fired = gates.map(() => false);
  let shoeUntil = -Infinity;
  const rnd = pMiss || jitter ? mulberry32(opts.seed ?? 1) : null;
  const taken = level.pickups.map(() => false);
  const missed = level.pickups.map(() => false);
  const bridged = level.gaps.map(() => false);
  let x = 0, z = 0, bricks = 0, t = 0;
  let target = 0, lastPlan = -Infinity;
  const maxT = opts.maxT ?? 60;
  while (t < maxT) {
    let speed = Math.min(cfg.maxSpeed, cfg.runSpeed + bricks * cfg.speedPerBrick);
    if (t < shoeUntil) speed *= shoeMul;
    const prevZ = z;
    z += speed * dt;
    // 目标横位：贪心=前方 look 内最近未吃拾取；人形=每 reactSec 才重算一次
    if (reactSec <= 0 || t - lastPlan >= reactSec) {
      target = 0;
      let bestZ = Infinity;
      for (let i = 0; i < level.pickups.length; i++) {
        const p = level.pickups[i];
        if (taken[i] || missed[i] || p.z < z - 0.7 || p.z > z + look) continue;
        if (p.kind === 'shoe' && !chaseShoes) continue;
        if (p.z < bestZ) { bestZ = p.z; target = p.x; }
      }
      if (rnd && jitter) target += (rnd() * 2 - 1) * jitter;
      lastPlan = t;
    }
    const dx = target - x;
    const lim = lateralMax * dt;
    x += Math.max(-lim, Math.min(lim, dx));
    const m = cfg.trackHalfWidth - 0.45;
    x = Math.max(-m, Math.min(m, x));
    t += dt;

    for (let i = 0; i < level.pickups.length; i++) {
      if (taken[i] || missed[i]) continue;
      const p = level.pickups[i];
      if (z >= p.z - 0.7 && prevZ <= p.z + 0.7 && Math.abs(x - p.x) < 0.95) {
        if (rnd && rnd() < pMiss) missed[i] = true;
        else {
          taken[i] = true;
          if (p.kind === 'shoe') shoeUntil = t + shoeDur;
          else bricks += cfg.brickCluster;
        }
      }
    }
    for (let i = 0; i < gates.length; i++) {
      if (fired[i]) continue;
      if (z >= gates[i].z && prevZ < gates[i].z + 0.5) {
        fired[i] = true;
        bricks = gates[i].type === 'add'
          ? bricks + gates[i].v
          : Math.round(bricks * gates[i].v);
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
