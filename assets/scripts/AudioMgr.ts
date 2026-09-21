// 音效管理器：素材优先，缺失自动降级为 WebAudio 代码合成（零素材、零包体）
// 素材约定：assets/resources/audio/{pickup,bridge,win,lose}.mp3（放进去即优先用，见 docs/audio-assets.md）
// 合成参数唯一源：assets/scripts/SfxSynth.ts（与浏览器版同源，tools/smoke.ts 有漂移锁）
// 平台适配：Web 用 window.AudioContext；微信小游戏用 wx.createWebAudioContext；都没有则静默跳过
const { ccclass } = _decorator;
import { _decorator, Component, resources, AudioClip, AudioSource } from 'cc';
import { SfxName, toneSchedule } from './SfxSynth';

type AudioCtxLike = {
  currentTime: number;
  state?: string;
  destination: unknown;
  resume?: () => void;
  createOscillator: () => any;
  createGain: () => any;
};

@ccclass('AudioMgr')
export class AudioMgr extends Component {
  private src: AudioSource | null = null;
  private cache = new Map<string, AudioClip>();
  private ctx: AudioCtxLike | null = null;
  private synthOnly = false; // 探测到素材缺失后，本局一律走合成（不反复 IO）
  muted = false;
  volume = 1;

  onLoad(): void {
    this.src = this.getComponent(AudioSource) ?? this.addComponent(AudioSource);
    // 预热合成上下文：首次点击后再创建浏览器才允许出声
    this.ensureCtx();
  }

  // 平台自适应创建音频上下文（Web / 微信小游戏 / 其他平台返回 null）
  private ensureCtx(): AudioCtxLike | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume?.();
      return this.ctx;
    }
    try {
      const g = globalThis as any;
      if (typeof g.wx !== 'undefined' && g.wx && typeof g.wx.createWebAudioContext === 'function') {
        this.ctx = g.wx.createWebAudioContext() as AudioCtxLike; // 微信小游戏
      } else if (typeof g.AudioContext !== 'undefined') {
        this.ctx = new g.AudioContext() as AudioCtxLike;        // 浏览器 / Web 预览
      }
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  play(name: SfxName, volumeScale = 1): void {
    if (this.muted) return;
    const cached = this.cache.get(name);
    if (cached) {
      this.src?.playOneShot(cached, volumeScale * this.volume);
      return;
    }
    if (this.synthOnly) {
      this.synth(name, volumeScale);
      return;
    }
    resources.load(`audio/${name}`, AudioClip, (err, clip) => {
      if (err || !clip) {
        this.synthOnly = true; // 素材未就位：本局降级为代码合成（不刷错误）
        this.synth(name, volumeScale);
        return;
      }
      this.cache.set(name, clip);
      this.src?.playOneShot(clip, volumeScale * this.volume);
    });
  }

  // 代码合成：按 SfxSynth 的调度表逐音起振（无音频环境时静默跳过）
  private synth(name: SfxName, volumeScale: number): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const scale = volumeScale * this.volume;
    for (const t of toneSchedule(name, scale)) {
      try {
        const start = ctx.currentTime + t.delay;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = t.type;
        o.frequency.setValueAtTime(t.freq, start);
        if (t.endFreq !== t.freq) o.frequency.exponentialRampToValueAtTime(t.endFreq, start + t.dur);
        g.gain.setValueAtTime(Math.max(0.0001, t.vol), start);
        g.gain.exponentialRampToValueAtTime(0.001, start + t.dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(start);
        o.stop(start + t.dur);
      } catch {
        /* 单音失败不影响整局 */
      }
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }
}