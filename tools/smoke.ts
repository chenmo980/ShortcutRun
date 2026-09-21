// 关卡生成器冒烟测试：node tools/smoke.ts
// 断言：确定性、parity（与 Qoder 母本逐 seed 一致）、D1 全局不缺砖、
//       D2 前缀可行、bot 通关率（QA 门禁）
import { CFG } from '../assets/scripts/config.ts';
import { genLevel, genLevelV2, levelStats, prefixBalance } from '../assets/scripts/LevelGen.ts';
import { genLevelV2 as jsGenLevelV2, botRun } from '../docs/qoder/bridge-rules.mjs';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (!cond) { failed++; console.error(`FAIL ${name} ${detail}`); }
};
const PARITY_SEEDS = 30;
const INV_SEEDS = 200;
const BOT_SEEDS = 100;

// 1. 确定性：同种子必须产出完全相同的关卡（v1 与 v2 都测）
const a = genLevel(1, CFG), b = genLevel(1, CFG);
check('deterministic-v1', JSON.stringify(a) === JSON.stringify(b));
const v2a = genLevelV2(1, CFG), v2b = genLevelV2(1, CFG);
check('deterministic-v2', JSON.stringify(v2a) === JSON.stringify(v2b));

// 2. parity：TS 移植版与 Qoder 母本 bridge-rules.mjs 逐 seed 位级一致
for (let seed = 1; seed <= PARITY_SEEDS; seed++) {
  const mine = JSON.stringify(genLevelV2(seed, CFG));
  const theirs = JSON.stringify(jsGenLevelV2(seed, CFG));
  check(`parity-v2 seed=${seed}`, mine === theirs);
}

// 3. D1/D2 不变量（v2 生成器下必须全绿）
for (let seed = 1; seed <= INV_SEEDS; seed++) {
  const lv = genLevelV2(seed, CFG);
  const tag = `seed=${seed}`;
  const st = levelStats(lv, CFG);
  check(`${tag} D1-global-supply`, st.ok, `obtainable=${st.obtainable} need=${st.need}`);
  const pb = prefixBalance(lv, CFG);
  check(`${tag} D2-prefix-feasible`, pb.feasible, `minSurplus=${pb.minSurplus} at=${pb.minAt}`);

  let prevEnd = -Infinity;
  for (const g of lv.gaps) {
    check(`${tag} gap-in-bounds`, g.zStart >= 8 && g.zEnd <= lv.gateZ, `gap=${g.zStart}~${g.zEnd} gateZ=${lv.gateZ}`);
    check(`${tag} gap-sorted`, g.zStart >= prevEnd, `overlap ${g.zStart} < ${prevEnd}`);
    check(`${tag} gap-cost`, g.cost === Math.ceil(g.zEnd - g.zStart));
    prevEnd = g.zEnd;
  }
  for (const p of lv.pickups) {
    const inGap = lv.gaps.some((g) => p.z >= g.zStart - 1 && p.z <= g.zEnd + 1);
    check(`${tag} pickup-not-in-gap`, !inGap, `z=${p.z}`);
  }
}

// 4. bot 通关率（QA 门禁，balance-v1 验收标准：默认关卡 ≥95%）
let wins = 0;
for (let seed = 1; seed <= BOT_SEEDS; seed++) {
  const r = botRun(genLevelV2(seed, CFG), CFG);
  if (r.outcome === 'win') wins++;
}
const rate = wins / BOT_SEEDS;
check('bot-win-rate>=95%', rate >= 0.95, `rate=${(rate * 100).toFixed(0)}% (${wins}/${BOT_SEEDS})`);

// 5. 样例输出
const demo = genLevelV2(1, CFG);
console.log(`v2 demo: gaps=${demo.gaps.length} pickups=${demo.pickups.length} stats=${JSON.stringify(levelStats(demo, CFG))}`);
console.log(`bot win rate: ${(rate * 100).toFixed(0)}% (${wins}/${BOT_SEEDS})`);

if (failed) { console.error(`\n${failed} checks FAILED`); process.exit(1); }
console.log(`\nsmoke OK: parity ${PARITY_SEEDS} seeds / invariants ${INV_SEEDS} seeds / bot ${BOT_SEEDS} seeds`);
