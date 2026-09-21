// 基础运动功能层：跑步/转向/步态/抛体，纯函数零依赖（cc-free、DOM-free）。
// 约定：位置 {x,y,z}（y=高度，地面 y=0），速度/方向同构。全部 in-place 或返回新对象，无内部状态，可确定性重放。

export const GRAVITY = -24; // 游戏化重力（m/s²），比真实 9.8 手感更"脆"

// —— 跑步：速度向目标方向逼近（accel 越大起步越快），上限 maxSpeed ——
export function accelTowards(vel, dirX, dirZ, maxSpeed, accel, dt) {
  const t = Math.min(1, accel * dt);
  let vx = vel.x + (dirX * maxSpeed - vel.x) * t;
  let vz = vel.z + (dirZ * maxSpeed - vel.z) * t;
  const sp = Math.hypot(vx, vz);
  if (sp > maxSpeed) { vx = vx / sp * maxSpeed; vz = vz / sp * maxSpeed; }
  return { x: vx, z: vz };
}

export function integrate(pos, vel, dt) {
  return { x: pos.x + vel.x * dt, y: pos.y ?? 0, z: pos.z + vel.z * dt };
}

// —— 转向：角度最短路平滑（避免 359°→1° 绕远）——
export function turnToward(heading, target, maxDelta) {
  let d = (target - heading) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return heading + Math.max(-maxDelta, Math.min(maxDelta, d));
}

export function headingOf(vx, vz) {
  return Math.atan2(vx, -vz); // 0 = -Z 前进方向，与 Cocos/Three 常用前向一致
}

// —— 步态：无骨骼也能有的程序化跑步动画 ——
// 返回 phase∈[0,1)，legA/legB∈[-1,1] 前后摆幅度，bob 身体上下起伏，lean 前倾角
export function gait(t, period = 0.45, speed01 = 1) {
  const phase = ((t / period) % 1 + 1) % 1;
  const s = Math.sin(phase * Math.PI * 2);
  return {
    phase,
    legA: s * speed01,
    legB: -s * speed01,
    bob: Math.abs(Math.cos(phase * Math.PI * 2)) * 0.06 * speed01,
    lean: 0.18 * speed01,
  };
}

// —— 投掷：给定起点/落点/期望顶点高度，解出初速度（无空气阻力抛物线）——
// 解法：取飞行时间 T 使顶点恰为 apexY，则 vy0 = g*T/2（g 取绝对值），水平分量 = 距离/T
export function solveThrow(from, to, apexAboveGround, gravity = GRAVITY) {
  const g = Math.abs(gravity);
  const dx = to.x - from.x, dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  const dy = (to.y ?? 0) - (from.y ?? 0);
  // 上升段高度 = apex - max(from.y,to.y) 决定竖直初速；总时间由两段合成
  const riseH = Math.max(0.1, apexAboveGround - Math.max(from.y ?? 0, to.y ?? 0));
  const tUp = Math.sqrt(2 * riseH / g);
  const tDown = Math.sqrt(2 * (apexAboveGround - (to.y ?? 0)) / g);
  const T = tUp + tDown;
  if (!(T > 0) || !Number.isFinite(T)) return null;
  return {
    x: dist > 1e-6 ? dx / T : 0,
    y: (dy + 0.5 * g * T * T) / T,
    z: dist > 1e-6 ? dz / T : 0,
    flightTime: T,
  };
}

// 抛体单步积分；y 触地即吸附并置 landed
export function stepProjectile(p, v, dt, gravity = GRAVITY) {
  const pos = { x: p.x + v.x * dt, y: (p.y ?? 0) + v.y * dt, z: p.z + v.z * dt };
  const vel = { x: v.x, y: v.y + gravity * dt, z: v.z };
  let landed = false;
  if (pos.y <= 0 && vel.y < 0) { pos.y = 0; landed = true; }
  return { pos, vel, landed };
}

// 从 from 以 v0 投出，逐步积分直到落地，返回落点（校验 solveThrow 用）
export function simulateThrow(from, v0, gravity = GRAVITY, dt = 1 / 60, maxT = 10) {
  let p = { ...from, y: from.y ?? 0 }, v = { ...v0 };
  for (let t = 0; t < maxT; t += dt) {
    const r = stepProjectile(p, v, dt, gravity);
    p = r.pos; v = r.vel;
    if (r.landed) return { pos: p, t };
  }
  return { pos: p, t: maxT, timeout: true };
}
