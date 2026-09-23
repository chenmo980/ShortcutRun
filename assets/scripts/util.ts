// 小工具：基于官方文档确认的 tween 模式（tween(Vec3).to(..., {onUpdate})）
// 注意：所有回调都要过 node.isValid 守卫——场景 reload 时节点可能已被销毁（Qoder 评审发现）
import { Node, Vec3, tween } from 'cc';

export function tweenPos(node: Node, dur: number, to: Vec3, onDone?: () => void): void {
  const cur = new Vec3();
  node.getPosition(cur);
  const tw = tween(cur).to(dur, to, {
    onUpdate: (v: Vec3) => { if (node.isValid) node.setPosition(v); },
  });
  if (onDone) tw.call(() => { if (node.isValid) onDone(); });
  tw.start();
}

export function tweenScale(node: Node, dur: number, to: Vec3, onDone?: () => void): void {
  const cur = new Vec3();
  node.getPosition(cur);
  const tw = tween(cur).to(dur, to, {
    onUpdate: (v: Vec3) => { if (node.isValid) node.setScale(v); },
  });
  if (onDone) tw.call(() => { if (node.isValid) onDone(); });
  tw.start();
}

// 绕 Z 轴翻滚 tween（被撞飞失衡姿态用）；node 可能已被销毁，onUpdate 必须 isValid 守卫
export function tweenEulerZ(node: Node, to: number, dur: number): void {
  const obj = { z: node.eulerAngles.z };
  tween(obj).to(dur, { z: to }, {
    onUpdate: (v: { z: number }) => {
      if (!node.isValid) return;
      node.eulerAngles = new Vec3(node.eulerAngles.x, node.eulerAngles.y, v.z);
    },
  }).start();
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
