// 关卡生成器冒烟测试：node tools/smoke.ts
// 验证：确定性、砖数供需平衡、断崖不重叠不出界、拾取不在断崖里
import { CFG } from '../assets/scripts/config.ts';
import { genLevel, levelStats } from '../assets/scripts/LevelGen.ts';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (!cond) { failed++; console.error(`FAIL ${name} ${detail}`); }
};

// 1. 确定性：同种子必须产出完全相同的关卡
const a = genLevel(1, CFG);
const b = genLevel(1, CFG);
check('deterministic', JSON.stringify(a) === JSON.stringify(b));

// 2. 前 50 个种子的 invariants
for (let seed = 1; seed <= 50; seed++) {
  const lv = genLevel(seed, CFG);
  const st = levelStats(lv, CFG);
  const tag = `seed=${seed}`;
  check(`${tag} brick-supply`, st.ok, `obtainable=${st.obtainable} need=${st.need}`);

  let prevEnd = -Infinity;
  for (const g of lv.gaps) {
    check(`${tag} gap-in-bounds`, g.zStart >= 8 && g.zEnd <= lv.gateZ, `gap=${g.zStart}~${g.zEnd} gateZ=${lv.gateZ}`);
    check(`${tag} gap-sorted`, g.zStart >= prevEnd, `overlap ${g.zStart} < ${prevEnd}`);
    check(`${tag} gap-cost`, g.cost === Math.ceil(g.zEnd - g.zStart));
    prevEnd = g.zEnd;
  }
  check(`${tag} gate-before-end`, lv.gateZ < lv.length);

  for (const p of lv.pickups) {
    check(`${tag} pickup-x`, Math.abs(p.x) <= CFG.trackHalfWidth);
    const inGap = lv.gaps.some((g) => p.z >= g.zStart - 1 && p.z <= g.zEnd + 1);
    check(`${tag} pickup-not-in-gap`, !inGap, `z=${p.z}`);
  }
}

// 3. 输出一个样例关卡供人工检查
const demo = genLevel(1, CFG);
console.log(`gaps: ${demo.gaps.map((g) => `${g.zStart.toFixed(1)}~${g.zEnd.toFixed(1)}(cost${g.cost})`).join(' ')}`);
console.log(`pickups: ${demo.pickups.length} x ${CFG.brickCluster} = ${demo.pickups.length * CFG.brickCluster} bricks`);
console.log(levelStats(demo, CFG));

if (failed) { console.error(`\n${failed} checks FAILED`); process.exit(1); }
console.log('\nsmoke OK: 50 seeds all invariants passed');
