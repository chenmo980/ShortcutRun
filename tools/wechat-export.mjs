// 微信小游戏导出链路（纯 Three.js 路线，无 Cocos 无 adapter 地狱）
// 模式：
//   node tools/wechat-export.mjs --dry-run   构建 vite + 打包检查（不动 build/wechatgame 运行文件，只出报告）
//   node tools/wechat-export.mjs --spike     技术验证 spike：产出一个最小可玩包（three+旋转立方体+触控），
//                                          用于在微信开发者工具里验证 wx.createCanvas + WebGL + 触控 + 包体 全链路
//   node tools/wechat-export.mjs --core      待 src/game/core.ts 就绪后使用（当前会提示缺失并退出）
// 产物：build/wechatgame/（game.js + game.json + lib/three.cjs），主包预算 4MB（docs/k2/k2-bundle-budget.md 口径）。
// 用法：微信开发者工具 → 导入 build/wechatgame → 小游戏 → 测试号 AppID → 编译。
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build', 'wechatgame');
const arg = process.argv[2] || '--dry-run';
const step = (msg) => console.log(`[export] ${msg}`);

function dirSize(p) {
  let sum = 0;
  for (const f of readdirSync(p, { recursive: true })) {
    const fp = join(p, f);
    try { if (statSync(fp).isFile()) sum += statSync(fp).size; } catch { /* ignore */ }
  }
  return sum;
}

// —— spike 用的最小入口：证明 wx canvas + three WebGL + 触控在小游戏环境成立 ——
const SPIKE_GAME_JS = `// Shortcut Run 微信端技术验证 spike（自动生成，勿手改；重新生成: node tools/wechat-export.mjs --spike）
// 验证目标：wx.createCanvas + three.js WebGL 渲染 + wx 触控事件 + 帧循环 四件事在微信小游戏成立。
// 通过标准：开发者工具模拟器出现旋转立方体，鼠标/触摸拖动可旋转它，控制台无 ERROR。
var THREE = require('./lib/three.cjs');
var sysInfo = wx.getSystemInfoSync();
var canvas = wx.createCanvas();
canvas.width = sysInfo.windowWidth;
canvas.height = sysInfo.windowHeight;

var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(sysInfo.pixelRatio || 1, 2));
renderer.setSize(canvas.width, canvas.height, false);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
var camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 100);
camera.position.set(0, 1.6, 4.5);
camera.lookAt(0, 0.6, 0);

var cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.2, 1.2),
  new THREE.MeshLambertMaterial({ color: 0xff6b35 })
);
cube.position.y = 0.6;
scene.add(cube);
var light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2, 4, 3);
scene.add(light);
var amb = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(amb);

// 触控总线（与 core 的 input 抽象同构）：拖动 -> 目标角速度
var touch = { down: false, x: 0, y: 0 };
wx.onTouchStart(function (e) { touch.down = true; touch.x = e.touches[0].clientX; touch.y = e.touches[0].clientY; });
wx.onTouchMove(function (e) {
  if (!touch.down) return;
  var dx = e.touches[0].clientX - touch.x;
  var dy = e.touches[0].clientY - touch.y;
  touch.x = e.touches[0].clientX; touch.y = e.touches[0].clientY;
  cube.rotation.y += dx * 0.01;
  cube.rotation.x += dy * 0.01;
});
wx.onTouchEnd(function () { touch.down = false; });
wx.onTouchCancel(function () { touch.down = false; });

console.log('[spike] wx canvas ' + canvas.width + 'x' + canvas.height + ' WebGL=' + (!!renderer.getContext()) + ' three r' + THREE.REVISION);
function loop() {
  cube.rotation.y += 0.008;
  renderer.render(scene, camera);
  canvas.requestAnimationFrame(loop);
}
loop();
`;

function writeSpike() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'lib'), { recursive: true });
  copyFileSync(join(root, 'node_modules', 'three', 'build', 'three.cjs'), join(out, 'lib', 'three.cjs'));
  // three.cjs 内部 requires ./three.core.js，必须一起带上
  copyFileSync(join(root, 'node_modules', 'three', 'build', 'three.core.js'), join(out, 'lib', 'three.core.js'));
  writeFileSync(join(out, 'game.js'), SPIKE_GAME_JS);
  writeFileSync(join(out, 'game.json'), JSON.stringify({
    deviceOrientation: 'portrait',
    showStatusBar: false,
    networkTimeout: { request: 5000, connectSocket: 5000, uploadFile: 5000, downloadFile: 500000 },
  }, null, 2));
  writeFileSync(join(out, 'project.config.json'), JSON.stringify({
    compileType: 'game',
    appid: 'touristappid', // 测试号；正式版换成你自己的 AppID
    projectname: 'shortcut-run-wechat-spike',
    libVersion: 'widelyUsed',
    setting: { es6: true, minified: true, urlCheck: false },
  }, null, 2));
  const mb = (dirSize(out) / 1048576).toFixed(2);
  console.log(`[spike] 产物已生成 → build/wechatgame（${mb}MB / 预算 4MB）`);
  console.log('[spike] 开发者工具导入该目录 → 小游戏 → 测试号 → 编译：出现旋转立方体且可拖动=全链路通过');
}

// —— 主流程 ——
if (arg === '--dry-run') {
  step('npm run build（vite）…');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  const dist = join(root, 'dist');
  if (existsSync(dist)) console.log(`[export] dist 产物 ${(dirSize(dist) / 1048576).toFixed(2)}MB（React 工作台，非小游戏包——小游戏入口见 --spike/--core）`);
  step('dry-run 完成（未写 build/wechatgame）');
} else if (arg === '--spike') {
  writeSpike();
} else if (arg === '--core') {
  const core = join(root, 'src', 'game', 'core.ts');
  if (!existsSync(core)) {
    console.error('[export] src/game/core.ts 不存在——等 Qoder 刀1（片1 渲染骨架）就绪后重跑；先用 --spike 验证环境');
    process.exit(1);
  }
  console.error('[export] --core 打包待 core 接口定稿后实现（createGame(canvas,{input,audio,env}) → wx 入口桥接）');
  process.exit(1);
} else {
  console.error('用法: node tools/wechat-export.mjs [--dry-run|--spike|--core]');
  process.exit(1);
}
