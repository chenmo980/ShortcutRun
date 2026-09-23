// 回归测试：验证两个补丁确实解决问题
// 在 vm 沙箱里分别模拟：
//   ① 新版微信基础库——GameGlobal.window 是只读 getter、严格模式模块
//   ② 灰度基础库 shim——Object.defineProperty 对原型对象抛
//      "Object.defineProperty called on non-object"
// 旧代码必须抛异常、新代码必须存活。
import vm from 'node:vm';

const OLD_WIN = 'i.window=r,(window=i).top=window.parent=window';
const NEW_WIN = 'try{i.window=r}catch(_w){try{Object.defineProperty(i,"window",{value:r,configurable:!0})}catch(_w2){}}try{window=i}catch(_w3){}try{window.top=window}catch(_w4){}try{window.parent=window}catch(_w5){}';

const OLD_XML = 'try{Object.defineProperty&&(Object.defineProperty(c.prototype,"length",{get:function(){return l(this)}}),X=function(){});}catch(e){}';
const NEW_XML = 'try{Object.defineProperty&&(function(){try{var o={};Object.defineProperty(o,"_p",{value:1});return 1===o._p}catch(e){return!1}})()&&(Object.defineProperty(c.prototype,"length",{get:function(){return l(this)}}),X=function(){});}catch(e){}';
function runWindowTest(frag) {
  const realWindow = {};
  const sandbox = { r: { document: {}, foo: 1 } };
  const i = {};
  Object.defineProperty(i, 'window', { get() { return realWindow; }, configurable: true });
  sandbox.i = i;
  Object.defineProperty(sandbox, 'window', { get() { return realWindow; }, configurable: true });
  vm.createContext(sandbox);
  try {
    vm.runInContext(`"use strict";\n${frag}`, sandbox);
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

// 模拟灰度基础库 defineProperty shim：对原型对象一律抛平台错误
function runXmlTest(frag, brokenShim) {
  const realDp = Object.defineProperty;
  const ObjectShim = {
    defineProperty(target, key, desc) {
      if (brokenShim) {
        // 灰度 3.17.3 特征：原型对象/非 plain object 一律抛，普通对象探测才放行
        const isPlain = target !== null && typeof target === 'object'
          && Object.getPrototypeOf(target) === Object.prototype;
        if (!isPlain) throw new TypeError('Object.defineProperty called on non-object');
        return realDp(target, key, desc);
      }
      return realDp(target, key, desc);
    },
  };
  const sandbox = { Object: ObjectShim, c: function C() {}, l: function () {}, X: null };
  vm.createContext(sandbox);
  try {
    vm.runInContext(`"use strict";\n${frag}`, sandbox);
    return { ok: true, X: sandbox.X };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

let failed = 0;

// ① window 只读
const oldWin = runWindowTest(OLD_WIN);
const newWin = runWindowTest(NEW_WIN);
console.log(`[window] 旧代码: ${oldWin.ok ? '未抛异常(意外!)' : '抛异常 -> ' + oldWin.err}`);
console.log(`[window] 新代码: ${newWin.ok ? '存活 ✓' : '仍抛异常 -> ' + newWin.err}`);
if (oldWin.ok || !newWin.ok) failed++;

// ② xmldom defineProperty：坏 shim 下降级存活且跳过增强；正常环境仍应用增强
const newBad = runXmlTest(NEW_XML, true);
console.log(`[xmldom·灰度shim] 新代码: ${newBad.ok ? '存活 ✓' : '抛异常 -> ' + newBad.err}，增强已跳过=${newBad.X === null}`);
if (!newBad.ok) failed++;
const newOk = runXmlTest(NEW_XML, false);
console.log(`[xmldom·正常环境] 新代码: ${newOk.ok ? '存活 ✓' : '抛异常 -> ' + newOk.err}，增强仍生效=${typeof newOk.X === 'function'}`);
if (!newOk.ok || typeof newOk.X !== 'function') failed++;

if (failed) {
  console.error(`FAIL: ${failed} 个补丁回归未过`);
  process.exit(1);
}
console.log('PASS: 两个补丁在模拟的新基础库环境下均有效');
