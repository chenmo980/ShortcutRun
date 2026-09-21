// 第三人称跟随相机：Shortcut Run 的"假 3D"感主要来自它
const { ccclass } = _decorator;
import { _decorator, Component, Node, Vec3 } from 'cc';

@ccclass('CameraFollow')
export class CameraFollow extends Component {
  target: Node | null = null;
  offsetY = 5.2;
  offsetZ = -7.5;
  xFactor = 0.6;   // 横向不完全跟随，保留跑道视野
  lerp = 6;
  private inited = false;

  lateUpdate(dt: number): void {
    if (!this.target) return;
    const t = this.target.worldPosition;
    const dx = t.x * this.xFactor;
    const dy = Math.max(t.y, 0) * 0.35 + this.offsetY;
    const dz = t.z + this.offsetZ;

    if (!this.inited) {
      this.node.setWorldPosition(new Vec3(dx, dy, dz));
      this.inited = true;
    } else {
      const k = 1 - Math.exp(-this.lerp * dt);
      const p = this.node.worldPosition;
      this.node.setWorldPosition(new Vec3(
        p.x + (dx - p.x) * k,
        p.y + (dy - p.y) * k,
        p.z + (dz - p.z) * k,
      ));
    }
    this.node.lookAt(new Vec3(t.x, t.y + 0.8, t.z));
  }
}
