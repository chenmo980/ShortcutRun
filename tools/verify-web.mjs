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

// 4. 铺桥路径：重开 + 99 砖 → 第一个断崖被自动桥接，状态保持 run（事件等待，无时序假设）
await page.evaluate(() => window.__game.restart(1));
await sleep(300);
await page.evaluate(() => window.__game.setBricks(99));
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => window.__game.getState().gapList[0].bridged, null, { timeout: 10000 });
s = await page.evaluate(() => window.__game.getState());
check('bridge-pass', s.state === 'run' && s.gapList[0].bridged === true, `state=${s.state} bridged=${s.gapList[0].bridged} z=${s.z.toFixed(1)}`);
await page.screenshot({ path: `${SHOTS}/03-bridged.png` });

// 5. 掉落路径：重开 + 零砖 + 切到没有拾取物的车道 → 到断崖掉下去
await page.evaluate(() => window.__game.restart(1));
await sleep(400);
await page.evaluate(() => window.__game.setBricks(0));
const safeX = await page.evaluate(() => {
  const st = window.__game.getState();
  const early = st.pickupList.filter((p) => p.z < 8 && !p.taken);
  const rightClear = early.every((p) => Math.abs(p.x - 2.15) > 0.95);
  return rightClear ? 2.15 : -2.15;
});
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.move(450 + (safeX > 0 ? 110 : -110), 300, { steps: 5 });
await page.mouse.up();
await page.waitForFunction(
  () => { const s = window.__game.getState(); return s.state === 'fall' || s.state === 'lose'; },
  null, { timeout: 8000 }
);
s = await page.evaluate(() => window.__game.getState());
check('fall-state', s.state === 'fall' || s.state === 'lose', `state=${s.state} y=${s.y.toFixed(1)} safeX=${safeX}`);
await page.screenshot({ path: `${SHOTS}/04-fall.png` });

// 6. 胜利路径：重开 + 99 砖 → 冲到终点门
await page.evaluate(() => window.__game.restart(7));
await sleep(400);
await page.evaluate(() => window.__game.setBricks(99));
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => window.__game.getState().state === 'win', null, { timeout: 40000 });
s = await page.evaluate(() => window.__game.getState());
check('win-state', s.state === 'win' && s.z >= s.gateZ - 1, `z=${s.z.toFixed(1)} gateZ=${s.gateZ.toFixed(1)}`);
await page.screenshot({ path: `${SHOTS}/05-win.png` });

// 9. 主题换肤：按 T 切换，theme 字段变化且游戏不崩
const themeBefore = (await page.evaluate(() => window.__game.getState())).theme;
await page.keyboard.press('t');
await sleep(400);
const themeAfter = (await page.evaluate(() => window.__game.getState())).theme;
check('theme-toggle', themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
await page.screenshot({ path: `${SHOTS}/07-theme-${themeAfter}.png` });

// 10. 无页面错误
check('no-page-error', errors.length === 0, errors.slice(0, 3).join(' | '));

// 8. 像素级验证（替代肉眼）：画面有内容、色彩丰富、玩家（蓝色）出现在镜头中央区域
await page.evaluate(() => window.__game.restart(1));
await sleep(400);
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.up();
await sleep(600);
const st0 = await page.evaluate(() => window.__game.getState());
const vis = await page.evaluate(() => {
  window.__game.renderOnce(); // 同一任务内渲染后立刻读，避免 WebGL 缓冲被清
  const c = window.__game.canvas();
  const off = document.createElement('canvas');
  off.width = 200; off.height = 140;
  const ctx = off.getContext('2d');
  ctx.drawImage(c, 0, 0, 200, 140);
  const d = ctx.getImageData(0, 0, 200, 140).data;
  const sky = window.__game.getState().sky;
  const sr = (sky >> 16) & 255, sg = (sky >> 8) & 255, sb = sky & 255;
  const colors = new Set();
  let nonBg = 0, blue = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    colors.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
    if (Math.abs(r - sr) > 25 || Math.abs(g - sg) > 25 || Math.abs(b - sb) > 30) nonBg++;
    if (b > 150 && b - r > 40 && g > 100) blue++; // 玩家蓝
  }
  return { colors: colors.size, nonBgRatio: nonBg / (200 * 140), bluePx: blue, theme: window.__game.getState().theme };
});
check('scene-rendered', vis.colors >= 8 && vis.nonBgRatio > 0.15 && vis.nonBgRatio < 0.98,
  `colors=${vis.colors} nonBg=${(vis.nonBgRatio * 100).toFixed(0)}% theme=${vis.theme}`);
check('player-visible', vis.bluePx > 50, `bluePx=${vis.bluePx}`);
await page.screenshot({ path: `${SHOTS}/06-pixel-check.png` });

await browser.close();
console.log(failed ? `\n${failed} checks FAILED` : '\nverify OK: all paths passed');
process.exit(failed ? 1 : 0);
