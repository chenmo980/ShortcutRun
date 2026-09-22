// 关卡生成器冒烟测试：node tools/smoke.ts
// 断言：确定性、parity（与 Qoder 母本 bridge-rules.mjs 的 genLevelV3 位级一致）、
//       D1 全局不缺砖、D2 前缀可行（含 margin）、tailSafe 末段、拾取摊开、bot 通关率
import { CFG } from '../assets/scripts/config.ts';
import { genLevel, genLevelV3, levelStats, prefixBalance, zonesOf } from '../assets/scripts/LevelGen.ts';
import { createProgress, starsFor, parFor } from '../assets/scripts/Progression.ts';
import { SFX } from '../assets/scripts/SfxSynth.ts';
import type { SfxName } from '../assets/scripts/SfxSynth.ts';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { genLevelV3 as jsGenLevelV3, botRun } from '../docs/qoder/bridge-rules.mjs';
import { cfgForLevel as jsCfgForLevel, itemsFor as jsItemsFor } from '../docs/qoder/levels.mjs';
import { parFor as jsParFor, starsFor as jsStarsFor } from '../docs/qoder/progression.mjs';

// LevelCurve.ts 用无扩展名 import（Cocos 要求），node ESM 下用临时文件+重写绕开（同 Qoder sim §15 手法）
const lcSrc = readFileSync(new URL('../assets/scripts/LevelCurve.ts', import.meta.url), 'utf8')
  .replace(/from '\.\/config'/g, `from '${new URL('../assets/scripts/config.ts', import.meta.url).href}'`);
const lcTmp = new URL('./.tmp-LevelCurve.ts', import.meta.url);
writeFileSync(lcTmp, lcSrc);
const { cfgForLevel, itemsFor } = await import(lcTmp.href);
unlinkSync(lcTmp);

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

// 5. 曲线漂移锁在 Qoder sim.mjs §15（LevelCurve.ts 与母本逐 level 对拍，含 L11+），此处不重复
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

// 9. 音效表漂移锁：assets/scripts/SfxSynth.ts 与 web-preview 内联 sfx 表必须逐值一致
//    背景：Cocos/微信侧素材缺失时降级为代码合成（零包体），两处参数漂移会让两端听感不一致
{
  const html = readFileSync(new URL('../web-preview/index.html', import.meta.url), 'utf8');
  const expect: Record<string, [number, number, string, number, number]> = {
    pickup: [880, 0.08, 'square', 0.07, 400],
    lose: [220, 0.4, 'sawtooth', 0.14, -160],
  };
  for (const [name] of Object.entries(expect)) {
    const re = new RegExp(`${name}:\\s*\\(\\)\\s*=>\\s*(?:\\{[^}]*)?beep\\((\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?),\\s*'([a-z]+)',\\s*(\\d+(?:\\.\\d+)?)(?:,\\s*(-?\\d+(?:\\.\\d+)?))?`);
    const m = html.match(re);
    if (!m) { check(`sfx-inline-${name}`, false, '内联音效表抽取失败'); continue; }
    const mine = SFX[name as SfxName][0];
    check(`sfx-inline-${name}`,
      Number(m[1]) === mine.freq && Math.abs(Number(m[2]) - mine.dur) < 1e-9
      && m[3] === mine.type && Math.abs(Number(m[4]) - mine.vol) < 1e-9
      && (m[5] === undefined ? mine.slide === undefined : Math.abs(Number(m[5]) - (mine.slide ?? 0)) < 1e-9),
      `内联=${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]} TS=${mine.freq}/${mine.dur}/${mine.type}/${mine.vol}/${mine.slide}`);
  }
  check('sfx-win-arpeggio', html.includes('[523, 659, 784, 1047]') && SFX.win.map((t) => t.freq).join(',') === '523,659,784,1047',
    '胜利音四音琶音一致');
  check('sfx-bridge-two-tones', SFX.bridge.length === 2 && html.includes('beep(160, 0.18') && html.includes('beep(320, 0.1'),
    '铺桥双音一致');
}

// 10. 广告节流与桩（k1-ad-spec §4/§5）
{
  const { shouldInterstitialAfterWin, AdSys } = await import('../assets/scripts/AdMgr.ts');
  check('ad-no-interstitial-L1-L2', !shouldInterstitialAfterWin(1) && !shouldInterstitialAfterWin(2) && !shouldInterstitialAfterWin(0), '前3关不插屏(L0-L2)');
  // L3/L6/L9 通关后各 1 次（进 L4/L7/L10 前）
  check('ad-interstitial-L3-L6', shouldInterstitialAfterWin(3) && shouldInterstitialAfterWin(6) && shouldInterstitialAfterWin(9), 'L3/L6/L9 触发');
  check('ad-no-interstitial-L4', !shouldInterstitialAfterWin(4) && !shouldInterstitialAfterWin(5), '非 3 倍数不触发');
  const ad = new AdSys();
  let muted = false;
  let telem: unknown[] = [];
  ad.setMuteHook((m) => { muted = m; });
  ad.setTelemetryHook((ev) => { telem.push(ev); });
  ad.init();
  check('ad-stub-ready', ad.isReady('rewarded') && ad.isReady('interstitial'), '桩环境就绪');
  const ok = await ad.showRewarded('revive');
  check('ad-stub-rewarded', ok === true, `revive→${ok}`);
  check('ad-stub-telemetry', telem.length >= 1 && (telem[0] as any).ev === 'ad', JSON.stringify(telem[0]));
  check('ad-mute-restored', muted === false, `muted=${muted}`);
}

// 8. 输出
const demo = genLevelV3(1, CFG);
console.log(`v3 demo: gaps=${demo.gaps.length} pickups=${demo.pickups.length} stats=${JSON.stringify(levelStats(demo, CFG))}`);
console.log(`bot win rate: ${(rate * 100).toFixed(0)}% (${wins}/${BOT_SEEDS})`);

if (failed) { console.error(`\n${failed} checks FAILED`); process.exit(1); }
console.log(`\nsmoke OK: parity ${PARITY_SEEDS} seeds / invariants ${INV_SEEDS} seeds / bot ${BOT_SEEDS} seeds`);
