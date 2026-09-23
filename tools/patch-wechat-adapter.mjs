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
const SAFE_DEF = 'var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){try{if(!("get"in d)&&!("set"in d)&&d.writable!==!1&&"value"in d)t[k]=d.value}catch(_e){}return t}};';
const SAFE_MARK = '__wxSafeDP';

// —— 补丁④：__esModule 标记必须生效（值描述符，赋值兜底与 defineProperty 语义等价）——
// 灰度 shim 拒绝 defineProperty 时，若只吞异常，TS 互操作代码
// (e.__esModule?e:{default:e}) 会拿不到标记 → 把整个 exports 对象当父类 →
// "Super expression must either be null or a function"（EventTarget/Audio 链崩）。
// 注意：替换形态必须是"表达式安全"的（逗号表达式位置也能用）——
// __wxSafeDP 内部已吞异常，外层直接"调一次+普通赋值"即可，严禁包裹语句级 try。
const ESM_RE = /__wxSafeDP\((\w+),"__esModule",\{value:!0\}\)/g;
const ESM_NEW = '(__wxSafeDP($1,"__esModule",{value:!0}),$1.__esModule=!0)';
// 旧版 wrapper（无赋值兜底）→ 新版：已打过补丁③的文件要能升级
const SAFE_DEF_OLD = 'var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){return t}};';

function applyPatch(src, oldStr, newStr, name, marker) {
  const count = src.split(oldStr).length - 1;
  if (count === 0) {
    // 已打过：用标记片段判断（补丁③会把①/②文本里的 defineProperty 也换掉，不能比整段）
    if (src.includes(marker)) {
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
src = applyPatch(src, OLD_WIN, NEW_WIN, '① window 只读兼容', 'try{i.window=r}catch(_w)');
src = applyPatch(src, OLD_XML, NEW_XML, '② xmldom defineProperty 探测', '_p",{value:1})');
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
  // 剥掉任何旧 wrapper（含被③误改成的自递归版），重新在顶部注入新 wrapper。
  // 关键：wrapper 自身的 Object.defineProperty 调用绝不能被替换（曾酿成自递归惨案）
  s = s.replace(/^var __wxSafeDP=function\(t,k,d\)\{[\s\S]*?\}\};/, '');
  s = SAFE_DEF + s;
  const wlen = SAFE_DEF.length;
  let tail = s.slice(wlen);
  const n = (tail.match(/Object\.defineProperty\(/g) || []).length;
  // 调用点：Object.defineProperty( → __wxSafeDP( （前面不能是 . 或标识符字符，防误伤属性访问）
  tail = tail.replace(/(^|[^.\w$])Object\.defineProperty\(/g, '$1__wxSafeDP(');
  // 裸引用：=Object.defineProperty / ,Object.defineProperty 等（传给别处调用的存根）
  tail = tail.replace(/(^|[^.\w$])Object\.defineProperty(?!\()/g, '$1__wxSafeDP');
  // ④ __esModule 标记：补赋值兜底（TS 互操作不能瞎）
  const esmCount = (tail.match(ESM_RE) || []).length;
  if (esmCount > 0) tail = tail.replace(ESM_RE, ESM_NEW);
  s = s.slice(0, wlen) + tail;
  if (s !== before) {
    writeFileSync(f, s);
    total += n;
    console.log(`③ ${rel}: 封装 ${n} 处调用点，④ __esModule 兜底 ${esmCount} 处`);
  } else {
    console.log(`③ ${rel}: 无需改动`);
  }
}
console.log(`提示：共处理 ${total} 个 defineProperty 调用点；重新构建微信包后需要再跑一次本脚本`);