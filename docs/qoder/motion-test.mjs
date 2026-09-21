// tools/motion.mts —— 基础运动层 headless 断言（node tools/motion.mts）
import {
  accelTowards, integrate, turnToward, headingOf, gait,
  solveThrow, stepProjectile, simulateThrow, GRAVITY,
} from './motion.mjs';

let fails = 0;
const check = (name, ok, info = '') => {
  if (!ok) { fails++; console.log('FAIL', name, info); }
  else console.log('ok  ', name);
};

// —— accelTowards：收敛到限速、方向正确、不超调、确定 ——
{
  let vel = { x: 0, z: 0 }, pos = { x: 0, y: 0, z: 0 };
  const dt = 1 / 60;
  let over = 0, t = 0;
  while (t < 5) {
    vel = accelTowards(vel, 0, -1, 6, 8, dt); // 向 -Z 跑
    pos = integrate(pos, { ...vel, y: 0 }, dt);
    if (Math.hypot(vel.x, vel.z) > 6 + 1e-6) over++;
    t += dt;
  }
  check('run speed capped', over === 0);
  check('run converges ~6', Math.abs(Math.hypot(vel.x, vel.z) - 6) < 0.05, `v=${Math.hypot(vel.x, vel.z).toFixed(2)}`);
  check('run direction -Z', pos.z < -20 && Math.abs(pos.x) < 1e-9, `z=${pos.z.toFixed(1)}`);
  const v2 = accelTowards({ x: 0, z: 0 }, 0, -1, 6, 8, dt);
  check('run deterministic', v2.x === 0 && Math.abs(v2.z + 6 * Math.min(1, 8 * dt)) < 1e-9);
}

// —— turnToward：最短路、不越过目标 ——
{
  const twoPi = Math.PI * 2;
  const a = turnToward(359 * Math.PI / 180, 1 * Math.PI / 180, 0.1);
  check('turn shortest-path', a > 359 * Math.PI / 180 || a < 1 * Math.PI / 180 + 0.01, `a=${(a * 180 / Math.PI).toFixed(1)}deg`);
  let h = 0;
  for (let i = 0; i < 100; i++) h = turnToward(h, Math.PI / 2, 0.05);
  check('turn no-overshoot', Math.abs(h - Math.PI / 2) < 1e-9, `h=${h.toFixed(4)}`);
  check('headingOf(-Z)=0', Math.abs(headingOf(0, -1)) < 1e-9);
}

// —— gait：值域与周期 ——
{
  let bad = false, minL = 9, maxL = -9;
  for (let t = 0; t < 3; t += 1 / 60) {
    const g = gait(t, 0.45, 1);
    if (g.phase < 0 || g.phase >= 1 || g.bob < 0 || g.bob > 0.1) { bad = true; break; }
    minL = Math.min(minL, g.legA); maxL = Math.max(maxL, g.legA);
  }
  check('gait ranges', !bad && minL >= -1 && maxL <= 1, `leg∈[${minL.toFixed(2)},${maxL.toFixed(2)}]`);
  const g0 = gait(0, 0.45, 1), g1 = gait(0.45, 0.45, 1);
  check('gait periodic', Math.abs(g0.phase - g1.phase) < 1e-9);
  const gs = gait(0.1, 0.45, 0);
  check('gait speed0 = still', gs.legA === 0 && gs.bob === 0 && gs.lean === 0);
}

// —— solveThrow/simulateThrow：落点命中目标 ——
{
  const cases = [
    [{ x: 0, y: 0.8, z: 0 }, { x: 5, y: 0, z: -3 }, 3],
    [{ x: -2, y: 1, z: 4 }, { x: 8, y: 0, z: 4 }, 5],
    [{ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -12 }, 8],
  ];
  for (const [from, to, apex] of cases) {
    const v0 = solveThrow(from, to, apex, GRAVITY);
    if (!v0) { check(`throw solve ${to.x},${to.z}`, false, 'null'); continue; }
    const land = simulateThrow(from, v0, GRAVITY, 1 / 240);
    const err = Math.hypot(land.pos.x - to.x, land.pos.z - to.z);
    check(`throw hits ${to.x},${to.z}`, err < 0.15, `err=${err.toFixed(3)} t=${land.t.toFixed(2)}`);
  }
  // 逐步积分版（60fps 游戏实际用法）误差仍在半米内
  const v0 = solveThrow({ x: 0, y: 0.8, z: 0 }, { x: 6, y: 0, z: 0 }, 4, GRAVITY);
  let p = { x: 0, y: 0.8, z: 0 }, v = { ...v0 }, t = 0;
  while (t < 5) {
    const r = stepProjectile(p, v, 1 / 60, GRAVITY);
    p = r.pos; v = r.vel; t += 1 / 60;
    if (r.landed) break;
  }
  check('throw 60fps lands', p.y === 0 && Math.abs(p.x - 6) < 0.5, `x=${p.x.toFixed(2)} y=${p.y}`);
}

console.log(fails ? `\n${fails} checks FAILED` : '\nmotion OK: base functions all passed');
process.exit(fails ? 1 : 0);
