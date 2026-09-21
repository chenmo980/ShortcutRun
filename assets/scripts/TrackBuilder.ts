// 场景搭建器：用同一个灰盒实例化出跑道/断崖/砖块/终点门/玩家
// 零装配模式：不指定 boxPrefab 时用 BoxFactory 程序化造盒（默认）
// 换皮模式：指定 boxPrefab 后改用 prefab，几何逻辑一行不用改
const { ccclass, property } = _decorator;
import { _decorator, Component, Node, Prefab, Vec3, instantiate } from 'cc';
import type { Cfg } from './config';
import type { LevelDef, GapDef, PickupDef, ItemGateDef } from './LevelGen';
import { tweenPos, tweenScale, clamp } from './util';
import { spawnBox, BoxKind } from './BoxFactory';

export interface RuntimePickup {
  node: Node;
  def: PickupDef;
  taken: boolean;
}

@ccclass('TrackBuilder')
export class TrackBuilder extends Component {
  @property({ type: Prefab, tooltip: '可选：指定 prefab 则用 prefab 渲染（换皮用）；不指定则用内置程序化灰盒（零装配）' })
  boxPrefab: Prefab | null = null;

  level!: LevelDef;
  cfg!: Cfg;
  pickups: RuntimePickup[] = [];

  private gateWalls: Node[] = [];
  private stackNodes: Node[] = [];
  // 程序化角色骨骼（与浏览器版 rig 一致）
  private rigBody: Node | null = null;
  private rigHead: Node | null = null;
  private rigArmL: Node | null = null;
  private rigArmR: Node | null = null;
  private rigLegL: Node | null = null;
  private rigLegR: Node | null = null;

  private box(kind: BoxKind, scale: Vec3, pos: Vec3, parent: Node): Node {
    if (this.boxPrefab) {
      const n = instantiate(this.boxPrefab);
      n.setScale(scale);
      n.setPosition(pos);
      n.parent = parent;
      return n;
    }
    return spawnBox(parent, kind, scale.x, scale.y, scale.z, pos.x, pos.y, pos.z);
  }

  build(level: LevelDef, cfg: Cfg): void {
    this.level = level;
    this.cfg = cfg;
    this.node.removeAllChildren();
    this.gateWalls = [];
    this.stackNodes = [];
    // 地面（跑道下面的绿地，给纵深参照）
    this.box('ground', new Vec3(60, 0.4, cfg.levelLength + 80), new Vec3(0, -0.6, level.length / 2 - 10), this.node);
    this.buildRoad();
    this.buildPickups();
    this.buildGate();
    this.buildItems();
  }

  private buildRoad(): void {
    const w = this.cfg.trackHalfWidth * 2 + 0.6;
    let z = 0;
    for (const g of this.level.gaps) {
      this.road(z, g.zStart, w);
      z = g.zEnd;
    }
    this.road(z, this.level.gateZ, w);
  }

  private road(z0: number, z1: number, w: number): void {
    const len = z1 - z0;
    if (len <= 0.1) return;
    this.box('road', new Vec3(w, 0.4, len), new Vec3(0, -0.2, (z0 + z1) / 2), this.node);
  }

  private buildPickups(): void {
    this.pickups = this.level.pickups.map((def) => {
      // v4 加速鞋：两块小盒拼鞋形（鞋底 + 鞋帮），颜色随主题 shoe 键
      if (def.kind === 'shoe') {
        const g = new Node('Shoe');
        g.parent = this.node;
        g.setPosition(new Vec3(def.x, 0.05, def.z));
        g.setRotationFromEuler(new Vec3(0, 34, 0));
        this.box('shoe', new Vec3(0.5, 0.14, 0.26), new Vec3(0, 0.07, 0), g);
        this.box('shoe', new Vec3(0.3, 0.2, 0.24), new Vec3(-0.08, 0.24, 0), g);
        return { node: g, def, taken: false };
      }
      const s = this.cfg.brickUnit;
      const node = this.box('brick', new Vec3(s, s, s), new Vec3(def.x, s / 2 + 0.05, def.z), this.node);
      return { node, def, taken: false };
    });
  }

  // v4 道具拱门：横跨跑道的横梁（+N 蓝 / ×2 红）+ 门柱。灰盒阶段用颜色编码门类型
  private buildItems(): void {
    if (!this.level.gates) return;
    const halfW = this.cfg.trackHalfWidth + 0.35;
    for (const g of this.level.gates) {
      this.buildItemGate(g, halfW);
    }
  }

  private buildItemGate(g: ItemGateDef, halfW: number): void {
    const kind: BoxKind = g.type === 'add' ? 'gateAdd' : 'gateMul';
    this.box('pillar', new Vec3(0.4, 2.4, 0.4), new Vec3(-halfW, 1.2, g.z), this.node);
    this.box('pillar', new Vec3(0.4, 2.4, 0.4), new Vec3(halfW, 1.2, g.z), this.node);
    this.box(kind, new Vec3(halfW * 2 + 0.4, 0.7, 0.35), new Vec3(0, 2.55, g.z), this.node);
  }

  takePickup(p: RuntimePickup): void {
    p.taken = true;
    tweenScale(p.node, 0.12, new Vec3(0.01, 0.01, 0.01), () => p.node.destroy());
  }

  private buildGate(): void {
    const halfW = this.cfg.trackHalfWidth;
    const wallW = (halfW * 2) / 3;
    for (let i = -1; i <= 1; i++) {
      this.gateWalls.push(
        this.box('gate', new Vec3(wallW, 1.4, 0.4), new Vec3(i * wallW, 0.7, this.level.gateZ), this.node)
      );
    }
    for (const sx of [-1, 1]) {
      this.box('pillar', new Vec3(0.5, 2.8, 0.5), new Vec3(sx * (halfW + 0.35), 1.4, this.level.gateZ), this.node);
    }
  }

  // 砖够 → 从天上把桥拍下来，这是本游戏最核心的正反馈动效
  bridge(g: GapDef): void {
    const w = this.cfg.trackHalfWidth * 2 + 0.6;
    const len = g.zEnd - g.zStart;
    const zc = (g.zStart + g.zEnd) / 2;
    const b = this.box('bridge', new Vec3(w, 0.4, len), new Vec3(0, 4, zc), this.node);
    tweenPos(b, 0.25, new Vec3(0, -0.2, zc));
  }

  openGate(): void {
    for (const w of this.gateWalls) {
      tweenPos(w, 0.4, new Vec3(w.position.x, -2.2, w.position.z));
    }
  }

  buildPlayer(cfg: Cfg): Node {
    // 幂等：原地重开时复用同一个 Player 节点（相机跟随目标不用换）
    let player = this.node.getChildByName('Player');
    if (player) {
      player.removeAllChildren();
    } else {
      player = new Node('Player');
      player.parent = this.node;
    }
    this.rigBody = this.box('player', new Vec3(0.55, 0.62, 0.35), new Vec3(0, 0.98, 0), player);
    this.rigBody.name = 'Body';
    this.rigHead = this.box('skin', new Vec3(0.42, 0.42, 0.42), new Vec3(0, 1.5, 0), player);
    this.rigHead.name = 'Head';

    // 四肢用“枢轴节点”实现：枢轴在肩/髋，肢体挂在枢轴下，转枢轴就是摆手/蹬腿
    this.rigArmL = new Node('ArmL'); this.rigArmL.parent = player; this.rigArmL.setPosition(new Vec3(-0.37, 1.22, 0));
    this.rigArmR = new Node('ArmR'); this.rigArmR.parent = player; this.rigArmR.setPosition(new Vec3(0.37, 1.22, 0));
    this.box('limb', new Vec3(0.16, 0.58, 0.16), new Vec3(0, -0.29, 0), this.rigArmL);
    this.box('limb', new Vec3(0.16, 0.58, 0.16), new Vec3(0, -0.29, 0), this.rigArmR);

    this.rigLegL = new Node('LegL'); this.rigLegL.parent = player; this.rigLegL.setPosition(new Vec3(-0.15, 0.68, 0));
    this.rigLegR = new Node('LegR'); this.rigLegR.parent = player; this.rigLegR.setPosition(new Vec3(0.15, 0.68, 0));
    this.box('limb', new Vec3(0.2, 0.68, 0.2), new Vec3(0, -0.34, 0), this.rigLegL);
    this.box('limb', new Vec3(0.2, 0.68, 0.2), new Vec3(0, -0.34, 0), this.rigLegR);

    // 身后拖的砖块堆：携带量的可视化，最多显示 12 块
    for (let i = 0; i < 12; i++) {
      const s = cfg.brickUnit * 0.85;
      const brick = this.box('brick', new Vec3(s, s, s), new Vec3(0, s / 2, -0.6 - i * s * 1.15), player);
      brick.active = false;
      this.stackNodes.push(brick);
    }
    return player;
  }

  // 程序化跑步/掉落/庆祝动画（与浏览器版 animateRig 一致，零动画资产）
  syncRig(state: string, speed: number, t: number): void {
    const setRx = (n: Node | null, rx: number) => { if (n) n.eulerAngles = new Vec3(rx, 0, 0); };
    if (state === 'run') {
      const freq = 5 + speed * 0.9;
      const sw = Math.sin(t * freq);
      setRx(this.rigLegL, sw * 0.75);
      setRx(this.rigLegR, -sw * 0.75);
      setRx(this.rigArmL, -sw * 0.55);
      setRx(this.rigArmR, sw * 0.55);
      const bob = Math.abs(Math.sin(t * freq)) * 0.05;
      if (this.rigBody) this.rigBody.setPosition(new Vec3(0, 0.98 + bob, 0));
      if (this.rigHead) this.rigHead.setPosition(new Vec3(0, 1.5 + bob, 0));
    } else if (state === 'fall') {
      const ft = t * 18;
      setRx(this.rigLegL, Math.sin(ft) * 1.1);
      setRx(this.rigLegR, Math.sin(ft + 2) * 1.1);
      setRx(this.rigArmL, -2.6 + Math.sin(ft * 1.3) * 0.4);
      setRx(this.rigArmR, -2.6 + Math.sin(ft * 1.1) * 0.4);
    } else if (state === 'win') {
      setRx(this.rigLegL, 0); setRx(this.rigLegR, 0);
      setRx(this.rigArmL, -2.9); setRx(this.rigArmR, -2.9);
    } else {
      const sw = Math.sin(t * 2.2) * 0.12;
      setRx(this.rigArmL, sw); setRx(this.rigArmR, sw);
      setRx(this.rigLegL, 0); setRx(this.rigLegR, 0);
      if (this.rigBody) this.rigBody.setPosition(new Vec3(0, 0.98, 0));
      if (this.rigHead) this.rigHead.setPosition(new Vec3(0, 1.5, 0));
    }
  }

  syncStack(count: number): void {
    const shown = clamp(Math.round(count), 0, this.stackNodes.length);
    for (let i = 0; i < this.stackNodes.length; i++) {
      this.stackNodes[i].active = i < shown;
    }
  }
}
