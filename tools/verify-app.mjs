// 新架构门禁：无头浏览器验证 :3000 上的 Shortcut Run 3D 工作台
// 断言：页面加载/canvas 存在/无 pageerror/场景有内容(像素级)/游戏在跑(进度递增)/画面在动(两帧不同)
// 用法：先 npm run dev，再 node tools/verify-app.mjs
import { createRequire } from 'module';
import { inflateSync } from 'node:zlib';

const require = createRequire('E:/WorkSpaces/npm-cache/_npx/e41f203b7505f1fb/');
const { chromium } = require('playwright');

const CHROME = 'C:/Users/Admin/.cache/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const URL = process.env.APP_URL || 'http://localhost:3000/';

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + detail : ''}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 最小 PNG 解码（playwright 截图是 8bit truecolor，无隔行）：inflate + 反 filter → RGBA 像素
function decodePng(buf) {
  let pos = 8; // skip signature
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
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
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return { width, height, bpp, data: out };
}

// 场景内容度量：颜色丰富度 + 非纯黑像素占比（Three.js 空场景/崩溃通常是纯黑或纯一色）
function sceneMetrics(png) {
  const colors = new Set();
  let nonBlack = 0;
  const step = 4 * 7; // 隔采样，提速
  for (let i = 0; i < png.data.length; i += step) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    colors.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
    if (r + g + b > 30) nonBlack++;
  }
  const total = png.data.length / step; // step 已是“每采样点字节数”，直接得采样点数
  return { colors: colors.size, nonBlackRatio: nonBlack / Math.max(1, total) };
}

function progressOf(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*m\s*\/\s*(\d+(?:\.\d+)?)\s*m/);
  return m ? parseFloat(m[1]) : null;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('C:' + m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
await sleep(3500); // 等角色/场景起来

// 1) 基础结构
const base = await page.evaluate(() => ({
  canvas: !!document.querySelector('canvas'),
  title: document.title,
}));
check('page-loaded', base.canvas, `title="${base.title}" canvas=${base.canvas}`);

// 2) 游戏在跑：进度数字递增（自动巡航默认开）
const t1 = await page.evaluate(() => document.body.innerText);
const z1 = progressOf(t1);
await sleep(3000);
const t2 = await page.evaluate(() => document.body.innerText);
const z2 = progressOf(t2);
check('game-progressing', z1 !== null && z2 !== null && z2 > z1, `进度 ${z1}m -> ${z2}m`);

// 3) 像素级：场景有内容
const shot1 = await page.screenshot({ type: 'png' });
const png = decodePng(shot1);
const m = sceneMetrics(png);
check('scene-rendered', m.colors >= 40 && m.nonBlackRatio > 0.15, `colors=${m.colors} 非黑占比=${(m.nonBlackRatio * 100).toFixed(0)}%`);

// 4) 画面在动：两帧截图不应完全一致（渲染循环活着）
const shot2 = await page.screenshot({ type: 'png' });
check('frame-animating', !shot1.equals(shot2), `帧差异=${shot1.length - shot2.length}B`);

// 5) 无页面错误（404 资源噪音已白名单）
check('no-page-error', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(failed ? `\n${failed} checks FAILED` : '\nverify-app OK: 工作台运行正常');
process.exit(failed ? 1 : 0);
