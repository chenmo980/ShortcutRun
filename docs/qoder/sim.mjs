// docs/qoder/sim.mjs —— 桥版规则母本 headless 断言（node docs/qoder/sim.mjs）
// 覆盖：parity（与 assets/scripts/LevelGen.ts 逐 seed 对齐）、确定性、结构不变量、
// 全局供需、前缀供需（Q4 核心）、bot 通关率、难度单调性
import {
  DEFAULT_CFG, genLevel, genLevelV2, genLevelV3, levelStats, prefixBalance, botRun, zonesOf, HUMAN_AVG,
} from './bridge-rules.mjs';
import { cfgForLevel, bandFor, marginFor, ratioFor, itemsFor } from './levels.mjs';
import { genLevel as tsGenLevel, genLevelV3 as tsGenLevelV3 } from '../../assets/scripts/LevelGen.ts';
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

// 8. v2.1 拾取间距不变量：同区间两拾取 z 间距 >=4m（窄区间均匀摊兜底），且拾取不出所属区间、不改供需
{
  let bad = '', narrow = 0, pairs = 0;
  for (let s = 1; s <= N && !bad; s++) {
    const L = genLevelV2(s, DEFAULT_CFG);
    const zones = zonesOf(L);
    for (const [z0, z1] of zones) {
      const inZone = L.pickups.filter((p) => p.z >= z0 && p.z < z1).sort((a, b) => a.z - b.z);
      if (inZone.length < 2) continue;
      const usable = (z1 - 1) - (z0 + 1);
      const canSpace = usable >= 4 * (inZone.length - 1);
      if (!canSpace) narrow++;
      for (let i = 1; i < inZone.length; i++) {
        pairs++;
        const gapM = inZone[i].z - inZone[i - 1].z;
        if (canSpace && gapM < 3.999) bad = `seed${s} gap=${gapM.toFixed(2)} zone[${z0},${z1})`;
      }
    }
    for (const p of L.pickups) {
      if (!zones.some(([z0, z1]) => p.z >= z0 && p.z < z1)) bad = `seed${s} pickup z=${p.z.toFixed(1)} outside all zones`;
    }
    // 供需不受影响：count 与修复前一致（spaceOut 不增删），前缀可行已由 §5 覆盖
    if (!prefixBalance(L, DEFAULT_CFG).feasible) bad = `seed${s} prefix infeasible after v2.1`;
  }
  console.log(`info v2.1 spacing: ${pairs} same-zone pairs, ${narrow} narrow zones (uniform-spread fallback)`);
  check(`v2.1 spacing invariant ${N} seeds`, !bad, bad);
  const a = genLevelV2(42, DEFAULT_CFG), b = genLevelV2(42, DEFAULT_CFG);
  check('v2.1 determinism', JSON.stringify(a) === JSON.stringify(b));
}

// 9. L1-L10 分段验收（levels.mjs cfgForLevel + 60 seed/关 bot 胜率带）
{
  const M = 60;
  const rows = [];
  const times = [];
  let bad = '';
  for (let lv = 1; lv <= 10; lv++) {
    const cfg = cfgForLevel(lv);
    const band = bandFor(lv);
    let wins = 0, tSum = 0;
    for (let s = lv * 1000 + 1; s <= lv * 1000 + M; s++) {
      const r = botRun(genLevelV2(s, cfg), cfg);
      if (r.outcome === 'win') { wins++; tSum += r.t; }
    }
    const avgT = wins ? tSum / wins : NaN;
    rows.push(`  L${lv}: band=${Math.round(band * 100)}% win=${wins}/${M} avgT=${wins ? avgT.toFixed(1) : '-'}s`);
    if (wins / M + 1e-9 < band) bad += `L${lv}=${(wins / M * 100).toFixed(1)}%<${band * 100}% `;
    times.push(avgT);
  }
  console.log('info level-band acceptance (v2.1 + cfgForLevel, 60 seeds/level):');
  for (const r of rows) console.log(r);
  // 逐关耗时不严格单调（各级提速会抵消长度增长），只约束首尾趋势
  if (!(times[9] > times[0])) bad += `L10 avgT=${times[9]} <= L1 avgT=${times[0]} `;
  check('L1-L10 bot win-rate inside bands', !bad, bad);
}

// 10. v3：D1 几何根治 + 分段供给余量
{
  // 10a. tailSafe：末崖 zEnd 恒 <= length-14（v2 下同口径 degen=337/2000）
  let degen = 0;
  for (let s = 1; s <= N; s++) {
    const L = genLevelV3(s, DEFAULT_CFG, { margin: 0 });
    if (L.gaps.length && L.gaps[L.gaps.length - 1].zEnd > L.length - 14 + 1e-9) degen++;
  }
  check(`v3 tailSafe degen=0 ${N} seeds`, degen === 0, `degen=${degen}`);

  // 10b. L1-L10：每个前缀点余量 >= marginFor(lv)，且胜率仍在带内
  const M = 60;
  const rows = [];
  let bad = '';
  const times = [];
  for (let lv = 1; lv <= 10; lv++) {
    const cfg = cfgForLevel(lv);
    const m = marginFor(lv);
    let wins = 0, tSum = 0, worst = Infinity;
    for (let s = lv * 1000 + 1; s <= lv * 1000 + M; s++) {
      const L = genLevelV3(s, cfg); // 不传 opts 走 cfg.supplyMargin，验证接入路径
      const ms = prefixBalance(L, cfg).minSurplus;
      worst = Math.min(worst, ms);
      if (ms < m) bad += `L${lv}s${s} surplus=${ms}<${m} `;
      const r = botRun(L, cfg);
      if (r.outcome === 'win') { wins++; tSum += r.t; }
    }
    const avgT = wins ? tSum / wins : NaN;
    rows.push(`  L${lv}: margin=${m} worstSurplus=${worst} win=${wins}/${M} avgT=${wins ? avgT.toFixed(1) : '-'}s`);
    if (wins / M + 1e-9 < bandFor(lv)) bad += `L${lv} win ${(wins / M * 100).toFixed(0)}%<${bandFor(lv) * 100}% `;
    times.push(avgT);
  }
  console.log('info v3 acceptance (tailSafe + supplyMargin, 60 seeds/level):');
  for (const r of rows) console.log(r);
  if (!(times[9] > times[0])) bad += `L10 avgT<=L1 avgT `;
  check('v3 margin + bands L1-L10', !bad, bad);
  const a = genLevelV3(99, cfgForLevel(5)), b = genLevelV3(99, cfgForLevel(5));
  check('v3 determinism', JSON.stringify(a) === JSON.stringify(b));
}

// 11. 失误人形 bot 验收（真人胜率曲线才是难度口径；贪心 bot 只是可达性上限）
{
  const M = 150;
  const rows = [];
  let bad = '';
  for (let lv = 1; lv <= 10; lv++) {
    const cfg = cfgForLevel(lv);
    const band = lv <= 3 ? 0.80 : lv <= 7 ? 0.70 : 0.40;
    let w = 0, dead = 0;
    for (let s = 1; s <= M; s++) {
      const seed = lv * 1000 + s;
      const r = botRun(genLevelV3(seed, cfg), cfg, { ...HUMAN_AVG, seed });
      if (r.outcome === 'win') w++;
      else if (r.outcome !== 'fall') dead++; // short/timeout = 供给设计失效，必须趋零
    }
    const rate = w / M;
    rows.push(`  L${lv}: human=${(rate * 100).toFixed(0)}% (band>=${band * 100}%, k=${ratioFor(lv)}) 非崖死=${((dead / M) * 100).toFixed(0)}%`);
    if (rate + 1e-9 < band) bad += `L${lv}=${(rate * 100).toFixed(0)}%<${band * 100}% `;
    if (dead / M > 0.10) bad += `L${lv} non-cliff-death ${((dead / M) * 100).toFixed(0)}%>10% `;
  }
  console.log('info human-like bot acceptance (HUMAN_AVG=pMiss.25/react180ms/jitter.35/lateral6.5, 150 seeds/level):');
  for (const r of rows) console.log(r);
  check('human win curve inside bands L1-L10', !bad, bad);
  const c = cfgForLevel(3);
  const h1 = botRun(genLevelV3(3001, c), c, { ...HUMAN_AVG, seed: 3001 });
  const h2 = botRun(genLevelV3(3001, c), c, { ...HUMAN_AVG, seed: 3001 });
  check('human bot determinism', h1.outcome === h2.outcome && h1.bricks === h2.bricks && h1.t === h2.t);
}

// 12. progression.mjs 关卡循环元规则（含与生成器互操作）
{
  const { createProgress, STORAGE_KEY } = await import('./progression.mjs');
  const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  let bad = '';
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const store = memStore();
  const p = createProgress(store);
  if (!eq(p.state(), { v: 1, level: 1, attempt: 1, wins: 0, best: {} })) bad += 'fresh ';
  let c = p.current(cfgForLevel);
  if (c.level !== 1 || c.seed !== 1001 || c.cfg.levelLength !== cfgForLevel(1).levelLength) bad += 'current1 ';

  // 胜 → 进关、attempt 归 1、seed 换关
  const w1 = p.win(16.0, 5); // L1 par=16.5 → 时间星 + 余砖星 = 3 星
  if (w1.stars !== 3 || w1.nextLevel !== 2) bad += 'win1 ';
  c = p.current(cfgForLevel);
  if (c.seed !== 2001) bad += 'seed2 ';

  // 连败同关：attempt 递增换图，关号不动
  p.lose(); p.lose();
  c = p.current(cfgForLevel);
  if (c.level !== 2 || c.seed !== 2003) bad += 'retry ';

  // 重启存活：同一 store 新建实例 = 状态续上
  const p2 = createProgress(store);
  if (!eq(p2.state(), p.state())) bad += 'persist ';

  // 脏数据自愈
  store.setItem(STORAGE_KEY, '{oops');
  const p3 = createProgress(store);
  if (p3.state().level !== 1) bad += 'corrupt-recovery ';

  // best 成绩记录：线性爬关不可能同关二胜，只验"每关记首通+星标准确"
  const p4 = createProgress(memStore());
  p4.win(20.0, 4);                // L1（par16.5）：无时间星+余砖星=2 星
  p4.win(30.0, 0);                // L2：1 星
  p4.lose();                      // L3 失败换图
  const w2 = p4.win(18.0, 9);     // L3（par20.0）：3 星
  const st = p4.state();
  if (st.best[1].time !== 20 || st.best[1].stars !== 2) bad += 'best1 ' + JSON.stringify(st.best[1]);
  if (st.best[2].time !== 30 || st.best[2].stars !== 1) bad += 'best2 ' + JSON.stringify(st.best[2]);
  if (w2.stars !== 3 || st.best[3].time !== 18) bad += 'best3 ';
  if (st.level !== 4 || st.wins !== 3) bad += 'wins ';

  // attempt 封顶 99
  const p5 = createProgress(memStore());
  for (let i = 0; i < 300; i++) p5.lose();
  if (p5.current(cfgForLevel).seed !== 1099) bad += 'cap ';

  // 与生成器互操作：真实玩 30 关的 seed 序列，每图都必须前缀可行 + 贪心可赢
  const p6 = createProgress(memStore());
  for (let lv = 1; lv <= 30; lv++) {
    const { seed, cfg } = p6.current(cfgForLevel);
    const L = genLevelV3(seed, cfg);
    if (!prefixBalance(L, cfg).feasible) bad += `L${lv}seed${seed} infeasible `;
    if (botRun(L, cfg).outcome !== 'win') bad += `L${lv}seed${seed} greedy-lose `;
    p6.win(10, 6); // 直接推进（星级在此不重要）
  }
  check('progression loop + generator interop', !bad, bad);
}

// 13. L11-L30 循环加深段：终局平台禁崩（曾实测出 3~13% 胜率墙=留存杀手，回归锁）
{
  const M = 80;
  const rate = [];
  let bad = '';
  for (let lv = 11; lv <= 30; lv++) {
    const cfg = cfgForLevel(lv);
    let w = 0, dead = 0;
    for (let s = 1; s <= M; s++) {
      const seed = lv * 1000 + s;
      const r = botRun(genLevelV3(seed, cfg), cfg, { ...HUMAN_AVG, seed });
      if (r.outcome === 'win') w++;
      else if (r.outcome !== 'fall') dead++;
    }
    rate.push(w / M);
    if (w / M < 0.25) bad += `L${lv}=${((w / M) * 100).toFixed(0)}%<25%wall `;
    if (dead / M > 0.08) bad += `L${lv} nonCliffDeath=${((dead / M) * 100).toFixed(0)}% `;
  }
  console.log('info deep plateau L11-30:', rate.map((r, i) => `L${i + 11}=${(r * 100).toFixed(0)}`).join(' '));
  // 循环开头回弹（新 loop 前段必须比上一 loop 尾部宽松，锯齿=心跳不是缺陷）
  if (!(rate[21 - 11] > rate[10 - 11 + 9])) bad += 'L21 not looser than L20(worst tail) ';
  check('L11-L30 plateau: no death-wall', !bad, bad);
}

// 14. genLevelV3 跨语言 parity：TS 移植版必须与母本逐 seed 位级一致（step-5 移植验证锁）
{
  let diffs = 0, first = '';
  for (let lv = 1; lv <= 10 && !diffs; lv++) {
    const cfg = cfgForLevel(lv, CFG);
    for (let a = 1; a <= 100; a++) {
      const seed = lv * 1000 + a;
      if (JSON.stringify(genLevelV3(seed, cfg)) !== JSON.stringify(tsGenLevelV3(seed, cfg))) { diffs++; if (!first) first = `L${lv} seed${seed}`; break; }
    }
  }
  check('v3 parity-js-vs-ts 1000 seeds', diffs === 0, first ? `first diff ${first}` : '');
}

// 15. 曲线拷贝漂移锁：两处拷贝（Cocos LevelCurve.ts / web-preview 内联）必须与 levels.mjs 母本 L1-L60 逐值一致
{
  const { readFileSync, writeFileSync, unlinkSync } = await import('node:fs');
  // LevelCurve.ts 用了无扩展名运行时 import（node ESM 解析不了），重写为绝对 URL 后经临时文件加载
  const lcSrc = readFileSync(new URL('../../assets/scripts/LevelCurve.ts', import.meta.url), 'utf8')
    .replace(/from '\.\/config'/g, `from '${new URL('../../assets/scripts/config.ts', import.meta.url).href}'`);
  const tmp = new URL('./.tmp-LevelCurve.ts', import.meta.url);
  writeFileSync(tmp, lcSrc);
  const { cfgForLevel: tsCfg } = await import(tmp.href);
  unlinkSync(tmp);
  let badTs = '';
  for (let lv = 1; lv <= 60 && !badTs; lv++) {
    const m = cfgForLevel(lv), t = tsCfg(lv);
    for (const k of Object.keys(m)) if (Math.abs(t[k] - m[k]) > 1e-9) { badTs = `L${lv}.${k}: ts=${t[k]} master=${m[k]}`; break; }
  }
  check('curve-drift lock: assets/LevelCurve.ts', !badTs, badTs);

  const html = readFileSync(new URL('../../web-preview/index.html', import.meta.url), 'utf8');
  const grab = (re, what) => { const m = html.match(re); if (!m) { badTs = ''; throw new Error('preview 曲线抽取失败(' + what + ')，请保持函数名 cfgForLevel/marginFor/ratioFor/CURVE/CFG'); } return m[0]; };
  const src = [
    grab(/const CFG = \{[\s\S]*?\};/, 'CFG'),
    grab(/const CURVE = \[[\s\S]*?\];/, 'CURVE'),
    grab(/function marginFor\(level\)[^\n]*\n/, 'marginFor'),
    grab(/function ratioFor\(level\)[^\n]*\n/, 'ratioFor'),
    grab(/function cfgForLevel\(level\) \{[\s\S]*?\n\}/, 'cfgForLevel'),
    'this.f = cfgForLevel;',
  ].join('\n');
  const { default: vm } = await import('node:vm');
  const sb = vm.createContext({ Math });
  vm.runInContext(src, sb);
  let badPv = '';
  for (let lv = 1; lv <= 60 && !badPv; lv++) {
    const m = cfgForLevel(lv), t = sb.f(lv);
    for (const k of Object.keys(m)) if (Math.abs(t[k] - m[k]) > 1e-9) { badPv = `L${lv}.${k}: pv=${t[k]} master=${m[k]}`; break; }
  }
  check('curve-drift lock: web-preview inline', !badPv, badPv);
}

// 16. 预览内联运行时生成器 parity：web-preview 的 genLevelV3 整段必须与母本逐 seed 位级一致。
//     §15b 只锁曲线拷贝；补砖/摊开等运行时几何同样会漂移（历史上漂移过一次：修复补砖子种子被复用，
//     导致 6 个补点 x 完全相同）。抽取区间：'function mulberry32' 起，到曲线注释标记止。
{
  const { default: fs } = await import('node:fs');
  const html = fs.readFileSync(new URL('../../web-preview/index.html', import.meta.url), 'utf8');
  const s0 = html.indexOf('function mulberry32');
  const s1 = html.indexOf('// ===== 关卡进阶曲线');
  if (s0 < 0 || s1 <= s0) {
    check('preview-inline genLevelV3 parity', false, '抽取失败：请保留 mulberry32 函数名与"关卡进阶曲线"注释标记');
  } else {
    const { default: vm } = await import('node:vm');
    const sb = vm.createContext({ Math, console });
    vm.runInContext(html.slice(s0, s1), sb, { filename: 'web-preview-inline' });
    let badPvGen = '';
    outer: for (let lv = 1; lv <= 10; lv++) {
      for (let att = 1; att <= 10; att++) {
        const seed = lv * 1000 + att;
        const a = JSON.stringify(sb.genLevelV3(seed, cfgForLevel(lv)));
        const b = JSON.stringify(genLevelV3(seed, cfgForLevel(lv)));
        if (a !== b) { badPvGen = `L${lv} seed=${seed}`; break outer; }
      }
    }
    check('preview-inline genLevelV3 parity (100 levels)', !badPvGen, badPvGen);
  }
}

// 17. 推进元规则漂移锁：web-preview 内联 prog（关卡/attempt/星级/存档）必须与
//     progression.mjs 母本行为全等——同一操作序列下 state()/返回值逐步比对 +
//     starsFor 边界扫描 + 脏档自愈 + 存储键一致。规则漂移 = 玩家存档语义分叉，属严重。
{
  const { default: fs } = await import('node:fs');
  const { default: vm } = await import('node:vm');
  const { createProgress, starsFor: mStars, STORAGE_KEY } = await import('./progression.mjs');
  const html = fs.readFileSync(new URL('../../web-preview/index.html', import.meta.url), 'utf8');
  const p0 = html.indexOf('// ===== 关卡推进（移植自');
  const p1 = html.indexOf('// ============ 关卡生成');
  if (p0 < 0 || p1 <= p0) {
    check('preview-inline progression parity', false, '抽取失败：请保留"关卡推进（移植自"注释与"关卡生成"分节标记');
  } else {
    const mkStore = (initRaw) => {
      const m = initRaw ? new Map([[STORAGE_KEY, initRaw]]) : new Map();
      return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
    };
    const compile = (storeObj) => {
      const sb = vm.createContext({ Math, JSON, console, localStorage: storeObj, cfgForLevel });
      vm.runInContext(
        html.slice(p0, p1) +
        '\nObject.assign(this, { __state: () => prog.state(), __win: (t, b) => prog.win(t, b), __lose: () => prog.lose(), __reset: () => prog.reset(), __key: SR_KEY, __stars: starsFor, __current: () => prog.current(cfgForLevel) });',
        sb, { filename: 'preview-prog-inline' });
      return sb;
    };
    let bad17 = '';
    // a) 存储键一致 + current() 三元组（level/seed/cfg）与母本一致
    const sbA = compile(mkStore());
    if (sbA.__key !== STORAGE_KEY) bad17 = `PROG_KEY=${sbA.__key} != 母本 ${STORAGE_KEY}`;
    if (!bad17) {
      const pM0 = createProgress(mkStore());
      if (JSON.stringify(pM0.current(cfgForLevel)) !== JSON.stringify(sbA.__current())) bad17 = 'current() 分叉';
    }
    // b) 真实操作序列逐步行为全等（含星级边界、连败封顶、重复刷 best）
    if (!bad17) {
      const pM = createProgress(mkStore());
      const ops = [];
      for (let lv = 1; lv <= 14; lv++) {
        ops.push(['win', 15 + lv, lv % 4]);
        if (lv % 3 === 0) ops.push(['lose'], ['lose']);
        if (lv % 5 === 0) ops.push(['win', 22, 9], ['lose']);
      }
      for (let i = 0; i < 150; i++) ops.push(['lose']);
      for (const op of ops) {
        let rM, rP;
        if (op[0] === 'win') { rM = pM.win(op[1], op[2]); rP = sbA.__win(op[1], op[2]); }
        else if (op[0] === 'lose') { rM = pM.lose(); rP = sbA.__lose(); }
        if (JSON.stringify(rM) !== JSON.stringify(rP)) { bad17 = `op ${op.join(',')} 返回值分叉`; break; }
        if (JSON.stringify(pM.state()) !== JSON.stringify(sbA.__state())) { bad17 = `op ${op.join(',')} state 分叉`; break; }
      }
    }
    // c) starsFor 边界扫描（L1-L12 × 时间/余砖临界值）
    if (!bad17) {
      outer17: for (let lv = 1; lv <= 12; lv++) {
        for (const t of [0, 16, 16.5, 16.51, 18.5, 20, 21, 23, 23.5, 23.51]) {
          for (const b of [0, 2, 3, 4, 99]) {
            if (mStars(lv, t, b) !== sbA.__stars(lv, t, b)) { bad17 = `stars(${lv},${t},${b}) 分叉`; break outer17; }
          }
        }
      }
    }
    // d) 脏档自愈 + 跨重启存活
    if (!bad17) {
      for (const junk of ['not json{{', '{"v":2,"level":5}', '{"v":1,"level":"x"}', 'null']) {
        const sbJ = compile(mkStore(junk));
        const st = sbJ.__state();
        if (!(st.level === 1 && st.attempt === 1 && st.wins === 0)) { bad17 = `脏档未自愈: ${junk}`; break; }
      }
    }
    if (!bad17) {
      const storeB = mkStore();
      const sbB1 = compile(storeB);
      sbB1.__win(16.0, 5); sbB1.__lose();
      const sbB2 = compile(storeB); // 模拟刷新页面：新实例读同一 store
      const st = sbB2.__state();
      if (!(st.level === 2 && st.attempt === 2 && st.wins === 1 && st.best[1])) bad17 = '跨重启未续档';
    }
    check('preview-inline progression parity (ops/stars/junk/restart)', !bad17, bad17);
  }
}

// 18. 整页编译锁：index.html 的内联 <script> 必须整体可解析。
//     §15-§17 都是区域抽取比对，抓不到跨区域重复声明（2026-09-21 实事故：step-5 与 Qoder
//     各插一份 prog 块，const PAR/prog 重复声明 => 整页 SyntaxError => 玩家点击无反应）。
//     编译不执行，不需要 DOM。
{
  const { default: fs } = await import('node:fs');
  const { Script } = await import('node:vm');
  const html = fs.readFileSync(new URL('../../web-preview/index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let bad18 = '';
  scripts.forEach((code, i) => {
    try { new Script(code, { filename: `web-preview-inline-${i}` }); }
    catch (e) { bad18 += `script#${i}: ${e.message}; `; }
  });
  check('whole-page compile lock (dup-decl/SyntaxError)', !bad18 && scripts.length > 0, bad18 || (scripts.length ? '' : '未抽到内联 script'));
}

// 19. v4 道具锁：开关关闭逐字节不变（sha256 快照锚）+ 开启后布置不变量 + 供需无关 + 胜率。
//     锚 = 2026-09-21 v3 定稿输出摘要（改动前采集）。任何无意漂移（哪怕一个 .toFixed 位数）都会红。
{
  const { createHash } = await import('node:crypto');
  const H = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
  const ANCHORS = [
    [3, 2, 'f90fdb59f0c26fad'], [77, 9, '7fef651c042bc33d'], [1001, 5, '945686c2ac0e2fb1'],
    [20260921, 12, 'edc995f05bee41e0'], [42, 7, '6827be087d9a0916'], [999, 15, 'b1174ad314a7f19d'],
  ];
  let bad19 = '';
  for (const [s, lv, h] of ANCHORS) {
    const j = JSON.stringify(genLevelV3(s, cfgForLevel(lv)));
    if (H(j) !== h) { bad19 += `seed=${s} lv=${lv} `; }
  }
  check('v4 items-off byte anchor (6 sha256)', !bad19, bad19);

  // items-off 输出不得含 gates 键 / kind 拾取（形状锁，防"永远加空数组"破坏 TS parity 逐字节比对）
  {
    let bad = '';
    for (let s = 1; s <= 50; s++) {
      const L = genLevelV3(s, cfgForLevel(1 + (s % 10)));
      if ('gates' in L || L.pickups.some((p) => p.kind)) { bad = `seed=${s}`; break; }
    }
    check('items-off shape: no gates key / no kind', !bad, bad);
  }

  // 开启后：确定性 + 布置不变量（门在可跑区间内、避断崖、彼此 >=6m、z<gateZ；鞋数<=计划；门排序）
  {
    let bad = '';
    for (let lv = 3; lv <= 12 && !bad; lv++) {
      const cfg = cfgForLevel(lv), plan = itemsFor(lv);
      if (!plan) continue; // L12 落回教学带（l=2）无道具，属分带设计
      for (let s = 1; s <= 100; s++) {
        const a = JSON.stringify(genLevelV3(lv * 1000 + s, cfg, { items: plan }));
        const b = JSON.stringify(genLevelV3(lv * 1000 + s, cfg, { items: plan }));
        if (a !== b) { bad = `非确定 seed=${lv * 1000 + s}`; break; }
        const L = JSON.parse(a);
        const zones = zonesOf(L);
        if (L.gates.some((g) => g.z >= L.gateZ - 1 || g.z < 8)) { bad = `门越界 ${L.gateZ}`; break; }
        for (const g of L.gates) {
          const inRun = zones.some(([z0, z1]) => g.z > z0 + 1 && g.z < z1 - 1);
          if (!inRun) { bad = `门压在断崖/间隙 ${JSON.stringify(g)} seed=${lv * 1000 + s}`; break; }
        }
        if (bad) break;
        if (L.gates.length > (plan.addGates + plan.mulGates)) { bad = '门超计划'; break; }
        if (L.pickups.filter((p) => p.kind === 'shoe').length > plan.shoes) { bad = '鞋超计划'; break; }
      }
    }
    check('items-on determinism + placement invariants', !bad, bad);
  }

  // 供需无关性：加道具前后 prefixBalance 完全一致（鞋不计数、门不预判）
  {
    let bad = '';
    for (let s = 1; s <= 100; s++) {
      const cfg = cfgForLevel(6);
      const off = JSON.stringify(prefixBalance(genLevelV3(s, cfg)));
      const on = JSON.stringify(prefixBalance(genLevelV3(s, cfg, { items: itemsFor(6) })));
      if (off !== on) { bad = `seed=${s}`; break; }
    }
    check('items do not alter supply/demand math', !bad, bad);
  }

  // 贪心 bot 开道具仍 100% 通关（道具纯增益，不引入新死局）；itemsFor 分带单调
  {
    let losses = 0, tot = 0;
    for (const lv of [3, 4, 5, 6, 7, 8, 9, 10, 13, 25]) {
      const cfg = cfgForLevel(lv);
      for (let s = 1; s <= 60; s++) {
        const r = botRun(genLevelV3(lv * 1000 + s, cfg, { items: itemsFor(lv) }), cfg);
        tot++; if (r.outcome !== 'win') losses++;
      }
    }
    check('greedy bot 100% win with items (600 runs)', losses === 0, `losses=${losses}/${tot}`);
    let bad = '';
    const cnt = (l) => { const p = itemsFor(l); return p ? p.addGates + p.mulGates + p.shoes : 0; };
    if (itemsFor(1) || itemsFor(2)) bad += 'L1-2 应有 null;';
    for (const l of [2, 3, 5, 7]) if (cnt(l + 1) < cnt(l)) bad += `非单调 ${l}->${l + 1};`;
    // loop 微增：同带位（l=3/6）跨 loop 计数严格增（11/21 属 l=1 教学带为 null，不能拿来比）
    for (const l of [3, 6]) if (cnt(l + 10) <= cnt(l) || cnt(l + 20) <= cnt(l + 10)) bad += `loop 未微增 @l=${l};`;
    check('itemsFor bands (L1-2 none, monotonic, loop grows)', !bad, bad);
  }
}

console.log(failed ? `\n${failed} checks FAILED` : '\nbridge-rules OK: all invariants passed');
process.exit(failed ? 1 : 0);
