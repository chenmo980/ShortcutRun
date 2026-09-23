// 回归测试：验证 window 只读补丁确实解决问题
// 在 vm 沙箱里模拟新版微信基础库特征——GameGlobal.window 是只读 getter、
// 严格模式模块——然后分别运行旧/新代码片段，旧代码必须抛异常、新代码必须存活。
import vm from 'node:vm';

const OLD = 'i.window=r,(window=i).top=window.parent=window';
const NEW = 'try{i.window=r}catch(_w){try{Object.defineProperty(i,"window",{value:r,configurable:!0})}catch(_w2){}}try{window=i}catch(_w3){}try{window.top=window}catch(_w4){}try{window.parent=window}catch(_w5){}';

function runFragment(frag) {
  const realWindow = {};
  const sandbox = { r: { document: {}, foo: 1 } };
  // i = GameGlobal，其 window 是只读 getter（新版基础库行为）
  const i = {};
  Object.defineProperty(i, 'window', { get() { return realWindow; }, configurable: true });
  sandbox.i = i;
  // 全局 window 同样是只读 getter
  Object.defineProperty(sandbox, 'window', { get() { return realWindow; }, configurable: true });
  vm.createContext(sandbox);
  try {
    vm.runInContext(`"use strict";\n${frag}`, sandbox);
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

const oldResult = runFragment(OLD);
const newResult = runFragment(NEW);
console.log(`旧代码: ${oldResult.ok ? '未抛异常(意外!)' : '抛异常 -> ' + oldResult.err}`);
console.log(`新代码: ${newResult.ok ? '存活 ✓' : '仍抛异常 -> ' + newResult.err}`);

if (oldResult.ok) { console.error('FAIL: 旧代码在模拟环境中应抛异常但没有'); process.exit(1); }
if (!newResult.ok) { console.error('FAIL: 新代码在模拟环境中应存活'); process.exit(1); }
console.log('PASS: 补丁在只读 window 环境下有效');
