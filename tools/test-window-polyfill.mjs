// 回归测试：验证三个补丁在新基础库环境下有效
// ① window 只读：GameGlobal.window 是只读 getter（严格模式模块）
// ② xmldom defineProperty 探测：坏 shim 下降级、好环境仍生效
// ③ 全局 __wxSafeDP 封装：坏 shim 下原型对象调用被吞、普通对象仍生效
//
// 实现要点：坏 shim 在 vm 上下文内注入（realm 安全）——用
// "target === target.constructor.prototype" 判定是否函数原型，
// 避免宿主/沙箱两个 realm 的 Object.prototype 不一致导致误判。
import vm from 'node:vm';

const OLD_WIN = 'i.window=r,(window=i).top=window.parent=window';
const NEW_WIN = 'try{i.window=r}catch(_w){try{Object.defineProperty(i,"window",{value:r,configurable:!0})}catch(_w2){}}try{window=i}catch(_w3){}try{window.top=window}catch(_w4){}try{window.parent=window}catch(_w5){}';

const OLD_XML = 'try{Object.defineProperty&&(Object.defineProperty(c.prototype,"length",{get:function(){return l(this)}}),X=function(){});}catch(e){}';
const NEW_XML = 'try{Object.defineProperty&&(function(){try{var o={};Object.defineProperty(o,"_p",{value:1});return 1===o._p}catch(e){return!1}})()&&(Object.defineProperty(c.prototype,"length",{get:function(){return l(this)}}),X=function(){});}catch(e){}';

// 在 vm 内注入灰度特征 shim：拒绝函数原型对象，其余放行
const GRAY_SHIM = `
  (function(){
    var dp = Object.defineProperty;
    Object.defineProperty = function(t, k, d){
      if (t !== null && typeof t === 'object' && typeof t.constructor === 'function' && t === t.constructor.prototype) {
        throw new TypeError('Object.defineProperty called on non-object');
      }
      return dp(t, k, d);
    };
  })();
`;

function runWin(frag) {
  const realWindow = {};
  const i = {};
  Object.defineProperty(i, 'window', { get() { return realWindow; }, configurable: true });
  const sandbox = { r: { document: {}, foo: 1 }, i };
  Object.defineProperty(sandbox, 'window', { get() { return realWindow; }, configurable: true });
  vm.createContext(sandbox);
  try {
    vm.runInContext(`"use strict";\n${frag}`, sandbox);
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

function runXml(frag, gray) {
  const sandbox = { c: function C() {}, l: function () {}, X: null };
  vm.createContext(sandbox);
  try {
    if (gray) vm.runInContext(GRAY_SHIM, sandbox);
    vm.runInContext(`"use strict";\n${frag}`, sandbox);
    return { ok: true, X: sandbox.X };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

function runSafeDp(gray) {
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    if (gray) vm.runInContext(GRAY_SHIM, sandbox);
    vm.runInContext(`
      "use strict";
      var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){return t}};
      function C(){} C.prototype.length=1;
      __wxSafeDP(C.prototype,"length",{get:function(){return 42}});
      var o={}; __wxSafeDP(o,"ok",{value:1});
      globalThis.__r={protoSurvived:C.prototype.length===1, plain:o.ok};
    `, sandbox);
    return { ok: true, proto: sandbox.__r.protoSurvived, plain: sandbox.__r.plain === 1 };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

let failed = 0;

// ① window 只读
const oldWin = runWin(OLD_WIN);
const newWin = runWin(NEW_WIN);
console.log(`[window] 旧代码: ${oldWin.ok ? '未抛异常(意外!)' : '抛异常 -> ' + oldWin.err}`);
console.log(`[window] 新代码: ${newWin.ok ? '存活 ✓' : '仍抛异常 -> ' + newWin.err}`);
if (oldWin.ok || !newWin.ok) failed++;

// ② xmldom：坏 shim 下降级存活且跳过增强；正常环境仍应用增强
const xmlBad = runXml(NEW_XML, true);
console.log(`[xmldom·灰度shim] 新代码: ${xmlBad.ok ? '存活 ✓' : '抛异常 -> ' + xmlBad.err}，增强已跳过=${xmlBad.X === null}`);
if (!xmlBad.ok) failed++;
const xmlOk = runXml(NEW_XML, false);
console.log(`[xmldom·正常环境] 新代码: ${xmlOk.ok ? '存活 ✓' : '抛异常 -> ' + xmlOk.err}，增强仍生效=${typeof xmlOk.X === 'function'}`);
if (!xmlOk.ok || typeof xmlOk.X !== 'function') failed++;

// ③ __wxSafeDP：坏 shim 下原型调用被吞但存活、普通对象调用仍生效
const dpBad = runSafeDp(true);
console.log(`[safeDP·灰度shim] 新代码: ${dpBad.ok ? '存活 ✓' : '抛异常 -> ' + dpBad.err}，原型调用未崩=${dpBad.proto}，普通对象生效=${dpBad.plain}`);
if (!dpBad.ok || !dpBad.plain) failed++;

// ④ __esModule 互操作：坏 shim 下（defineProperty 全拒）TS 的
//    (e.__esModule?e:{default:e}) + class extends e.default 必须仍能拿到真父类。
//    三种形态对照：
//    A 补丁④形态（调 wrapper + 普通赋值兜底）→ 必须成立
//    B 补丁③形态（只调 wrapper 吞异常、无赋值）→ 必须失败（用户实际踩的坑）
//    C 自递归 wrapper（补丁③污染自身定义的形态）→ 必须失败
function runInteropTest(mode) {
  const sandbox = {};
  vm.createContext(sandbox);
  const ESM_HELPER = 'var __wxSetEsm=function(e){try{e&&!Object.isFrozen(e)&&(e.__esModule=!0)}catch(_e){}};';
  const wrappers = {
    A: ESM_HELPER + 'var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){try{if(!("get"in d)&&!("set"in d)&&d.writable!==!1&&"value"in d)t[k]=d.value}catch(_e){}return t}};',
    B: 'var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){return t}};',
    C: 'var __wxSafeDP=function(t,k,d){try{return __wxSafeDP(t,k,d)}catch(e){return t}};',
  };
  const marks = {
    A: '(__wxSafeDP(exports11,"__esModule",{value:!0}),__wxSetEsm(exports11));',
    B: '__wxSafeDP(exports11,"__esModule",{value:!0});',
    // C = 真实事故形态：wrapper 被自己的正则污染成自递归 + 当年还没有补丁④兜底
    C: '__wxSafeDP(exports11,"__esModule",{value:!0});',
  };
  try {
    vm.runInContext(`
      "use strict";
      Object.defineProperty = function(){ throw new TypeError("Object.defineProperty called on non-object"); };
      ${wrappers[mode]}
      var exports11 = {};
      var ET = function ET(){};
      ET.prototype.addEventListener = function(){};
      ${marks[mode]}
      exports11.default = ET;
      var e = exports11.__esModule ? exports11 : { default: exports11 };
      // 注意：须模拟真实编译产物——__extends 在模块级 IIFE 里跑（实例化之前），
      // 放构造函数体内是错的（new 时原型还没换）
      var __extends = function(sub, sup){ function F(){ this.constructor = sub; } F.prototype = sup.prototype; sub.prototype = new F(); };
      var Audio = (function(){ __extends(Audio, e.default); function Audio(){} return Audio; })();
      globalThis.__r = (new Audio()) instanceof ET;
    `, sandbox);
    return { ok: true, inherited: sandbox.__r === true };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}
const interopA = runInteropTest('A');
console.log(`[interop·补丁④形态] ${interopA.ok && interopA.inherited ? '继承链成立 ✓' : '失败 -> ' + (interopA.err || '父类不是函数')}`);
if (!interopA.ok || !interopA.inherited) failed++;
const interopB = runInteropTest('B');
const bBroken = !interopB.ok || !interopB.inherited;
console.log(`[interop·补丁③形态(对照)] ${bBroken ? '按预期失败（证明补丁④必要）' : '意外成立(?)'}`);
if (!bBroken) failed++;
const interopC = runInteropTest('C');
const cBroken = !interopC.ok || !interopC.inherited;
console.log(`[interop·自递归wrapper(对照)] ${cBroken ? '按预期失败（证明不能污染 wrapper 自身）' : '意外成立(?)'}`);
if (!cBroken) failed++;

// ④' frozen exports 场景（外部建议点化的用例）：exports 被 Object.freeze 时
//     isFrozen 守卫 + try/catch 必须保证不抛（即使标记设不上也不崩）
function runFrozenExportsTest() {
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    vm.runInContext(`
      "use strict";
      Object.defineProperty = function(){ throw new TypeError("Object.defineProperty called on non-object"); };
      var __wxSafeDP=function(t,k,d){try{return Object.defineProperty(t,k,d)}catch(e){try{if(!("get"in d)&&!("set"in d)&&d.writable!==!1&&"value"in d)t[k]=d.value}catch(_e){}return t}};
      var __wxSetEsm=function(e){try{e&&!Object.isFrozen(e)&&(e.__esModule=!0)}catch(_e){}};
      var exports11 = Object.freeze({ default: function ET(){} });
      (__wxSafeDP(exports11,"__esModule",{value:!0}),__wxSetEsm(exports11));
      globalThis.__r = "survived";
    `, sandbox);
    return { ok: true };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}
const frozen = runFrozenExportsTest();
console.log(`[frozen-exports] 冻结 exports: ${frozen.ok ? '不抛异常 ✓' : '抛异常 -> ' + frozen.err}`);
if (!frozen.ok) failed++;

// ⑤ window 缺失扶正（补丁⑥）：模拟 3.0.2 subcontext 无 window 全局——
//    扶正后 window 可解析、=== GameGlobal、parent 赋值成功；
//    再验兜底：扶正也失败时 try 包裹的裸赋值不崩
function runWindowEnsureTest(safeDpWorks) {
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    vm.runInContext(`
      "use strict";
      var GameGlobal = globalThis;
      var __wxSafeDP = function(t,k,d){
        try { return Object.defineProperty(t,k,d); }
        catch(e) { try { if(!("get"in d)&&!("set"in d)&&d.writable!==!1&&"value"in d) t[k]=d.value; } catch(_e){} return t; }
      };
      if (!${safeDpWorks}) { __wxSafeDP = function(){ return null; }; } // 扶正也失败的极端情况
      var i = GameGlobal;
      try { typeof window === "undefined" && __wxSafeDP(i,"window",{value:i,configurable:!0,writable:!0}); } catch(_e) {}
      try { window.parent = window; } catch(_w6) {}
      globalThis.__r = { winDefined: typeof window !== "undefined", same: typeof window !== "undefined" && window === i };
    `, sandbox);
    return { ok: true, r: sandbox.__r };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}
const we1 = runWindowEnsureTest(true);
console.log(`[window扶正·defineProperty可用] 不抛=${we1.ok} window生效=${we1.r && we1.r.winDefined && we1.r.same}`);
if (!we1.ok || !we1.r || !we1.r.winDefined || !we1.r.same) failed++;
const we2 = runWindowEnsureTest(false);
console.log(`[window扶正·极端失败兜底] 不抛异常=${we2.ok}`);
if (!we2.ok) failed++;

if (failed) {
  console.error(`FAIL: ${failed} 个补丁回归未过`);
  process.exit(1);
}
console.log('PASS: 全部补丁回归通过');
