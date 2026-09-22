// 第三人称跟随相机：Shortcut Run 的"假 3D"感主要来自它
// J1/J4 爽感：速度 FOV 冲刺 + 铺桥/掉落震屏
const { ccclass } = _decorator;
import { _decorator, Component, Node, Vec3, Camera } from 'cc';

@ccclass('CameraFollow')
export class CameraFollow extends Component {
  target: Node | null = null;
  offsetY = 6.8;
  offsetZ = -8.8;
  xFactor = 0.6;   // 横向不完全跟随，保留跑道视野
  lerp = 6;
  speedFactor = 0; // 0~1，由 GameApp 每帧喂入（速度占比），驱动 FOV 冲刺
  pathAnchorX = 0; // 弯道中心线在相机锚点 z 处的世界 X（GameApp 每帧喂入）
  lateral = 0;     // 玩家逻辑横坐标（非世界 x），相机部分跟随
  private cam: Camera | null = null;
  private baseFov = 45;
  private shakeT = 0;
  private shakeMag = 0;

  onLoad(): void {
    this.cam = this.node.getComponent(Camera);
    if (this.cam) this.baseFov = this.cam.fov;
  }

  // 换关时调用：重新 snap 到目标身后
  reset(): void {
    this._inited = false;
  }

  addShake(mag: number, dur: number): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  lateUpdate(dt: number): void {
    if (!this.target) return;
    const t = this.target.worldPosition;
    // 相机锚在路径后方（offsetZ 为负=身后）：路径中心线 + 逻辑侧向×xFactor
    // 禁止把世界 t.x 再乘 xFactor（会把 bendX 打折/叠加，弯道上镜头乱甩）
    const dz = t.z + this.offsetZ;
    const dx = this.pathAnchorX + this.lateral * this.xFactor;
    const dy = Math.max(t.y, 0) * 0.35 + this.offsetY;

    if (!this._inited) {
      this.node.setWorldPosition(new Vec3(dx, dy, dz));
      this._inited = true;
    } else {
      const k = 1 - Math.exp(-this.lerp * dt);
      const p = this.node.worldPosition;
      this.node.setWorldPosition(new Vec3(
        p.x + (dx - p.x) * k,
        p.y + (dy - p.y) * k,
        p.z + (dz - p.z) * k,
      ));
    }

    // 震屏（衰减随机偏移）
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeT / 0.25);
      const p = this.node.worldPosition;
      this.node.setWorldPosition(new Vec3(
        p.x + (Math.random() - 0.5) * m,
        p.y + (Math.random() - 0.5) * m,
        p.z,
      ));
    }
    this.node.lookAt(new Vec3(t.x, t.y + 1.05, t.z)); // 略高于胸，俯视追尾

    // FOV 冲刺：基础 45 → +8（速度感）
    if (this.cam) {
      const targetFov = this.baseFov + this.speedFactor * 8;
      if (Math.abs(this.cam.fov - targetFov) > 0.15) {
        this.cam.fov += (targetFov - this.cam.fov) * Math.min(1, 4 * dt);
      }
    }
  }

  private _inited = false;
}
