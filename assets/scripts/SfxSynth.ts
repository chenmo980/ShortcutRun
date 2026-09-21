// 音效合成表（cc-free 纯逻辑，可 headless 断言）
// 与 web-preview/index.html 内联 sfx 表同源：改这里必须同步改那边（tools/smoke.ts 有漂移锁）
// 用途：Cocos/微信侧素材缺失时降级为代码合成，零素材、零包体（wechat-build.md §3 方案①）

export type SfxName = 'pickup' | 'bridge' | 'win' | 'lose';

export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface Tone {
  freq: number;
  dur: number;
  type: OscType;
  vol: number;
  slide?: number;
  delay?: number;
}

export const SFX: Record<SfxName, Tone[]> = {
  pickup: [{ freq: 880, dur: 0.08, type: 'square', vol: 0.07, slide: 400 }],
  bridge: [
    { freq: 160, dur: 0.18, type: 'sawtooth', vol: 0.16, slide: -60 },
    { freq: 320, dur: 0.1, type: 'square', vol: 0.07 },
  ],
  win: [
    { freq: 523, dur: 0.15, type: 'triangle', vol: 0.14, delay: 0 },
    { freq: 659, dur: 0.15, type: 'triangle', vol: 0.14, delay: 0.09 },
    { freq: 784, dur: 0.15, type: 'triangle', vol: 0.14, delay: 0.18 },
    { freq: 1047, dur: 0.15, type: 'triangle', vol: 0.14, delay: 0.27 },
  ],
  lose: [{ freq: 220, dur: 0.4, type: 'sawtooth', vol: 0.14, slide: -160 }],
};

export interface ScheduledTone {
  freq: number;
  dur: number;
  type: OscType;
  vol: number;
  delay: number;
  endFreq: number;
}

export function toneSchedule(name: SfxName, volumeScale = 1): ScheduledTone[] {
  return SFX[name].map((t) => ({
    freq: t.freq,
    dur: t.dur,
    type: t.type,
    vol: t.vol * volumeScale,
    delay: t.delay ?? 0,
    endFreq: t.slide ? Math.max(30, t.freq + t.slide) : t.freq,
  }));
}

export function sfxDuration(name: SfxName): number {
  return toneSchedule(name).reduce((m, t) => Math.max(m, t.delay + t.dur), 0);
}