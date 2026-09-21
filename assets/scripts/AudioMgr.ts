// 音效管理器（骨架）：素材未就位时静默跳过，文件放进即生效
// 素材放置约定：assets/resources/audio/{pickup,bridge,win,lose}.mp3（详见 docs/audio-assets.md）
const { ccclass } = _decorator;
import { _decorator, Component, resources, AudioClip, AudioSource } from 'cc';

export type SfxName = 'pickup' | 'bridge' | 'win' | 'lose';

@ccclass('AudioMgr')
export class AudioMgr extends Component {
  private src: AudioSource | null = null;
  private cache = new Map<string, AudioClip>();
  muted = false;

  onLoad(): void {
    this.src = this.getComponent(AudioSource) ?? this.addComponent(AudioSource);
  }

  play(name: SfxName, volumeScale = 1): void {
    if (this.muted) return;
    const cached = this.cache.get(name);
    if (cached) {
      this.src?.playOneShot(cached, volumeScale);
      return;
    }
    resources.load(`audio/${name}`, AudioClip, (err, clip) => {
      if (err || !clip) return; // 素材未就位：静默跳过（不刷错误）
      this.cache.set(name, clip);
      this.src?.playOneShot(clip, volumeScale);
    });
  }
}
