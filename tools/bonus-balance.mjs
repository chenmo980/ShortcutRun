// Bonus Run 平衡性验证：不同入场汽油 → 倍率分布应有区分度
// 坑（2026-09-23 修）：旧版在关卡起点 setBricks，冲线途中吃砖会把气补回 80+，
// 测出来的"gas=3 -> ×10"全是假数据。正确口径=冲线前一刻才把气降到目标值。
import { createRequire } from 'module';
const require = createRequire('E:/WorkSpaces/npm-cache/_npx/e41f203b7505f1fb/');
const { chromium } = require('playwright');

const CHROME = 'C:/Users/Admin/.cache/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const URL = 'file:///E:/WorkSpaces/WxSoftWare/shortcut-run/web-preview/index.html';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n')[0]));

for (const planks of [3, 8, 20, 50]) {
  await page.goto(URL);
  await page.evaluate(() => window.__game.restart(3));
  await page.evaluate(() => window.__game.setBricks(99)); // 高气只为跑得快
  await page.mouse.move(450, 300);
  await page.mouse.down();
  await page.mouse.up();
  // 冲线前一刻降到目标气（否则沿途吃砖污染样本）
  await page.waitForFunction(() => { const s = window.__game.getState(); return s.z > s.gateZ - 10; }, null, { timeout: 60000 });
  await page.evaluate((n) => window.__game.setBricks(n), planks);
  await page.waitForFunction(() => { const s = window.__game.getState(); return s.bonus && s.bonus.finished; }, null, { timeout: 30000 });
  const st = await page.evaluate(() => window.__game.getState());
  console.log(`gas=${planks} -> traveled=${st.bonus.traveled}m mult=x${st.bonus.mult} remaining=${st.bonus.remaining} piles=${st.bonus.pilesTaken}`);
}
await browser.close();
