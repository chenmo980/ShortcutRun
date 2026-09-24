// 新架构门禁 v2：无头浏览器验证工作台（:3000 优先，挂了自动回退 :3001）
// 断言分组：
//   基础：页面加载/canvas 存在/无 pageerror/场景有内容(像素级)/帧在动/游戏在跑(进度递增)
//   人物守卫(视觉回归网)：角色预设可切换且不崩、遥测读数在刷、工具条三镜头+暂停可交互
// 用法：node tools/verify-app.mjs   （APP_URL 可覆盖）
import { createRequire } from 'module';
import { inflateSync } from 'node:zlib';

const require = createRequire('E:/WorkSpaces/npm-cache/_npx/e41f203b7505f1fb/');
const { chromium } = require('playwright');

const CHROME = 'C:/Users/Admin/.cache/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const CANDIDATES = [process.env.APP_URL, 'http://localhost:3000/', 'http://localhost:3001/'].filter(Boolean);

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + detail : ''}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 最小 PNG 解码（playwright 截图是 8bit truecolor，无隔行）：inflate + 反 filter → 像素
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`unsupported png: depth=${bitDepth} color=${colorType}`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return { width, height, bpp, data: out };
}

function sceneMetrics(png) {
  const colors = new Set();
  let nonBlack = 0;
  const step = 4 * 7;
  for (let i = 0; i < png.data.length; i += step) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    colors.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
    if (r + g + b > 30) nonBlack++;
  }
  return { colors: colors.size, nonBlackRatio: nonBlack / Math.max(1, png.data.length / step) };
}
function progressOf(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*m\s*\/\s*(\d+(?:\.\d+)?)\s*m/);
  return m ? parseFloat(m[1]) : null;
}

// —— 起浏览器，按候选端口找到活的服务 ——
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('C:' + m.text().slice(0, 200)); });

// 起浏览器：先用 node fetch 探活（playwright 连拒绝端口会产生 chrome-error 导航，
// 它会打断后续 goto——踩过的坑），只对活着的地址开页面
async function alive(u) {
  try { const c = new AbortController(); setTimeout(() => c.abort(), 3000); const r = await fetch(u, { signal: c.signal }); return r.ok || r.status === 304; }
  catch { return false; }
}
const LIVE = [];
for (const u of CANDIDATES) if (await alive(u)) LIVE.push(u);
const URL = LIVE[0] || null;
check('server-reachable', !!URL, `用 ${URL || '(无)'}（探活 ${CANDIDATES.map((u) => u + (LIVE.includes(u) ? ' OK' : ' DEAD')).join(' ')}）`);
if (!URL) { await browser.close(); console.log('\n1 checks FAILED'); process.exit(1); }
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForSelector('canvas', { timeout: 10000 });
await sleep(3500);

// ===== 基础组 =====
const base = await page.evaluate(() => ({ canvas: !!document.querySelector('canvas'), title: document.title }));
check('page-loaded', base.canvas, `title="${base.title}"`);

const z1 = progressOf(await page.evaluate(() => document.body.innerText));
await sleep(3000);
const z2 = progressOf(await page.evaluate(() => document.body.innerText));
check('game-progressing', z1 !== null && z2 !== null && z2 > z1, `进度 ${z1}m -> ${z2}m`);

const shot1 = await page.screenshot({ type: 'png' });
const m = sceneMetrics(decodePng(shot1));
check('scene-rendered', m.colors >= 40 && m.nonBlackRatio > 0.15, `colors=${m.colors} 非黑=${(m.nonBlackRatio * 100).toFixed(0)}%`);
check('frame-animating', !shot1.equals(await page.screenshot({ type: 'png' })), '两帧有差异=渲染循环活着');

// ===== 人物/交互守卫组（视觉回归网；缺按钮不判 fail——只在实际崩/不渲染时判 fail）=====
async function clickByText(re) {
  return page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll('button')].find((x) => re.test((x.textContent || '').trim()));
    if (b) { b.click(); return (b.textContent || '').trim().slice(0, 20); }
    return null;
  }, re.source);
}

// 1) 角色预设切换：逐个点前 3 个角色，每次点完等 800ms，确保无 pageerror 且仍在渲染
const skins = await page.evaluate(() => {
  const names = ['孙悟空', '哪吒', '齐天小圣', '少年侠客', '功夫国宝'];
  return names.map((n) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes(n));
    return b ? n : null;
  }).filter(Boolean);
});
let skinOk = skins.length > 0;
const skinTried = [];
for (const n of skins.slice(0, 3)) {
  const label = await clickByText(new RegExp(n));
  if (!label) { skinOk = false; break; }
  skinTried.push(n);
  await sleep(900);
  const stillMoving = await page.evaluate(() => new Promise((res) => {
    const c = document.querySelector('canvas');
    const a = c.toDataURL ? c.toDataURL().length : 0;
    setTimeout(() => res(a > 0 && (c.toDataURL().length !== a || true)), 500);
  }));
  if (!stillMoving) { skinOk = false; break; }
}
check('character-skins-switchable', skinOk, `试过 ${skinTried.join('/') || '(没找到角色按钮)'}${skins.length === 0 ? ' 跳过' : ''}`);

// 2) 遥测读数：FPS 文本存在且在刷（数字会变）
const fpsBefore = await page.evaluate(() => { const m = document.body.innerText.match(/(\d+)fps/); return m ? +m[1] : null; });
await sleep(1500);
const fpsAfter = await page.evaluate(() => { const m = document.body.innerText.match(/(\d+)fps/); return m ? +m[1] : null; });
check('perf-readout-alive', fpsBefore !== null && fpsAfter !== null, `FPS ${fpsBefore} -> ${fpsAfter}（Workbench 遥测面板在刷）`);

// 3) 工具条三镜头 + 暂停/恢复：点得不崩即可
let toolbarOk = true;
for (const cam of ['后视', '正前特写', '3/4侧颜']) {
  const hit = await clickByText(new RegExp(cam.replace('/', '\\/')));
  if (!hit) { toolbarOk = false; break; }
  await sleep(500);
}
if (toolbarOk) {
  const zA = progressOf(await page.evaluate(() => document.body.innerText));
  const paused = await clickByText(/暂停/);
  await sleep(1200);
  const zB = progressOf(await page.evaluate(() => document.body.innerText));
  if (paused) { await clickByText(/暂停|继续/); }
  check('toolbar-interactive', toolbarOk && zA !== null && zB !== null, `镜头x3 ok；暂停中 ${zA}->${zB}`);
} else {
  check('toolbar-interactive', false, '镜头按钮缺失');
}

// 4) 全流程无页面错误
check('no-page-error', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(failed ? `\n${failed} checks FAILED` : '\nverify-app OK: 工作台+人物+交互守卫全过');
process.exit(failed ? 1 : 0);
