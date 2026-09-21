// HUD：砖块计数 + 中央提示。挂在 Canvas 节点上，Label 在编辑器里拖引用。
// 不挂也能跑——GameApp 会自动降级为只看控制台日志。
const { ccclass, property } = _decorator;
import { _decorator, Component, Label } from 'cc';

@ccclass('GameUI')
export class GameUI extends Component {
  @property({ type: Label, tooltip: '砖块计数（屏幕上方）' })
  brickLabel: Label | null = null;

  @property({ type: Label, tooltip: '中央提示：开始 / 胜利 / 失败' })
  hintLabel: Label | null = null;

  @property({ type: Label, tooltip: '关卡进度百分比（可选）' })
  progressLabel: Label | null = null;

  setBricks(n: number): void {
    if (this.brickLabel) this.brickLabel.string = `砖块 ${n}`;
  }

  setProgress(z: number, gateZ: number): void {
    if (!this.progressLabel) return;
    const pct = Math.max(0, Math.min(100, (z / gateZ) * 100));
    this.progressLabel.string = `进度 ${pct.toFixed(0)}%`;
  }

  showHint(text: string): void {
    if (!this.hintLabel) return;
    this.hintLabel.string = text;
    this.hintLabel.node.active = true;
  }

  hideHint(): void {
    if (this.hintLabel) this.hintLabel.node.active = false;
  }
}
