// 微信新基础库兼容补丁：修复 __initApp 启动崩溃
//
// 根因：新版微信基础库把 GameGlobal.window 变成只读 getter，而 Cocos 3.8.8 的
// web-adapter 在非 devtools 分支里直接硬赋值：
//     i.window = r, (window = i).top = window.parent = window
// 抛出 "Cannot set property window of #<Window> which has only a getter"。
// 同一文件里的 devtools 分支本来就使用 Object.defineProperty 防御式写法，
// 本补丁把真机分支也统一成防御式（逐项 try + defineProperty 回退）。
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

const OLD = 'i.window=r,(window=i).top=window.parent=window';
const NEW = 'try{i.window=r}catch(_w){try{Object.defineProperty(i,"window",{value:r,configurable:!0})}catch(_w2){}}try{window=i}catch(_w3){}try{window.top=window}catch(_w4){}try{window.parent=window}catch(_w5){}';

let src = readFileSync(target, 'utf8');
const count = src.split(OLD).length - 1;
if (count === 0) {
  if (src.includes(NEW)) {
    console.log('补丁已存在，无需重复应用');
  } else {
    console.error('未找到目标代码片段（Cocos 版本可能已变），请检查 web-adapter.js');
    process.exit(1);
  }
} else {
  if (count > 1) {
    console.error(`目标片段出现 ${count} 次，预期 1 次，请人工检查`);
    process.exit(1);
  }
  src = src.replace(OLD, NEW);
  writeFileSync(target, src);
  console.log('已应用 window 只读兼容补丁 →', target);
}
console.log('提示：重新构建微信包后需要再跑一次本脚本');
