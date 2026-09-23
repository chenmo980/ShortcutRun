// 微信新基础库兼容补丁：修复 __initApp 启动崩溃 + 灰度库 xmldom 崩溃
//
// 补丁① window 只读（2026-09-23 上午）：
// 根因：新版微信基础库把 GameGlobal.window 变成只读 getter，而 Cocos 3.8.8 的
// web-adapter 在非 devtools 分支里直接硬赋值：
//     i.window = r, (window = i).top = window.parent = window
// 抛出 "Cannot set property window of #<Window> which has only a getter"。
// 同一文件里的 devtools 分支本来就使用 Object.defineProperty 防御式写法，
// 本补丁把真机分支也统一成防御式（逐项 try + defineProperty 回退）。
//
// 补丁③ 全局 defineProperty 安全封装（2026-09-23 深夜，根治灰度库 3.17.3）：
// 灰度基础库的 GameSubContext 对 Object.defineProperty 有平台 shim，传原型对象即抛
// "Object.defineProperty called on non-object"——实测 web-adapter 103 处 + cc.js 25 处 +
// 其余适配层 17 处共约 145 个调用点会逐个引爆（补丁②只能保 xmldom 那一处）。
// 修法：每个目标文件顶部注入 __wxSafeDP（失败豁免的包装器），再把文件内全部
// Object.defineProperty( 调用与裸引用统一换成 __wxSafeDP——所有调用点集体失效豁免。
//
// 用法：每次重新构建微信包后执行
//   node tools/patch-wechat-adapter.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wg = join(root, 'build', 'wechatgame');
const target = join(wg, 'web-adapter.js');

if (!existsSync(target)) {
  console.error('找不到 build/wechatgame/web-adapter.js，请先构建微信包');
  process.exit(1);
}

// —— 补丁①：window 只读 ——
const OLD_WIN = 'i.window=r,(window=i).top=window.parent=window';
const NEW_WIN = 'try{i.window=r}catch(_w){try{Object.defineProperty(i,"window",{value:r,configurable:!0})}catch(_w2){}}try{window=i}catch(_w3){}try{window.top=window}catch(_w4){}try{window.parent=window}catch(_w5){}';

// —— 补丁②：xmldom defineProperty 能力探测 ——
const OLD_XML = 'try{Object.defineProperty&&(';
const NEW_XML = 'try{Object.defineProperty&&(function(){try{var o={};Object.defineProperty(o,"_p",{value:1});return 1===o._p}catch(e){return!1}})()&&(';

// —— 补丁③：全局安全封装 ——
const SAFE_DEF = 'var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){return t}};';
const SAFE_MARK = '__wxSafeDP';

function applyPatch(src, oldStr, newStr, name) {
  const count = src.split(oldStr).length - 1;
  if (count === 0) {
    if (src.includes(newStr)) {
      console.log(`${name}: 补丁已存在，无需重复应用`);
      return src;
    }
    console.error(`${name}: 未找到目标代码片段（Cocos 版本可能已变），请检查 web-adapter.js`);
    process.exit(1);
  }
  if (count > 1) {
    console.error(`${name}: 目标片段出现 ${count} 次，预期 1 次，请人工检查`);
    process.exit(1);
  }
  console.log(`${name}: 已应用`);
  return src.replace(oldStr, newStr);
}

let src = readFileSync(target, 'utf8');
src = applyPatch(src, OLD_WIN, NEW_WIN, '① window 只读兼容');
src = applyPatch(src, OLD_XML, NEW_XML, '② xmldom defineProperty 探测');
writeFileSync(target, src);

// ③ 对全套启动链 JS 做 defineProperty 安全封装
const SAFE_TARGETS = [
  'web-adapter.js', 'engine-adapter.js', 'application.js', 'game.js',
  'cocos-js/cc.js', 'src/polyfills.bundle.js', 'src/system.bundle.js', 'src/chunks/bundle.js',
];
let total = 0;
for (const rel of SAFE_TARGETS) {
  const f = join(wg, rel);
  if (!existsSync(f)) { console.log(`③ ${rel}: 不存在，跳过`); continue; }
  let s = readFileSync(f, 'utf8');
  const before = s;
  if (!s.includes(SAFE_MARK)) {
    s = SAFE_DEF + s;
  }
  // 调用点：Object.defineProperty( → __wxSafeDP( （前面不能是 . 或标识符字符，防误伤属性访问）
  s = s.replace(/(^|[^.\w$])Object\.defineProperty\(/g, '$1__wxSafeDP(');
  // 裸引用：=Object.defineProperty / ,Object.defineProperty 等（传给别处调用的存根）
  s = s.replace(/(^|[^.\w$])Object\.defineProperty(?!\()/g, '$1__wxSafeDP');
  if (s !== before) {
    const n = (before.match(/Object\.defineProperty\(/g) || []).length;
    writeFileSync(f, s);
    total += n;
    console.log(`③ ${rel}: 封装 ${n} 处调用点`);
  } else {
    console.log(`③ ${rel}: 已是安全封装，跳过`);
  }
}
console.log(`提示：共处理 ${total} 个 defineProperty 调用点；重新构建微信包后需要再跑一次本脚本`);