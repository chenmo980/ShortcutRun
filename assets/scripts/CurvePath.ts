// 弯道（表现层）：level-space z → 世界位置变换
// 设计约束：LevelGen/母本数据完全不变（parity 字节锁不破），弯道只作用于渲染与运动层
// 参考原版 Shortcut Run 的 S 弯：中路正弦弯曲，朝向=切线角
import { Cfg } from './config';

export interface CurveState {
  amp: number;
  freq: number;
  phase: number;
}

export function curveFromCfg(cfg: Cfg): CurveState {
  return { amp: cfg.curveAmp ?? 0, freq: cfg.curveFreq ?? 0.12, phase: cfg.curvePhase ?? 0 };
}

// 弯道中心线在给定 z 处的世界 X
export function bendX(z: number, c: CurveState): number {
  return c.amp * Math.sin(z * c.freq + c.phase);
}

// 中心线切线斜率（用于朝向与斜切补偿）
export function bendDx(z: number, c: CurveState): number {
  return c.amp * c.freq * Math.cos(z * c.freq + c.phase);
}

// 给定 z 处路径朝向角（绕 Y）
export function headingAt(z: number, c: CurveState): number {
  return Math.atan(bendDx(z, c));
}

// 斜切补偿：斜放盒的长度需除以 cos(朝向) 才不漏缝
export function secant(z: number, c: CurveState): number {
  return 1 / Math.max(0.75, Math.cos(headingAt(z, c)));
}
