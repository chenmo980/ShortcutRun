// 场景搭建器：用同一个灰盒实例化出跑道/断崖/砖块/终点门/玩家
// 零装配模式：不指定 boxPrefab 时用 BoxFactory 程序化造盒（默认）
// 换皮模式：指定 boxPrefab 后改用 prefab，几何逻辑一行不用改
// 弯道：所有关卡空间物件走 lbox()（bend 表现层变换）；LevelGen 数据不变
const { ccclass, property } = _decorator;
import { _decorator, Component, Node, Prefab, Vec3, instantiate } from 'cc';
import type { Cfg } from './config';
import type { LevelDef, GapDef, PickupDef, ItemGateDef } from './LevelGen';
import { tweenPos, tweenScale, clamp } from './util';
import { spawnBox, BoxKind } from './BoxFactory';
import { buildCharacter, animateCharacter, CharRig, CharState } from './CharacterRig';
import { curveFromCfg, bendX, headingAt, secant, CurveState } from './CurvePath';

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
  curve: CurveState = { amp: 0, freq: 0.12, phase: 0 };

  private gateWalls: Node[] = [];
  private stackNodes: Node[] = [];
  private rig: CharRig | null = null;

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

  // 弯道空间盒：pos 为 level-space (x,y,z)，位置/朝向随弯道；z 长度按斜率补偿
  private lbox(kind: BoxKind, scale: Vec3, pos: Vec3): Node {
    const h = headingAt(pos.z, this.curve);
    const n = this.box(
      kind,
      new Vec3(scale.x, scale.y, scale.z * secant(pos.z, this.curve)),
      new Vec3(bendX(pos.z, this.curve) + pos.x * Math.cos(h), pos.y, pos.z),
      this.node,
    );
    n.eulerAngles = new Vec3(0, h, 0);
    return n;
  }

  build(level: LevelDef, cfg: Cfg, seed = 1): void {
    this.level = level;
    this.cfg = cfg;
    this.curve = curveFromCfg(cfg);
    this.node.removeAllChildren();
    this.gateWalls = [];
    this.stackNodes = [];
    // 地面（跑道下面的绿地，给纵深参照；世界空间居中，不随弯道）
    this.box('ground', new Vec3(60, 0.4, cfg.levelLength + 80), new Vec3(0, -0.6, level.length / 2 - 10), this.node);
    this.buildRoad();
    this.buildPickups();
    this.buildGate();
    this.buildItems();
    this.buildWarnings();
    this.buildProps(seed);
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
    // 弯道：道路按 2m 块随弯道排布（直道时块间无缝）
    const CH = 2;
    for (let zz = z0; zz < z1 - 0.1; zz += CH) {
      const len = Math.min(CH, z1 - zz);
      this.lbox('road', new Vec3(w, 0.4, len), new Vec3(0, -0.2, zz + len / 2));
      for (const sx of [-1, 1]) {
        this.lbox('edge', new Vec3(0.12, 0.08, len - 0.2), new Vec3(sx * (w / 2 - 0.12), 0.02, zz + len / 2));
      }
    }
  }

  // 断崖警示条纹：提前告诉玩家“前面没路”（J2）
  private buildWarnings(): void {
    const w = this.cfg.trackHalfWidth * 2 + 0.6;
    for (const g of this.level.gaps) {
      for (let i = 0; i < 3; i++) {
        this.lbox(i % 2 === 0 ? 'warn1' : 'warn2',
          new Vec3(w - 0.4, 0.06, 0.4), new Vec3(0, 0.03, g.zStart - 1.3 + i * 0.42));
      }
    }
  }

  // 两侧建筑群（主题色，seed 确定，纯视觉纵深，J2）
  private buildProps(seed: number): void {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      // 确定性伪随机（与浏览器版同配方：索引推导，避免引入独立 RNG）
      const r1 = ((seed * 31 + i * 17) % 100) / 100;
      const r2 = ((seed * 47 + i * 29) % 100) / 100;
      const r3 = ((seed * 13 + i * 53) % 100) / 100;
      const z = 3 + (i / n) * (this.level.gateZ - 6);
      const h = 2.5 + r1 * 7;
      const bw = 1.5 + r2 * 2;
      this.lbox(r3 < 0.5 ? 'building1' : 'building2',
        new Vec3(bw, h, bw), new Vec3(side * (6.5 + r3 * 8), h / 2 - 0.5, z));
    }
  }

  private buildPickups(): void {
    this.pickups = this.level.pickups.map((def) => {
      // v4 加速鞋：两块小盒拼鞋形（鞋底 + 鞋帮），颜色随主题 shoe 键
      if (def.kind === 'shoe') {
        const g = new Node('Shoe');
        g.parent = this.node;
        const h = headingAt(def.z, this.curve);
        g.setPosition(new Vec3(bendX(def.z, this.curve) + def.x * Math.cos(h), 0.05, def.z));
        g.setRotationFromEuler(new Vec3(0, 34, 0));
        this.box('shoe', new Vec3(0.5, 0.14, 0.26), new Vec3(0, 0.07, 0), g);
        this.box('shoe', new Vec3(0.3, 0.2, 0.24), new Vec3(-0.08, 0.24, 0), g);
        return { node: g, def, taken: false };
      }
      const s = this.cfg.brickUnit;
      const node = this.lbox('brick', new Vec3(s, s, s), new Vec3(def.x, s / 2 + 0.05, def.z));
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
    this.lbox('pillar', new Vec3(0.4, 2.4, 0.4), new Vec3(-halfW, 1.2, g.z));
    this.lbox('pillar', new Vec3(0.4, 2.4, 0.4), new Vec3(halfW, 1.2, g.z));
    this.lbox(kind, new Vec3(halfW * 2 + 0.4, 0.7, 0.35), new Vec3(0, 2.55, g.z));
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
        this.lbox('gate', new Vec3(wallW, 1.4, 0.4), new Vec3(i * wallW, 0.7, this.level.gateZ))
      );
    }
    for (const sx of [-1, 1]) {
      this.lbox('pillar', new Vec3(0.5, 2.8, 0.5), new Vec3(sx * (halfW + 0.35), 1.4, this.level.gateZ));
    }
  }

  // 砖够 → 从天上把桥拍下来，这是本游戏最核心的正反馈动效
  bridge(g: GapDef): void {
    const w = this.cfg.trackHalfWidth * 2 + 0.6;
    const len = g.zEnd - g.zStart;
    const zc = (g.zStart + g.zEnd) / 2;
    const b = this.lbox('bridge', new Vec3(w, 0.4, len), new Vec3(0, 4, zc));
    tweenPos(b, 0.25, new Vec3(b.position.x, -0.2, zc));
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
    this.rig = buildCharacter(player);

    // 胸前手抱砖垛：携带量可视化（挂 plankMount，最多 12 块）
    for (let i = 0; i < 12; i++) {
      const s = cfg.brickUnit * 0.85;
      const brick = this.box('brick', new Vec3(s, s, s), new Vec3(0, 0.08 + i * s * 0.92, 0.04), this.rig.plankMount);
      brick.active = false;
      this.stackNodes.push(brick);
    }
    return player;
  }

  // 角色动画（AI Studio 母本移植，零动画资产）
  syncRig(state: string, runCycle: number, steerVel: number, planks: number, dt: number): void {
    if (!this.rig) return;
    const s: CharState = state === 'stand' ? 'idle' : (state as CharState);
    animateCharacter(this.rig, runCycle, steerVel, planks, s, dt);
  }

  syncStack(count: number): void {
    const shown = clamp(Math.round(count), 0, this.stackNodes.length);
    for (let i = 0; i < this.stackNodes.length; i++) {
      this.stackNodes[i].active = i < shown;
    }
  }
}
