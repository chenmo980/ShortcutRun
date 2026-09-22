// 广告单一入口（docs/k2/k1-ad-spec.md）：激励视频主力 / 插屏辅助 / Banner 仅菜单
// 微信：wx.createRewardedVideoAd 等；浏览器/Cocos 预览：桩实现立即 resolve，不阻塞主流程
// 铁律：A1 复活每关 1 次；单局插屏 ≤1；前 3 关不插屏；广告期间音效静音
type AdKind = 'rewarded' | 'interstitial' | 'banner';
type RewardedScene = 'revive' | 'double';

export interface AdTelemetry {
  ev: 'ad';
  kind: AdKind;
  scene: RewardedScene | 'interstitial';
  result: 'complete' | 'skip' | 'fail';
  level: number;
  t: number;
}

function isWx(): boolean {
  try {
    const g = globalThis as any;
    return typeof g.wx !== 'undefined' && !!g.wx;
  } catch { return false; }
}

export class AdSys {
  private ready: Record<AdKind, boolean> = { rewarded: false, interstitial: false, banner: false };
  private failCount: Record<AdKind, number> = { rewarded: 0, interstitial: 0, banner: 0 };
  private interstitialShown = 0; // 本会话插屏次数（单局/会话节奏）
  private muteHook: ((m: boolean) => void) | null = null;
  private telemHook: ((ev: AdTelemetry) => void) | null = null;
  private level = 1;

  /**  onLoad 调用：预加载激励视频；非微信环境打桩就绪 */
  init(): void {
    if (!isWx()) {
      this.ready = { rewarded: true, interstitial: true, banner: true };
      console.log('[Ad] init (stub, no wx)');
      return;
    }
    try {
      const g = globalThis as any;
      if (typeof g.wx.createRewardedVideoAd === 'function') {
        const ad = g.wx.createRewardedVideoAd({ adUnitId: 'adunit-rewarded' });
        ad.onClose?.((res: any) => { /* close 由 show 内 promise 处理 */ });
        ad.load?.().then(() => { this.ready.rewarded = true; }).catch(() => { this.failCount.rewarded++; });
      }
      if (typeof g.wx.createInterstitialAd === 'function') {
        this.ready.interstitial = true;
      }
      if (typeof g.wx.createBannerAd === 'function') {
        this.ready.banner = true;
      }
    } catch (e) {
      console.warn('[Ad] init failed', e);
    }
  }

  setLevel(n: number): void { this.level = n; }
  setMuteHook(fn: (m: boolean) => void): void { this.muteHook = fn; }
  setTelemetryHook(fn: (ev: AdTelemetry) => void): void { this.telemHook = fn; }

  isReady(kind: AdKind): boolean {
    if (this.failCount[kind] >= 2) return false; // 连续 2 次失败本会话禁用
    return this.ready[kind];
  }

  /** 激励视频：true=完整观看。桩：打日志并 resolve(true) */
  async showRewarded(scene: RewardedScene): Promise<boolean> {
    if (!this.isReady('rewarded')) {
      this.push('rewarded', scene, 'fail');
      return false;
    }
    this.muteHook?.(true);
    try {
      if (!isWx()) {
        console.log(`[Ad] rewarded:${scene} (stub) → complete`);
        this.push('rewarded', scene, 'complete');
        return true;
      }
      const g = globalThis as any;
      const ad = g.wx.createRewardedVideoAd({ adUnitId: 'adunit-rewarded' });
      const res: any = await ad.show();
      // 微信 onClose 在另一回调；此处按 show 成功粗判，完整观看细节真机再收
      const ok = !res || res.isEnded !== false;
      this.push('rewarded', scene, ok ? 'complete' : 'skip');
      return ok;
    } catch (e) {
      console.warn('[Ad] rewarded error', e);
      this.failCount.rewarded++;
      this.push('rewarded', scene, 'fail');
      return false;
    } finally {
      this.muteHook?.(false);
    }
  }

  /** 插屏：节流由调用方控制（前 3 关 + 每 3 关） */
  async showInterstitial(): Promise<void> {
    if (this.interstitialShown >= 1) return; // 单局会话 ≤1
    if (!this.isReady('interstitial')) {
      this.push('interstitial', 'interstitial', 'fail');
      return;
    }
    this.muteHook?.(true);
    try {
      if (!isWx()) {
        console.log('[Ad] interstitial (stub)');
        this.interstitialShown++;
        this.push('interstitial', 'interstitial', 'complete');
        return;
      }
      const g = globalThis as any;
      await g.wx.createInterstitialAd({ adUnitId: 'adunit-interstitial' })?.show?.();
      this.interstitialShown++;
      this.push('interstitial', 'interstitial', 'complete');
    } catch (e) {
      console.warn('[Ad] interstitial error', e);
      this.failCount.interstitial++;
      this.push('interstitial', 'interstitial', 'fail');
    } finally {
      this.muteHook?.(false);
    }
  }

  showBanner(): void {
    if (!this.isReady('banner')) return;
    console.log('[Ad] banner show');
    try {
      if (isWx()) {
        const g = globalThis as any;
        const ad = g.wx.createBannerAd({ adUnitId: 'adunit-banner', style: { left: 0, top: 0, width: 320 } });
        ad.show?.();
      }
    } catch { /* 静默 */ }
  }

  hideBanner(): void {
    try {
      if (isWx()) {
        const g = globalThis as any;
        // 真机实例缓存后续接；桩环境无操作
        void g;
      }
    } catch { /* 静默 */ }
  }

  private push(kind: AdKind, scene: RewardedScene | 'interstitial', result: AdTelemetry['result']): void {
    const ev: AdTelemetry = { ev: 'ad', kind, scene, result, level: this.level, t: Date.now() };
    this.telemHook?.(ev);
  }
}

/** 进场插屏节流：前 3 关不弹；通关 L3/L6/…（即将进 L4/L7）各 1 次 */
export function shouldInterstitialAfterWin(level: number): boolean {
  return level >= 3 && level % 3 === 0;
}

export const adSys = new AdSys();
