// 小工具：基于官方文档确认的 tween 模式（tween(Vec3).to(..., {onUpdate})）
import { Node, Vec3, tween } from 'cc';

export function tweenPos(node: Node, dur: number, to: Vec3, onDone?: () => void): void {
  const cur = new Vec3();
  node.getPosition(cur);
  const tw = tween(cur).to(dur, to, {
    onUpdate: (v: Vec3) => node.setPosition(v),
  });
  if (onDone) tw.call(onDone);
  tw.start();
}

export function tweenScale(node: Node, dur: number, to: Vec3, onDone?: () => void): void {
  const cur = new Vec3();
  node.getScale(cur);
  const tw = tween(cur).to(dur, to, {
    onUpdate: (v: Vec3) => node.setScale(v),
  });
  if (onDone) tw.call(onDone);
  tw.start();
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
