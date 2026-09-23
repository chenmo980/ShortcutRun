// 浏览器版灰模自动化验证：node tools/verify-web.mjs
// 用无头 Chromium 实跑 index.html，断言状态机/铺桥/掉落/胜利四条路径，并截图
import { createRequire } from 'module';
import { mkdirSync } from 'fs';

const require = createRequire('E:/WorkSpaces/npm-cache/_npx/e41f203b7505f1fb/');
const { chromium } = require('playwright');

const CHROME = 'C:/Users/Admin/.cache/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const URL = 'file:///E:/WorkSpaces/WxSoftWare/shortcut-run/web-preview/index.html';
const SHOTS = 'E:/WorkSpaces/WxSoftWare/shortcut-run/web-preview/shots';
mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL);
await sleep(900);

// 1. ready 状态
let s = await page.evaluate(() => window.__game.getState());
check('ready-state', s.state === 'ready', JSON.stringify(s));
await page.screenshot({ path: `${SHOTS}/01-ready.png` });

// 2. 开始（先不转向，直行吃第一段砖）
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
s = await page.evaluate(() => window.__game.getState());
check('start-run', s.state === 'run', `state=${s.state}`);

// 3. 自然吃到砖块（第一个断崖在 z=8 之前有拾取）
await sleep(2500);
s = await page.evaluate(() => window.__game.getState());
check('pickup-bricks', s.bricks > 0, `bricks=${s.bricks} z=${s.z.toFixed(1)}`);
await page.screenshot({ path: `${SHOTS}/02-running.png` });

// 3b. 鼠标拖动 + 键盘转向
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.move(650, 300, { steps: 10 });
await page.mouse.up();
await page.keyboard.down('d');
await sleep(1000);
await page.keyboard.up('d');
s = await page.evaluate(() => window.__game.getState());
// 手性修正（Qoder 2026-09-21）：Three.js 屏幕右 = 世界 -X，右拖/按 D 应得 x < 0
check('steer-input', s.x < -0.2, `x=${s.x.toFixed(2)}`);

// 4. 铺捷径路径：重开 + 99 砖 + 按住 D 冲出主路 → offRoad=true、持续耗板、板子轨迹生成
await page.evaluate(() => window.__game.restart(1));
await sleep(300);
await page.evaluate(() => window.__game.setBricks(99));
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.keyboard.down('d');
await page.waitForFunction(() => window.__game.getState().offRoad === true, null, { timeout: 8000 });
const b1 = (await page.evaluate(() => window.__game.getState())).bricks;
await sleep(1200);
const s2 = await page.evaluate(() => window.__game.getState());
await page.keyboard.up('d');
check('shortcut-pass', s2.offRoad && b1 - s2.bricks > 2 && s2.planksLaid > 3,
  `offRoad=${s2.offRoad} 耗板 ${(b1 - s2.bricks).toFixed(1)} 板子=${s2.planksLaid}`);
// 板子池整局重置锁：上一局铺过 20+ 板，重开后池必须从 0 起算（不清池→复用 detached 节点，铺了板却看不见）
check('plank-pool-reset', s2.planksLaid < 28, `池从0起算=${s2.planksLaid}（不清会是上一局残留20+）`);
await page.screenshot({ path: `${SHOTS}/03-shortcut.png` });

// 4b. M5（原版“蹭路”）：对手铺的板也是持久地面——layPlank 统一记 trail，
// 玩家/对手谁铺的板站上去都不耗砖不坠落
await page.evaluate(() => window.__game.restart(1));
await sleep(300);
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await sleep(300);
const m5 = await page.evaluate(() => {
  const st = window.__game.getState();
  const before = window.__game.plankTrailCount();
  window.__game.layPlankAt(-2.5, st.z + 3); // 模拟对手在玩家身边铺的板
  const supported = window.__game.supportAt(-2.5, st.z + 3);
  const notSupported = window.__game.supportAt(2.5, st.z + 3); // 没铺过的地方仍不应有支撑
  return { supported, notSupported, grew: window.__game.plankTrailCount() === before + 1 };
});
check('opponent-plank-ground', m5.supported && m5.grew && !m5.notSupported,
  `supported=${m5.supported} trail+1=${m5.grew} blank=${m5.notSupported}`);

// 4c. M6 板子几秒后原地刷新：吃到后 5s 该堆复活（waitForFunction 盯 taken 翻回 false）
await page.evaluate(() => window.__game.restart(1));
await sleep(300);
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => window.__game.getState().pickupList.some((p) => p.taken), null, { timeout: 15000 });
await page.waitForFunction(() => window.__game.getState().pickupList.some((p) => !p.taken), null, { timeout: 15000 });
const m6 = await page.evaluate(() => {
  const s = window.__game.getState();
  return { taken: s.pickupList.filter((p) => p.taken).length, alive: s.pickupList.filter((p) => !p.taken).length };
});
check('pickup-respawn', m6.alive > 0, `taken=${m6.taken} 复活=${m6.alive}`);

// 4d. M8 板尽差一步扒边判定：贴近断崖尽头=可扒（返回落点），远离=不可扒
const m8 = await page.evaluate(() => {
  const s = window.__game.getState();
  const g = s.gapList[0];
  return {
    near: window.__game.grabCheck(0, g.zEnd - 0.3),
    far: window.__game.grabCheck(0, (g.zStart + g.zEnd) / 2),
  };
});
check('edge-grab', m8.near != null && m8.far === null, `near=${JSON.stringify(m8.near)} far=${m8.far}`);

// 5. 坠落路径：重开 + 0 砖 + 冲出主路 → 最后一跃后坠落
await page.evaluate(() => window.__game.restart(1));
await sleep(300);
await page.evaluate(() => window.__game.setBricks(0));
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.keyboard.down('d');
await page.waitForFunction(() => window.__game.getState().state === 'fall', null, { timeout: 10000 });
await page.keyboard.up('d');
s = await page.evaluate(() => window.__game.getState());
check('fall-state', s.state === 'fall', `bricks=${s.bricks} z=${s.z.toFixed(1)}`);
await page.screenshot({ path: `${SHOTS}/04-fall.png` });

// 6. 胜利路径（原版流程）：重开 + 99 砖 → 过终点门进倍率奖励区 → 油尽结算
await page.evaluate(() => window.__game.restart(7));
await sleep(400);
await page.evaluate(() => window.__game.setBricks(99));
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
// 6a. 先到终点 → 进入倍率奖励区
await page.waitForFunction(() => window.__game.getState().bonus !== null, null, { timeout: 40000 });
s = await page.evaluate(() => window.__game.getState());
check('bonus-entered', s.bonus !== null, `gas=${s.bonus.remaining}`);
// M11：倍率档 14 档覆盖 ×2~×15（原版 15 岛全区间）
check('bonus-pads-14', s.bonus.pads === 14, `pads=${s.bonus.pads}`);
await page.screenshot({ path: `${SHOTS}/05-bonus.png` });
// 6b. 油尽 → 结算出倍率与分数
await page.waitForFunction(() => { const b = window.__game.getState().bonus; return b && b.finished; }, null, { timeout: 40000 });
s = await page.evaluate(() => window.__game.getState());
check('bonus-settled', s.bonus.finished && s.bonus.mult >= 2, `mult=x${s.bonus.mult} traveled=${s.bonus.traveled}m`);
// M12：名次基础分关系锁（第N名 ↔ RANK_BASE[N-1]，值域 100/60/30/10）
const rankBaseOk = [100, 60, 30, 10][s.bonus.rank - 1] === s.bonus.base;
check('rank-base-lock', s.bonus.rank >= 1 && s.bonus.rank <= 4 && rankBaseOk,
  `rank=${s.bonus.rank} base=${s.bonus.base}`);

// 6c. M10 奖励区回头机制：低气进门 → 按住 S 回头吃气垛(+15) → 松手冲刺 → 倍率高于不捡
// 注意：必须在冲线前才把气降到 20，否则沿途吃砖会把气补回 80+（实测踩过的坑）
await page.evaluate(() => window.__game.restart(7));
await sleep(400);
await page.evaluate(() => window.__game.setBricks(99)); // 高气只为跑得快
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => { const s = window.__game.getState(); return s.z > s.gateZ - 10; }, null, { timeout: 40000 });
await page.evaluate(() => window.__game.setBricks(20)); // 冲线前降到 20 气：直冲只够 ×3@9m
await page.waitForFunction(() => window.__game.getState().bonus !== null, null, { timeout: 8000 });
const gasIn = (await page.evaluate(() => window.__game.getState())).bonus.remaining;
const zIn = (await page.evaluate(() => window.__game.getState())).z;
await page.keyboard.down('s'); // 回头
await page.waitForFunction((g) => window.__game.getState().bonus.remaining > g, gasIn + 5, { timeout: 8000 }); // 吃到 -3.5m 气垛
const back = await page.evaluate(() => window.__game.getState());
await page.keyboard.up('s');
check('bonus-back-pickup', back.z < zIn - 1 && back.bonus.pilesTaken >= 1 && back.bonus.remaining > gasIn + 5,
  `后退 ${(zIn - back.z).toFixed(1)}m 吃垛 ${back.bonus.pilesTaken} 气 ${gasIn}->${back.bonus.remaining}`);
await page.waitForFunction(() => { const b = window.__game.getState().bonus; return b && b.finished; }, null, { timeout: 40000 });
s = await page.evaluate(() => window.__game.getState());
check('bonus-boost', s.bonus.mult >= 5, `20气+回头=×${s.bonus.mult}（不捡只到×3）`);
await page.screenshot({ path: `${SHOTS}/06-settle.png` });

// 6b. v4 道具门功能：L3 有 +5 门（itemsFor 分带），直行过门自动加砖
await page.evaluate(() => window.__game.restart(3));
await sleep(400);
await page.evaluate(() => window.__game.setBricks(60));
const bricksBeforeGate = (await page.evaluate(() => window.__game.getState())).bricks;
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => window.__game.getState().gateList.some((g) => g.used), null, { timeout: 30000 });
s = await page.evaluate(() => window.__game.getState());
check('item-gate-add', s.gateList.some((g) => g.used && g.type === 'add') && s.bricks > bricksBeforeGate,
  `gates=${JSON.stringify(s.gateList)} bricks=${bricksBeforeGate}->${s.bricks}`);

// 6c. v4 道具分带：L7（重启即读关卡静态数据，不必开跑）应有鞋形拾取（L6 起）+ 两扇门（L4 起加 ×2）
await page.evaluate(() => window.__game.restart(7));
await sleep(400);
s = await page.evaluate(() => window.__game.getState());
check('items-band-l7', s.pickupList.some((p) => p.kind === 'shoe') && s.gateList.length >= 2,
  `shoes=${s.pickupList.filter((p) => p.kind === 'shoe').length} gates=${s.gateList.length}`);

// 9. 主题换肤：按 T 切换，theme 字段变化且游戏不崩
const themeBefore = (await page.evaluate(() => window.__game.getState())).theme;
await page.keyboard.press('t');
await sleep(400);
const themeAfter = (await page.evaluate(() => window.__game.getState())).theme;
check('theme-toggle', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
await page.screenshot({ path: `${SHOTS}/07-theme-${themeAfter}.png` });

// 10. 无页面错误
check('no-page-error', errors.length === 0, errors.slice(0, 3).join(' | '));

// 8. 像素级验证（替代肉眼）：画面有内容、色彩丰富、角色可见。
// 玩家检测用 marker 色替代硬编码颜色：把角色临时染成品红再数像素，
// 任意主题（day 白角色 / city 蓝角色）都成立，不受光照着色影响
await page.evaluate(() => window.__game.restart(1));
await sleep(400);
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await sleep(600);
const vis = await page.evaluate(() => {
  const orig = window.__game.getState().playerColor;
  window.__game.setRunPhase(0.8); // 固定跑步相位：消抖（不固定时 marker 36~78 乱窜会误杀）
  window.__game.setPlayerColor(0xff00ff); // 品红 marker
  window.__game.renderOnce(); // 同一任务内渲染后立刻读，避免 WebGL 缓冲被清
  const c = window.__game.canvas();
  // 整帧缩放采样（不再固定取左上角）：角色随相机插值在画面中移动，
  // 固定裁剪窗口会让 marker 像素数随帧相位抖动（实测 46~56 越过阈值），整帧采样消除该抖动
  const W = 320, H = 180;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d');
  ctx.drawImage(c, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const sky = window.__game.getState().sky;
  const sr = (sky >> 16) & 255, sg = (sky >> 8) & 255, sb = sky & 255;
  const colors = new Set();
  let nonBg = 0, marker = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    colors.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
    if (Math.abs(r - sr) > 25 || Math.abs(g - sg) > 25 || Math.abs(b - sb) > 30) nonBg++;
    if (r > 150 && b > 150 && g < 100) marker++; // 品红（暗面也按通道比例判定）
  }
  window.__game.setPlayerColor(orig); // 还原主题色
  const tot = W * H;
  return { colors: colors.size, nonBgRatio: nonBg / tot, markerPx: marker, theme: window.__game.getState().theme };
});
// nonBg 上限 0.99：俯视镜头下 city 主题天空占比本就偏低(实测 95%~98% 抖动)，
// 0.98 会在临界帧误杀；仍要求 >0.15 保证有内容、留出至少 1% 天空底色像素
check('scene-rendered', vis.colors >= 8 && vis.nonBgRatio > 0.15 && vis.nonBgRatio < 0.99,
  `colors=${vis.colors} nonBg=${(vis.nonBgRatio * 100).toFixed(0)}% theme=${vis.theme}`);
check('player-visible', vis.markerPx > 50, `markerPx=${vis.markerPx}`);
await page.screenshot({ path: `${SHOTS}/06-pixel-check.png` });

await browser.close();
console.log(failed ? `\n${failed} checks FAILED` : '\nverify OK: all paths passed');
process.exit(failed ? 1 : 0);
