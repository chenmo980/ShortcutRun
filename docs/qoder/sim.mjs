// docs/qoder/sim.mjs —— 桥版规则母本 headless 断言（node docs/qoder/sim.mjs）
// 覆盖：parity（与 assets/scripts/LevelGen.ts 逐 seed 对齐）、确定性、结构不变量、
// 全局供需、前缀供需（Q4 核心）、bot 通关率、难度单调性
import {
  DEFAULT_CFG, genLevel, genLevelV2, levelStats, prefixBalance, botRun,
} from './bridge-rules.mjs';
import { genLevel as tsGenLevel } from '../../assets/scripts/LevelGen.ts';
import { CFG } from '../../assets/scripts/config.ts';

let failed = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failed++; console.log('FAIL', name, detail); }
  else console.log('ok  ', name, detail);
};

const N = 2000;

// 1. parity：JS 母本 == TS 现网实现（同种子同输出，逐字节）
{
  let bad = -1;
  for (let s = 1; s <= 200; s++) {
    if (JSON.stringify(genLevel(s, CFG)) !== JSON.stringify(tsGenLevel(s, CFG))) { bad = s; break; }
  }
  check('parity-js-vs-ts 200 seeds', bad === -1, bad === -1 ? '' : `first diff seed=${bad}`);
}

// 2. 确定性
{
  const a = genLevel(7, DEFAULT_CFG), b = genLevel(7, DEFAULT_CFG);
  check('determinism', JSON.stringify(a) === JSON.stringify(b));
}

// 3. 结构不变量（硬约束，v1 必须全过）
{
  let bad = '';
  for (let s = 1; s <= N && !bad; s++) {
    const L = genLevel(s, DEFAULT_CFG);
    let prevEnd = -1;
    for (const g of L.gaps) {
      if (g.zStart < 8) bad = `seed${s} gap before safe start`;
      else if (g.zStart <= prevEnd) bad = `seed${s} gap overlap`;
      else if (!(g.cost >= 3 && g.cost <= 5)) bad = `seed${s} cost=${g.cost}`;
      prevEnd = g.zEnd;
    }
    if (!bad && !(L.gateZ === L.length - 6)) bad = `seed${s} gateZ`;
    if (!bad && L.pickups.some((p) => Math.abs(p.x) > DEFAULT_CFG.trackHalfWidth - 0.8 + 1e-9)) bad = `seed${s} pickup x out of lane`;
  }
  check(`structure ${N} seeds`, !bad, bad);
}

// 3b. 已知缺陷测量（v1 现状，期望 >0，用于回归追踪；v2 修复必须归零）
{
  let degen = 0, short1 = 0, short2 = 0;
  for (let s = 1; s <= N; s++) {
    const L = genLevel(s, DEFAULT_CFG);
    const lastGapEnd = L.gaps.length ? L.gaps[L.gaps.length - 1].zEnd : 0;
    if (lastGapEnd > L.gateZ - 8) degen++;
    if (!levelStats(L).ok) short1++;
    if (!levelStats(genLevelV2(s, DEFAULT_CFG)).ok) short2++;
  }
  console.log(`info v1 defect rates: degenerate-final-zone=${degen}/${N} supply-short=${short1}/${N}`);
  check('defect present in v1 (tracked)', degen > 0 || short1 > 0, `degen=${degen} short=${short1}`);
  check(`v2 supply>=need ${N} seeds`, short2 === 0, `violations=${short2}`);
}

// 5. 前缀供需（v1 现状测量 + v2 修复断言）
{
  let v1bad = 0, v2bad = 0, worst = 0;
  for (let s = 1; s <= N; s++) {
    if (!prefixBalance(genLevel(s, DEFAULT_CFG)).feasible) { v1bad++; }
    if (!prefixBalance(genLevelV2(s, DEFAULT_CFG), DEFAULT_CFG).feasible) v2bad++;
  }
  worst = v1bad;
  console.log(`info v1 prefix-infeasible: ${v1bad}/${N} (${(v1bad / N * 100).toFixed(1)}%)`);
  check('v1 defect confirmed (expect >0)', v1bad > 0, `v1bad=${worst}`);
  check(`v2 prefix-feasible ${N} seeds`, v2bad === 0, `violations=${v2bad}`);
}

// 6. bot 通关率（贪心吃砖手法的可达性下界）
{
  const M = 300;
  let v1win = 0, v2win = 0, v1fall = 0, v2fall = 0;
  for (let s = 1; s <= M; s++) {
    const r1 = botRun(genLevel(s, DEFAULT_CFG)).outcome;
    const r2 = botRun(genLevelV2(s, DEFAULT_CFG)).outcome;
    if (r1 === 'win') v1win++; else v1fall++;
    if (r2 === 'win') v2win++; else v2fall++;
  }
  console.log(`info bot win-rate v1=${v1win}/${M} v2=${v2win}/${M}`);
  check('v2 bot win-rate >= 97%', v2win / M >= 0.97, `v2=${v2win}/${M} v1=${v1win}/${M}`);
}

// 7. 难度单调性（关卡 cfg 递增 → 断崖数递增、bot 用时递减趋势）
{
  const rows = [];
  for (let lv = 1; lv <= 8; lv++) {
    const cfg = {
      ...DEFAULT_CFG,
      levelLength: 150 + (lv - 1) * 20,
      gateCost: 14 + (lv - 1) * 2,
      gapWidthMin: Math.min(3.5, 2.5 + (lv - 1) * 0.15),
      gapWidthMax: Math.min(6.0, 4.5 + (lv - 1) * 0.2),
      gapIntervalMin: Math.max(10, 16 - (lv - 1) * 0.8),
      gapIntervalMax: Math.max(16, 26 - (lv - 1) * 1.2),
    };
    let gaps = 0, wins = 0, tSum = 0;
    for (let s = lv * 1000 + 1; s <= lv * 1000 + 60; s++) {
      const L = genLevelV2(s, cfg);
      gaps += L.gaps.length;
      const r = botRun(L, cfg);
      if (r.outcome === 'win') { wins++; tSum += r.t; }
    }
    rows.push({ lv, gaps: (gaps / 60).toFixed(1), win: `${wins}/60`, avgT: wins ? (tSum / wins).toFixed(1) : '-' });
  }
  console.log('info difficulty curve (v2, 60 seeds/level):');
  for (const r of rows) console.log(`  L${r.lv}: gaps=${r.gaps} winRate=${r.win} avgTime=${r.avgT}s`);
  const g1 = rows[0].gaps, g8 = rows[7].gaps;
  check('monotonic: L8 gaps > L1 gaps', +g8 > +g1, `L1=${g1} L8=${g8}`);
  check('L1 win-rate >= 95%', +rows[0].win.split('/')[0] >= 57, rows[0].win);
}

console.log(failed ? `\n${failed} checks FAILED` : '\nbridge-rules OK: all invariants passed');
process.exit(failed ? 1 : 0);
