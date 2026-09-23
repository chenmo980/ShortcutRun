// Bonus Run 平衡性验证：不同起跑汽油 → 倍率分布应有区分度
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
  await page.evaluate((n) => window.__game.setBricks(n), planks);
  await page.mouse.move(450, 300);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => { const s = window.__game.getState(); return s.bonus && s.bonus.finished; }, null, { timeout: 30000 });
  const st = await page.evaluate(() => window.__game.getState());
  console.log(`gas=${planks} -> traveled=${st.bonus.traveled}m mult=x${st.bonus.mult} remaining=${st.bonus.remaining}`);
}
await browser.close();
