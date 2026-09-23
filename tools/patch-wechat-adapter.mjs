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
// 补丁② xmldom dom-parser（2026-09-23 晚）：
// 根因：灰度基础库 3.17.3 的 GameSubContext 对 Object.defineProperty 有平台 shim，
// 传原型对象会抛 "Object.defineProperty called on non-object"，Cocos web-adapter
// 内联的 xmldom 在模块初始化时正好 defineProperty(c.prototype,"length")——
// 异常虽被 try 吞掉，但平台异步 errorReport 把它升级成 MiniProgramError 刷满控制台。
// 修法：调用前加一次性能力探测，探测失败直接跳过整段增强（降级但不崩）。
//
// 用法：每次重新构建微信包后执行
//   node tools/patch-wechat-adapter.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'build', 'wechatgame', 'web-adapter.js');

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
const before = src;
src = applyPatch(src, OLD_WIN, NEW_WIN, 'window 只读兼容');
src = applyPatch(src, OLD_XML, NEW_XML, 'xmldom defineProperty 探测');
if (src !== before) writeFileSync(target, src);
console.log('提示：重新构建微信包后需要再跑一次本脚本');
