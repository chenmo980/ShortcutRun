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

if (failed) {
  console.error(`FAIL: ${failed} 个补丁回归未过`);
  process.exit(1);
}
console.log('PASS: 三个补丁在模拟的新基础库环境下均有效');
