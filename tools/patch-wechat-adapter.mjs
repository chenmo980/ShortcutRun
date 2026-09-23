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
const cfgFile = join(wg, 'project.config.json');

if (!existsSync(target)) {
  console.error('找不到 build/wechatgame/web-adapter.js，请先构建微信包');
  process.exit(1);
}

// —— 补丁⑥：window 全局扶正 + 裸赋值防护（2026-09-23 深夜）——
// 根因：基础库 3.0.2 的 GameSubContext 里全局 window 缺失（typeof window === "undefined"），
// 而 web-adapter 入口模块(27)的 devtools 分支只会往 window 上注射属性、从不创建 window
// （创建逻辑在 else 分支的 window=i，严格模式下赋值未声明变量还会被 try 吞掉）。
// 首炸点：裸语句 window.parent=window → "Cannot set properties of undefined (setting 'parent')"。
// 连带炸点：window.DOMParser=r / window.fsUtils=... / window.__globalAdapter=...（全裸）。
// 修法：①window 缺失时用 defineProperty 在 GameGlobal 上把 window 全局扶正（值=GameGlobal），
//       之后所有 window.X 引用全部有对象可落；②4 个裸赋值补 try 防护（双保险）。
const WIN_ENSURE_OLD = 'var i=GameGlobal;if(!GameGlobal.__isAdapterInjected){';
const WIN_ENSURE_NEW = 'var i=GameGlobal;try{typeof window==="undefined"&&__wxSafeDP(i,"window",{value:i,configurable:!0,writable:!0})}catch(_e){}if(!GameGlobal.__isAdapterInjected){';
const NAKED_FIXES = [
  ['}window.parent=window}else{', '}try{window.parent=window}catch(_w6){}}else{'],
  [',window.DOMParser=r}', ';try{window.DOMParser=r}catch(_e){}}'],
  [';window.fsUtils=t.exports=a}', ';try{window.fsUtils=t.exports=a}catch(_e){}}'],
  // 注意：此处原码是逗号表达式语句的一段（后面紧跟 ,window.__globalAdapter&&...），
  // 必须用表达式安全的 IIFE 形态，语句级 try 会切断逗号链（polyfills 事件同款错误）
  [';window.__globalAdapter=window.__globalAdapter||{}', ';(function(){try{window.__globalAdapter=window.__globalAdapter||{}}catch(_e){}})()'],
];

function patch6(src) {
  let s = src;
  if (!s.includes('typeof window==="undefined"&&__wxSafeDP(i,"window"')) {
    const c = s.split(WIN_ENSURE_OLD).length - 1;
    if (c !== 1) { console.error(`⑥ window 扶正: 目标片段出现 ${c} 次，预期 1 次`); process.exit(1); }
    s = s.replace(WIN_ENSURE_OLD, WIN_ENSURE_NEW);
    console.log('⑥ window 全局扶正: 已注入');
  } else {
    console.log('⑥ window 全局扶正: 已存在');
  }
  for (const [oldStr, newStr] of NAKED_FIXES) {
    if (!s.includes(newStr)) {
      const c = s.split(oldStr).length - 1;
      if (c === 1) {
        s = s.replace(oldStr, newStr);
        console.log(`⑥ 裸赋值防护: ${oldStr.slice(0, 34)}...`);
      } else if (c === 0 && !s.includes(oldStr)) {
        console.log(`⑥ 裸赋值防护: ${oldStr.slice(0, 34)}... 目标不存在（版本可能已变）`);
      }
    }
  }
  return s;
}
// Cocos builder 每次重建都会往产物写 "miniprogramRoot":"./"——游戏项目带这个字段，
// 开发者工具就会去编小程序部分（找 app.json），没有 → SummerCompiler.getAllPageAndComponent
// Object.keys(null) 编译崩。builder 自己生成的，删一次不够，必须每次构建后自动删。
// —— 补丁⑦：game.js 启动诊断日志（外部建议采纳，2026-09-24）——
// 在 require('./web-adapter') 之前打印环境状态，排查启动失败时一眼看出
// window/GameGlobal/__globalAdapter 哪个缺失（用户社区标准排查手法）。
function patch7() {
  const gj = join(wg, 'game.js');
  if (!existsSync(gj)) { console.log('⑦ game.js: 不存在，跳过'); return; }
  let s = readFileSync(gj, 'utf8');
  const MARK = '[adapter before load]';
  if (s.includes(MARK)) { console.log('⑦ game.js: 诊断日志已存在'); return; }
  const diag = `console.log('${MARK}',{window:typeof window,GameGlobal:typeof GameGlobal,globalWindow:typeof GameGlobal==='undefined'?'无 GameGlobal':typeof GameGlobal.window,windowAdapter:typeof window!=='undefined'&&!!window.__globalAdapter});`;
  if (!s.includes("require('./web-adapter');")) {
    console.log('⑦ game.js: 未找到 require 调用点，跳过');
    return;
  }
  s = s.replace("require('./web-adapter');", diag + "require('./web-adapter');");
  writeFileSync(gj, s);
  console.log('⑦ game.js: 已注入启动诊断日志');
}
// —— 补丁⑤：project.config.json 排毒（2026-09-23 深夜）——
// Cocos builder 每次重建都会往产物写 "miniprogramRoot":"./"——游戏项目带这个字段，
// 开发者工具就会去编小程序部分（找 app.json），没有 → SummerCompiler.getAllPageAndComponent
// Object.keys(null) 编译崩。builder 自己生成的，删一次不够，必须每次构建后自动删。
function fixProjectConfig() {
  if (!existsSync(cfgFile)) { console.log('⑤ project.config.json: 不存在，跳过'); return; }
  const j = JSON.parse(readFileSync(cfgFile, 'utf8'));
  let changed = false;
  if ('miniprogramRoot' in j) { delete j.miniprogramRoot; changed = true; }
  if (j.condition && Object.keys(j.condition).length) { j.condition = {}; changed = true; }
  if (j.setting && j.setting.es6 !== true) { j.setting.es6 = true; changed = true; }
  if (changed) {
    writeFileSync(cfgFile, JSON.stringify(j, null, 2) + '\n');
    console.log('⑤ project.config.json: 已删除 miniprogramRoot + condition 清空 + es6:true');
  } else {
    console.log('⑤ project.config.json: 无需改动');
  }
}

// —— 补丁①：window 只读 ——
const OLD_WIN = 'i.window=r,(window=i).top=window.parent=window';
const NEW_WIN = 'try{i.window=r}catch(_w){try{Object.defineProperty(i,"window",{value:r,configurable:!0})}catch(_w2){}}try{window=i}catch(_w3){}try{window.top=window}catch(_w4){}try{window.parent=window}catch(_w5){}';

// —— 补丁②：xmldom defineProperty 能力探测 ——
const OLD_XML = 'try{Object.defineProperty&&(';
const NEW_XML = 'try{Object.defineProperty&&(function(){try{var o={};Object.defineProperty(o,"_p",{value:1});return 1===o._p}catch(e){return!1}})()&&(';

// —— 补丁③：全局安全封装 ——
// __wxSafeDP：defineProperty 失败豁免（值描述符附赋值兜底）
// __wxSetEsm：__esModule 标记安全设置（外部建议+实战加固：isFrozen 检查 + try/catch 包裹，
//   裸赋值在严格模式/对象被 freeze 时会直接抛）
const SAFE_DEF = 'var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){try{if(!("get"in d)&&!("set"in d)&&d.writable!==!1&&"value"in d)t[k]=d.value}catch(_e){}return t}};'
  + 'var __wxSetEsm=function(e){try{e&&!Object.isFrozen(e)&&(e.__esModule=!0)}catch(_e){}};';
const SAFE_MARK = '__wxSafeDP';

// —— 补丁④：__esModule 标记必须生效（值描述符，赋值兜底与 defineProperty 语义等价）——
// 灰度 shim 拒绝 defineProperty 时，若只吞异常，TS 互操作代码
// (e.__esModule?e:{default:e}) 会拿不到标记 → 把整个 exports 对象当父类 →
// "Super expression must either be null or a function"（EventTarget/Audio 链崩）。
// 替换形态必须"表达式安全"（逗号表达式位置也能用），且经 __wxSetEsm 防护。
const ESM_RE = /__wxSafeDP\((\w+),"__esModule",\{value:!0\}\)/g;
const ESM_NEW = '(__wxSafeDP($1,"__esModule",{value:!0}),__wxSetEsm($1))';
// 旧版补丁④留下的裸赋值（无防护）→ 迁移到 __wxSetEsm
const ESM_BARE_RE = /,(\w+)\.__esModule=!0/g;
const ESM_BARE_NEW = ',__wxSetEsm($1)';
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
  // 剥掉任何旧 wrapper/助手（含被③误改成的自递归版），重新在顶部注入新定义。
  // 关键：wrapper 自身的 Object.defineProperty 调用绝不能被替换（曾酿成自递归惨案）
  s = s.replace(/^var __wxSafeDP=function\(t,k,d\)\{[\s\S]*?\}\};/, '');
  s = s.replace(/^var __wxSetEsm=function\(e\)\{[\s\S]*?\}\};/, '');
  s = SAFE_DEF + s;
  const wlen = SAFE_DEF.length;
  let tail = s.slice(wlen);
  const n = (tail.match(/Object\.defineProperty\(/g) || []).length;
  // 调用点：Object.defineProperty( → __wxSafeDP( （前面不能是 . 或标识符字符，防误伤属性访问）
  tail = tail.replace(/(^|[^.\w$])Object\.defineProperty\(/g, '$1__wxSafeDP(');
  // 裸引用：=Object.defineProperty / ,Object.defineProperty 等（传给别处调用的存根）
  tail = tail.replace(/(^|[^.\w$])Object\.defineProperty(?!\()/g, '$1__wxSafeDP');
  // ④ __esModule 标记：补赋值兜底（TS 互操作不能瞎）+ 迁移旧版裸赋值到防护助手
  const esmCount = (tail.match(ESM_RE) || []).length;
  if (esmCount > 0) tail = tail.replace(ESM_RE, ESM_NEW);
  const bareCount = (tail.match(ESM_BARE_RE) || []).length;
  if (bareCount > 0) tail = tail.replace(ESM_BARE_RE, ESM_BARE_NEW);
  s = s.slice(0, wlen) + tail;
  if (s !== before) {
    writeFileSync(f, s);
    total += n;
    console.log(`③ ${rel}: 封装 ${n} 处调用点，④ __esModule 兜底 ${esmCount} 处${bareCount ? `，迁移裸赋值 ${bareCount} 处` : ''}`);
  } else {
    console.log(`③ ${rel}: 无需改动`);
  }
}
// ⑥ 对入口模块做 window 扶正 + 裸赋值防护（仅 web-adapter.js 需要，幂等）
{
  const before6 = readFileSync(target, 'utf8');
  const after6 = patch6(before6);
  if (after6 !== before6) writeFileSync(target, after6);
}
console.log(`提示：共处理 ${total} 个 defineProperty 调用点；重新构建微信包后需要再跑一次本脚本`);
fixProjectConfig();
patch7();