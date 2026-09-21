// 关卡生成器冒烟测试：node tools/smoke.ts
// 断言：确定性、parity（与 Qoder 母本 bridge-rules.mjs 的 genLevelV3 位级一致）、
//       D1 全局不缺砖、D2 前缀可行（含 margin）、tailSafe 末段、拾取摊开、bot 通关率
import { CFG } from '../assets/scripts/config.ts';
import { genLevel, genLevelV3, levelStats, prefixBalance, zonesOf } from '../assets/scripts/LevelGen.ts';
import { cfgForLevel, itemsFor } from '../assets/scripts/LevelCurve.ts';
import { createProgress, starsFor, parFor } from '../assets/scripts/Progression.ts';
import { genLevelV3 as jsGenLevelV3, botRun } from '../docs/qoder/bridge-rules.mjs';
import { cfgForLevel as jsCfgForLevel, itemsFor as jsItemsFor } from '../docs/qoder/levels.mjs';
import { parFor as jsParFor, starsFor as jsStarsFor } from '../docs/qoder/progression.mjs';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (!cond) { failed++; console.error(`FAIL ${name} ${detail}`); }
};
const PARITY_SEEDS = 30;
const INV_SEEDS = 200;
const BOT_SEEDS = 100;

// 1. 确定性
const a = genLevel(1, CFG), b = genLevel(1, CFG);
check('deterministic-v1', JSON.stringify(a) === JSON.stringify(b));
const v3a = genLevelV3(1, CFG), v3b = genLevelV3(1, CFG);
check('deterministic-v3', JSON.stringify(v3a) === JSON.stringify(v3b));

// 2. parity：TS 移植版与母本 genLevelV3 逐 seed 位级一致
for (let seed = 1; seed <= PARITY_SEEDS; seed++) {
  const mine = JSON.stringify(genLevelV3(seed, CFG));
  const theirs = JSON.stringify(jsGenLevelV3(seed, CFG));
  check(`parity-v3 seed=${seed}`, mine === theirs);
}

// 3. 不变量（v3 生成器）
const margin = CFG.supplyMargin ?? 2;
for (let seed = 1; seed <= INV_SEEDS; seed++) {
  const lv = genLevelV3(seed, CFG);
  const tag = `seed=${seed}`;
  const st = levelStats(lv, CFG);
  check(`${tag} D1-global-supply`, st.ok, `obtainable=${st.obtainable} need=${st.need}`);
  const pb = prefixBalance(lv, CFG);
  check(`${tag} D2-prefix-feasible`, pb.feasible, `minSurplus=${pb.minSurplus}`);
  check(`${tag} D2-prefix-margin`, pb.minSurplus >= margin, `minSurplus=${pb.minSurplus} < margin=${margin}`);

  // tailSafe：最后一个断崖尾不超过 gateZ-8（末段恒 >=8m，兜底补砖有处可补）
  if (lv.gaps.length > 0) {
    const last = lv.gaps[lv.gaps.length - 1];
    check(`${tag} tailSafe`, last.zEnd <= lv.gateZ - 8 + 1e-9, `lastZEnd=${last.zEnd} gateZ=${lv.gateZ}`);
  }

  // 拾取摊开：区间容得下时，同区间相邻拾取 z 间距 >= 4m
  for (const [z0, z1] of zonesOf(lv)) {
    const inZone = lv.pickups.filter((p) => p.z >= z0 && p.z < z1).sort((p, q) => p.z - q.z);
    if (inZone.length < 2) continue;
    if (z1 - 1 - (z0 + 1) >= 4 * (inZone.length - 1)) {
      for (let i = 1; i < inZone.length; i++) {
        check(`${tag} pickup-spacing`, inZone[i].z - inZone[i - 1].z >= 4 - 1e-9,
          `zone[${z0},${z1}] diff=${(inZone[i].z - inZone[i - 1].z).toFixed(2)}`);
      }
    }
  }
}

// 4. bot 通关率（QA 门禁）
let wins = 0;
for (let seed = 1; seed <= BOT_SEEDS; seed++) {
  if (botRun(genLevelV3(seed, CFG), CFG).outcome === 'win') wins++;
}
const rate = wins / BOT_SEEDS;
check('bot-win-rate>=95%', rate >= 0.95, `rate=${(rate * 100).toFixed(0)}% (${wins}/${BOT_SEEDS})`);

// 5. 曲线漂移：LevelCurve.ts 与母本 levels.mjs 逐 level 一致（L1-L60，含 L11+ 饱和段）
for (let lv = 1; lv <= 60; lv++) {
  check(`curve-drift L${lv}`,
    JSON.stringify(cfgForLevel(lv, CFG)) === JSON.stringify(jsCfgForLevel(lv, CFG)));
}

// 6. progression 单元断言（母本 progression.mjs 移植版）
const mem = new Map<string, string>();
const store = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, v); },
};
const p1 = createProgress(store);
check('prog-fresh', p1.state().level === 1 && p1.state().attempt === 1);
const c1 = p1.current((lv) => cfgForLevel(lv, CFG));
check('prog-current', c1.seed === 1001 && c1.cfg.levelLength === 120, `seed=${c1.seed} len=${c1.cfg.levelLength}`);
const w1 = p1.win(15, 5);
check('prog-win', w1.stars === 3 && w1.nextLevel === 2, `stars=${w1.stars} next=${w1.nextLevel}`);
check('prog-stars-par', starsFor(1, 99, 5) === 2 && starsFor(1, 99, 0) === 1);
p1.lose(); p1.lose();
check('prog-lose', p1.state().attempt === 3 && p1.state().level === 2);
const p2 = createProgress(store);
check('prog-persist', p2.state().level === 2 && p2.state().attempt === 3);
mem.set('shortcut_run_progress_v1', '{bad json');
const p3 = createProgress(store);
check('prog-dirty-recover', p3.state().level === 1);

// 6b. PAR 星级线漂移锁：TS parFor/starsFor 与母本 progression.mjs 逐关一致（L1-L60 含 loop 补偿段）
//     历史 bug：PAR 模 10 查表但每 loop 长度 +20m => L11+ 三星恒不可达，母本已用 parFor 修掉
for (let lv = 1; lv <= 60; lv++) {
  const okPar = Math.abs(parFor(lv) - jsParFor(lv)) < 1e-9 && parFor(lv) < jsParFor(lv) + 1;
  check(`par-drift L${lv}`, okPar, `ts=${parFor(lv)} 母本=${jsParFor(lv)}`);
}
check('starsFor-parity', starsFor(1, 16.5, 5) === jsStarsFor(1, 16.5, 5)
  && starsFor(11, 19.0, 0) === jsStarsFor(11, 19.0, 0)
  && starsFor(21, 22.0, 3) === jsStarsFor(21, 22.0, 3),
  'L1/L11/L21 三星边界对母本');

// 7. v4 道具断言（母本 bridge-rules v4 / levels.mjs itemsFor）
{
  // 分带：L1-2 无道具；L3 起 +N 门；L4 起 ×2 门；L6 起鞋；与母本 itemsFor 逐级一致
  check('items-band', itemsFor(1) === null && itemsFor(2) === null && !!itemsFor(3), 'L1-2 null / L3 有');
  let bandsMatch = true;
  for (let lv = 1; lv <= 40; lv++) {
    if (JSON.stringify(itemsFor(lv)) !== JSON.stringify(jsItemsFor(lv))) { bandsMatch = false; break; }
  }
  check('items-band-parity', bandsMatch, 'itemsFor L1-L40 对母本');
  // 开启态 parity：带道具的 genLevelV3 与母本逐 seed 位级一致（§21 同口径）
  let itemsParity = true;
  for (const lv of [3, 4, 6, 9, 13, 23]) {
    const cfg = cfgForLevel(lv, CFG);
    const plan = itemsFor(lv);
    for (let s = 1; s <= 25; s++) {
      const seed = lv * 1000 + s;
      const mine = JSON.stringify(genLevelV3(seed, cfg, { items: plan ?? undefined }));
      const theirs = JSON.stringify(jsGenLevelV3(seed, cfg, { items: plan ?? undefined }));
      if (mine !== theirs) { itemsParity = false; break; }
    }
    if (!itemsParity) break;
  }
  check('items-on-parity', itemsParity, 'TS vs 母本（150 局）');
  // 关闭态形状：连 gates 键都不出现（保 §14 parity 锚），鞋不计入供需（纯增益）
  const off = genLevelV3(3001, cfgForLevel(3, CFG));
  check('items-off-shape', !('gates' in off), 'off 态无 gates 键');
  const cfg6 = cfgForLevel(6, CFG);
  const offBal = prefixBalance(genLevelV3(6001, cfg6), cfg6);
  const onBal = prefixBalance(genLevelV3(6001, cfg6, { items: itemsFor(6) ?? undefined }), cfg6);
  check('items-no-supply-change', JSON.stringify(offBal) === JSON.stringify(onBal), '道具不改供需');
}

// 8. 输出
const demo = genLevelV3(1, CFG);
console.log(`v3 demo: gaps=${demo.gaps.length} pickups=${demo.pickups.length} stats=${JSON.stringify(levelStats(demo, CFG))}`);
console.log(`bot win rate: ${(rate * 100).toFixed(0)}% (${wins}/${BOT_SEEDS})`);

if (failed) { console.error(`\n${failed} checks FAILED`); process.exit(1); }
console.log(`\nsmoke OK: parity ${PARITY_SEEDS} seeds / invariants ${INV_SEEDS} seeds / bot ${BOT_SEEDS} seeds`);
