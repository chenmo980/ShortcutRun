// 场景搭建器：用同一个灰盒实例化出跑道/断崖/砖块/终点门/玩家
// 零装配模式：不指定 boxPrefab 时用 BoxFactory 程序化造盒（默认）
// 换皮模式：指定 boxPrefab 后改用 prefab，几何逻辑一行不用改
const { ccclass, property } = _decorator;
import { _decorator, Component, Node, Prefab, Vec3, instantiate } from 'cc';
import type { Cfg } from './config';
import type { LevelDef, GapDef, PickupDef } from './LevelGen';
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
      const s = this.cfg.brickUnit;
      const node = this.box('brick', new Vec3(s, s, s), new Vec3(def.x, s / 2 + 0.05, def.z), this.node);
      return { node, def, taken: false };
    });
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
    const player = new Node('Player');
    player.parent = this.node;
    this.box('player', new Vec3(0.7, 1.5, 0.7), new Vec3(0, 0.75, 0), player).name = 'Body';

    // 身后拖的砖块堆：携带量的可视化，最多显示 12 块
    for (let i = 0; i < 12; i++) {
      const s = cfg.brickUnit * 0.85;
      const brick = this.box('brick', new Vec3(s, s, s), new Vec3(0, s / 2, -0.6 - i * s * 1.15), player);
      brick.active = false;
      this.stackNodes.push(brick);
    }
    return player;
  }

  syncStack(count: number): void {
    const shown = clamp(Math.round(count), 0, this.stackNodes.length);
    for (let i = 0; i < this.stackNodes.length; i++) {
      this.stackNodes[i].active = i < shown;
    }
  }
}
