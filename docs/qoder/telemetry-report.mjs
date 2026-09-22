// G1 遥测汇总（g1-tuning §1 承诺交付，Qoder 出品，cc-free 纯 node）
// 用法：node telemetry-report.mjs <events.json>
//   events.json = sr_telemetry_v1 导出的数组（浏览器 devtools 复制 / Cocos 侧同键导出）
//   事件 schema（step-5 已接线，双端一致）：{level, seed, outcome:'win'|'lose', t, bricksLeft, failZ, pickupsTotal, ts}
// 本脚本离线补全 g1-tuning §1 里你们没埋的两个字段（零改动要求）：
//   failGapIdx：seed=level*1000+attempt 确定性重建关卡，failZ 映射断崖；
//   死因细分：win | fall(掉崖) | short(门前砖尽) | qa(seed 非法=后门刷局，剔除)。
// 输出：每关统计表 + g1-tuning §2 六症状触发器点名。
import { readFileSync } from 'node:fs';
import { genLevelV3 } from './bridge-rules.mjs';
import { cfgForLevel, itemsFor, bandFor } from './levels.mjs';

const file = process.argv[2];
if (!file) { console.error('用法: node telemetry-report.mjs <events.json>'); process.exit(1); }
const events = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(events)) { console.error('events.json 需为数组'); process.exit(1); }

const levelCache = new Map();
function levelOf(ev) {
  const k = `${ev.level}:${ev.seed}`;
  let l = levelCache.get(k);
  if (!l) {
    try {
      const plan = itemsFor(ev.level);
      l = genLevelV3(ev.seed, cfgForLevel(ev.level), plan ? { items: plan } : undefined);
    } catch { l = null; }
    levelCache.set(k, l);
  }
  return l;
}

function classify(ev) {
  if (ev.qa === true) return { kind: 'qa' }; // 引擎侧标记（restart 后门局，若 step-5 接了）
  const attempt = ev.seed - ev.level * 1000;
  if (!(ev.level >= 1 && attempt >= 1 && attempt <= 150)) return { kind: 'qa' };
  if (ev.outcome === 'win') return { kind: 'win' };
  const lv = levelOf(ev);
  if (!lv) return { kind: 'orphan' }; // seed 对不上任何合法关卡
  if (ev.failZ != null && ev.failZ >= lv.gateZ - 2) return { kind: 'short' };
  if (ev.failZ == null) return { kind: 'other' };
  let best = -1, bd = Infinity;
  lv.gaps.forEach((g, i) => {
    const d = ev.failZ >= g.zStart && ev.failZ <= g.zEnd ? 0 : Math.min(Math.abs(ev.failZ - g.zStart), Math.abs(ev.failZ - g.zEnd));
    if (d < bd) { bd = d; best = i; }
  });
  return { kind: 'fall', gapIdx: best };
}

// Wilson 95% 下界（g1-tuning §1：小样本 ±15pt 都是噪声，用下界对带）
function wilsonLower(w, n, z = 1.96) {
  if (!n) return 0;
  const p = w / n;
  const d = 1 + z * z / n;
  return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / d;
}
const median = (a) => { if (!a.length) return '-'; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

const byLevel = new Map();
const dropped = { qa: 0, orphan: 0, dup: 0 };
// restart(1) 后门实测会产生**重复合法 seed**（L1 seed1001 秒级复读，浏览器端到端实证），seed 区间法抓不到。
// 单文件内同键(关,seed)必然唯一（合法推进 attempt 只增不换、同关重开=换 seed），复读一律算刷局剔除。
// 多设备请各导各跑本脚本，勿把两份文件拼一起（拼了会把别人真局当复读误剔）。
const seen = new Set();
for (const ev of events) {
  const key = `${ev.level}:${ev.seed}`;
  if (seen.has(key)) { dropped.dup++; continue; }
  seen.add(key);
  const c = classify(ev);
  if (c.kind === 'qa') { dropped.qa++; continue; }
  if (c.kind === 'orphan') { dropped.orphan++; continue; }
  if (!byLevel.has(ev.level)) byLevel.set(ev.level, { n: 0, win: 0, ts: [], bricks: [], gaps: {}, short: 0, other: 0 });
  const b = byLevel.get(ev.level);
  b.n++;
  if (c.kind === 'win') { b.win++; b.ts.push(ev.t); b.bricks.push(ev.bricksLeft); }
  else if (c.kind === 'short') b.short++;
  else if (c.kind === 'fall' && c.gapIdx >= 0) b.gaps[c.gapIdx] = (b.gaps[c.gapIdx] || 0) + 1;
  else b.other++;
}

const lvls = [...byLevel.keys()].sort((a, b) => a - b);
console.log(`样本 ${events.length} 局（剔除 QA后门 ${dropped.qa} / 同键复读 ${dropped.dup} / 孤儿seed ${dropped.orphan}）`);
console.log('lv |   n | 胜率 | Wilson下界 | 带 | t中位 | 余砖中位 | short | 断崖命中 top3');
const triggers = [];
for (const lv of lvls) {
  const b = byLevel.get(lv);
  const wr = b.win / b.n;
  const wl = wilsonLower(b.win, b.n);
  const band = bandFor(((lv - 1) % 10) + 1);
  const top = Object.entries(b.gaps).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([i, c]) => `#${i}:${c}`).join(' ');
  console.log(`${String(lv).padStart(2)} | ${String(b.n).padStart(3)} | ${(wr * 100).toFixed(0)}% | ${(wl * 100).toFixed(0)}% | ${(band * 100).toFixed(0)}% | ${median(b.ts)} | ${median(b.bricks)} | ${b.short} | ${top}`);
  if (b.n < 50) continue; // g1-tuning §1：每关 ≥50 局才允许触发回调
  const fails = b.n - b.win;
  // 症状按点胜率判（用 Wilson 下界对带会双重扣噪声，n=60 健康关常亮红灯）；
  // §2 低胜率三亚型互斥：short 主导→动门；集中特定断崖→动间距；散布全程→动 k。
  const topGap = Object.entries(b.gaps).sort((x, y) => y[1] - x[1])[0];
  const concentrated = !!(topGap && fails > 0 && topGap[1] / fails > 0.35);
  const shortDom = b.short / Math.max(1, fails) > 0.4;
  if (wr < band - 0.10 && shortDom)
    triggers.push(`L${lv}: 胜率 ${(wr * 100).toFixed(0)}% 低于带 ${(band * 100).toFixed(0)}% 且 short 主导 → §2 行2：gateCost×0.9（先动门不动 k）`);
  else if (wr < band - 0.10 && concentrated)
    triggers.push(`L${lv}: 胜率 ${(wr * 100).toFixed(0)}% 低于带且失败集中于断崖#${topGap[0]} → §2 行4 优先（gapIntervalMin+2），k 暂缓`);
  else if (wr < band - 0.10)
    triggers.push(`L${lv}: 胜率 ${(wr * 100).toFixed(0)}% 低于带（失败散布全程）→ §2 行1：ratioFor +0.1（k±0.1≈胜率±20pt）`);
  if (b.win / b.n > 0.95 && medianNum(b.bricks) > 8)
    triggers.push(`L${lv}: 胜率>95% 且中位余砖 ${medianNum(b.bricks)} > 8 → §2 行3：gateCost×1.15`);
  if (concentrated)
    triggers.push(`L${lv}: ${((topGap[1] / fails) * 100).toFixed(0)}% 失败集中在断崖#${topGap[0]} → §2 行4：gapIntervalMin+2`);
  if (lv >= 1 && lv <= 3 && b.win / b.n < 0.7)
    triggers.push(`L${lv}: 新手墙（真人胜率 ${(wr * 100).toFixed(0)}%<70%）→ §2 行6：marginFor L1-3 4→6，不动 k`);
}
function medianNum(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Number(s[s.length >> 1]); }
console.log('\n=== §2 症状触发器（样本≥50 的关才判定）===');
if (!triggers.length) console.log('（无——继续攒样本）');
for (const t of triggers) console.log('•', t);
console.log('\n注：timeout 型失败当前引擎无超时机制，不产生；真人若普遍拖局再看 §2 行5。铁律：本表对照 g1-tuning §5 代理基准带读，同向偏=改数值，唯真人偏=改 HUMAN_AVG。');
