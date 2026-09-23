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
import { genIslands, IslandDef } from './IslandGen';
import { curveFromCfg, bendX, headingAt, secant, CurveState } from './CurvePath';

const SMOKE_MAX = 60; // 铺路烟雾粒子池上限（与浏览器版一致）

interface SmokeState {
  life: number; dur: number;
  vx: number; vy: number; vz: number;
  s0: number;
}

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
  buildSeed = 1; // 本局种子（孤岛等派生内容用）

  private gateWalls: Node[] = [];
  private stackNodes: Node[] = [];
  private rig: CharRig | null = null;
  private plankPool: Node[] = [];  // 铺板轨迹池（自由铺板机制）
  private plankCursor = 0;
  private plankSeq = 0;            // 木板双色交替序号
  private plankTrail: Array<{ x: number; z: number }> = []; // 持久地面：铺了就是路
  private islandNodes: Array<{ def: IslandDef; plat: Node; pile: Node[]; taken: boolean }> = []; // 孤岛（原版机制）
  private smokePool: Node[] = [];      // 铺路烟雾粒子池（原版标志性反馈，与浏览器版同构）
  private smokeLive: (SmokeState | null)[] = [];
  private smokeCursor = 0;

  // 铺一块板（Pool：未满新增，满后循环复用最老的）；pos 为 level-space
  // 视觉（2026-09-23 用户反馈“板子像散架木片”后重做）：去抖动贴路径、加宽 1.8m、
  // 加厚 0.12m、略高于路面、双色交替出木桥节奏感
  spawnPlank(z: number, x: number): void {
    const c = this.curve;
    const h = headingAt(z, c);
    const px = bendX(z, c) + x * Math.cos(h); // 去抖动：严格贴路径
    const kind: BoxKind = this.plankSeq++ % 2 ? 'plankB' : 'plank';
    const len = (this.cfg.plankStride ?? 0.6);
    let node = this.plankPool[this.plankCursor];
    if (!node) {
      node = this.box(kind, new Vec3(1.8, 0.12, len), new Vec3(px, 0.06, z - 0.2), this.node);
      node.eulerAngles = new Vec3(0, h, 0);
      if (this.plankPool.length < (this.cfg.plankPoolMax ?? 500)) this.plankPool.push(node);
    } else {
      this.plankCursor = (this.plankCursor + 1) % (this.cfg.plankPoolMax ?? 500);
      // 复用：只改几何与位置，颜色沿用创建时的双色（池 500 覆盖全程，极少走到复用）
      node.setScale(new Vec3(1.8, 0.12, len));
      node.setPosition(new Vec3(px, 0.06, z - 0.2));
      node.eulerAngles = new Vec3(0, h, 0);
    }
    this.plankTrail.push({ x, z }); // 记入持久地面
  }

  // 是否站在自己铺过的板子上（容差覆盖整块板）
  onPlankTrail(x: number, z: number): boolean {
    for (const p of this.plankTrail) {
      if (Math.abs(x - p.x) < 1.1 && Math.abs(z - p.z) < 0.8) return true;
    }
    return false;
  }

  // ===== 铺路烟雾拖尾（原版标志性反馈：铺板时脚下冒烟+加速感，与浏览器版同构） =====
  // 轻量粒子池：白色小盒，出生扩散、上飘、下沉、扩散到顶点后缩没。池满循环复用最老的。
  spawnSmoke(x: number, y: number, z: number): void {
    const i = this.smokeCursor;
    const s0 = 0.14 + Math.random() * 0.12;
    let node = this.smokePool[i];
    if (!node) {
      node = spawnBox(this.node, 'smoke', s0, s0, s0, x, y + 0.05, z);
      this.smokePool.push(node);
    } else {
      node.setScale(new Vec3(s0, s0, s0));
      node.setPosition(new Vec3(x, y + 0.05, z));
      node.active = true;
    }
    this.smokeCursor = (this.smokeCursor + 1) % SMOKE_MAX;
    this.smokeLive[i] = {
      life: 0, dur: 0.45 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 1.2,
      s0,
    };
  }

  stepSmokes(dt: number): void {
    for (let i = 0; i < this.smokeLive.length; i++) {
      const st = this.smokeLive[i];
      if (!st) continue;
      const node = this.smokePool[i];
      st.life += dt;
      const k = st.life / st.dur;
      if (k >= 1 || !node) {
        this.smokeLive[i] = null;
        if (node) node.active = false;
        continue;
      }
      const p = node.position;
      node.setPosition(new Vec3(p.x + st.vx * dt, p.y + st.vy * dt, p.z + st.vz * dt));
      st.vy -= 0.4 * dt; // 微微下沉
      const s = st.s0 * (1 + k * 2.5) * (1 - k); // 先扩散到 2.5 倍，尾段缩没消隐
      node.setScale(new Vec3(s, s, s));
    }
  }

  isOnMainRoad(x: number, z: number): boolean {
    if (z >= this.level.gateZ - 0.5) return true;
    if (Math.abs(x - bendX(z, this.curve)) > this.cfg.trackHalfWidth) return false;
    for (const g of this.level.gaps) if (z >= g.zStart - 0.15 && z <= g.zEnd + 0.15) return false;
    return true;
  }

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
    this.buildSeed = seed;
    this.curve = curveFromCfg(cfg);
    this.node.removeAllChildren();
    this.gateWalls = [];
    this.stackNodes = [];
    this.plankPool = []; // 重建时清掉板子池（避免上一局轨迹残留）
    this.plankCursor = 0;
    this.plankTrail = []; // 持久地面也清空
    this.smokePool = []; // removeAllChildren 会销毁烟雾节点，池引用必须同步清
    this.smokeLive = [];
    this.smokeCursor = 0;
    // 地面（跑道下面的绿地，给纵深参照；世界空间居中，不随弯道）
    this.box('ground', new Vec3(60, 0.4, cfg.levelLength + 80), new Vec3(0, -0.6, level.length / 2 - 10), this.node);
    this.buildRoad();
    this.buildPickups();
    this.buildGate();
    this.buildItems();
    this.buildWarnings();
    this.buildProps(seed);
    this.buildIslands();
  }

  // 孤岛（原版经典机制）：主路外的悬浮板台，踩着板堆冒险捡板
  private buildIslands(): void {
    for (const isl of this.islandNodes) {
      isl.plat.removeFromParent();
      for (const m of isl.pile) m.removeFromParent();
    }
    this.islandNodes = [];
    for (const def of genIslands(this.buildSeed, this.cfg, this.level)) {
      const h = headingAt(def.z, this.curve);
      const px = bendX(def.z, this.curve) + def.x * Math.cos(h);
      const plat = this.box('plankB',
        new Vec3(def.radius * 2, 0.4, def.radius * 2),
        new Vec3(px, -0.15, def.z), this.node);
      plat.eulerAngles = new Vec3(0, h, 0);
      const pile: Node[] = [];
      for (let i = 0; i < 3; i++) {
        const m = this.box('brick', new Vec3(0.5, 0.22, 0.5),
          new Vec3(px + (i - 1) * 0.16, 0.25 + i * 0.24, def.z + (i % 2 === 0 ? 0.12 : -0.12)), this.node);
        pile.push(m);
      }
      this.islandNodes.push({ def, plat, pile, taken: false });
    }
  }

  // 踩上孤岛 → 板堆下沉消失，返回获得板数（0 = 没踩到）
  collectIsland(x: number, z: number): number {
    for (const isl of this.islandNodes) {
      if (isl.taken) continue;
      if (Math.abs(x - isl.def.x) < isl.def.radius + 0.3 && Math.abs(z - isl.def.z) < isl.def.radius + 0.5) {
        isl.taken = true;
        const gain = isl.def.planks;
        for (const m of isl.pile) tweenPos(m, 0.4, new Vec3(m.position.x, m.position.y - 3, m.position.z), () => m.destroy());
        tweenPos(isl.plat, 0.4, new Vec3(isl.plat.position.x, isl.plat.position.y - 3, isl.plat.position.z), () => isl.plat.destroy());
        return gain;
      }
    }
    return 0;
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
  syncRig(state: string, runCycle: number, steerVel: number, planks: number, dt: number, pickupPulse = 0): void {
    if (!this.rig) return;
    const s: CharState = state === 'stand' ? 'idle' : (state as CharState);
    animateCharacter(this.rig, runCycle, steerVel, planks, s, dt, pickupPulse);
  }

  syncStack(count: number): void {
    const shown = clamp(Math.round(count), 0, this.stackNodes.length);
    for (let i = 0; i < this.stackNodes.length; i++) {
      this.stackNodes[i].active = i < shown;
    }
  }
}
