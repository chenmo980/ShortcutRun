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

  @property({ type: Label, tooltip: '关卡徽章：第 N 关（可选）' })
  levelLabel: Label | null = null;

  @property({ type: Label, tooltip: '结算行：星级/用时/最佳（可选，放屏幕中下）' })
  resultLabel: Label | null = null;

  setBricks(n: number): void {
    if (this.brickLabel) this.brickLabel.string = `砖块 ${n}`;
  }

  setProgress(z: number, gateZ: number): void {
    if (!this.progressLabel) return;
    const pct = Math.max(0, Math.min(100, (z / gateZ) * 100));
    this.progressLabel.string = `进度 ${pct.toFixed(0)}%`;
  }

  setLevel(level: number): void {
    if (this.levelLabel) this.levelLabel.string = `第 ${level} 关`;
  }

  // 结算信息（胜/负）：win=true 时 stars 1-3
  setResult(win: boolean, stars: number, timeSec: number, bricksLeft: number, best: string): void {
    if (!this.resultLabel) return;
    if (win) {
      const s = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      this.resultLabel.string = `${s}  用时 ${timeSec.toFixed(1)}s · 余砖 ${bricksLeft}\n本关最佳 ${best}`;
    } else {
      this.resultLabel.string = `挑战失败\n本关最佳 ${best}`;
    }
    this.resultLabel.node.active = true;
  }

  hideResult(): void {
    if (this.resultLabel) this.resultLabel.node.active = false;
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
