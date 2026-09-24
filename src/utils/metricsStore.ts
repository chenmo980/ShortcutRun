import { GameMetrics } from '../types';

let current: GameMetrics = {
  score: 0,
  planksCarried: 12,
  planksPlaced: 0,
  multiplier: 1,
  state: 'running',
  drawCalls: 18,
  fps: 60,
};

const listeners = new Set<() => void>();

export const metricsStore = {
  get: (): GameMetrics => current,
  set: (m: GameMetrics): void => {
    current = m;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
