// 游戏主控：状态机 + 输入 + 核心规则 + 关卡循环
// 规则：自动前进 → 吃砖块 → 到断崖砖够就自动铺桥、砖不够就掉下去 → 终点门验砖
// 关卡循环：胜利 → 下一关（新地图）；失败 → 本关重试（新地图同难度）；原地重建，不重载场景
// 挂法：打开 assets/scenes/game.scene，按 ▶ 即玩（零装配）
const { ccclass, property } = _decorator;
import {
  _decorator, Component, Node, Prefab, Vec3, Camera, input, Input,
  EventTouch, EventKeyboard, KeyCode, sys,
} from 'cc';
import { CFG, Cfg } from './config';
import { genLevelV3, LevelDef } from './LevelGen';
import { cfgForLevel } from './LevelCurve';
import { createProgress, ProgressStore } from './Progression';
import { cycleTheme, currentTheme } from './Theme';
import { applyTheme } from './BoxFactory';
import { TrackBuilder, RuntimePickup } from './TrackBuilder';
import { CameraFollow } from './CameraFollow';
import { GameUI } from './GameUI';
import { tweenPos, clamp } from './util';

type State = 'ready' | 'run' | 'fall' | 'win' | 'lose';

@ccclass('GameApp')
export class GameApp extends Component {
  @property({ type: Prefab, tooltip: '可选：拖入 prefab 则用 prefab 渲染（换皮用）；不拖则用内置程序化灰盒（零装配）' })
  boxPrefab: Prefab | null = null;

  @property({ tooltip: '关卡种子基数：实际种子 = 关卡号×1000 + 尝试次数' })
  seed = 1;

  @property({ tooltip: '已废弃：关卡参数由 LevelCurve + Progression 母本驱动（保留字段仅为兼容旧场景）' })
  useCurve = true;

  // 以下三项仅 useCurve=false 时生效（手动调参用）
  @property runSpeed = CFG.runSpeed;
  @property levelLength = CFG.levelLength;
  @property gateCost = CFG.gateCost;

  private cfg!: Cfg;
  private levelDef!: LevelDef;
  private track!: TrackBuilder;
  private player!: Node;
  private camFollow!: CameraFollow;
  private pickups: RuntimePickup[] = [];
  private ui: GameUI | null = null;
  private prog!: ReturnType<typeof createProgress>;

  private state: State = 'ready';
  private levelNum = 1;
  private attempt = 1;
  private bricks = 0;
  private speed = 0;
  private targetX = 0;
  private fallVel = 0;
  private dragging = false;
  private dragLastX = 0;
  private heldLeft = false;
  private heldRight = false;
  private elapsed = 0;
  private runT0 = 0;

  onLoad(): void {
    if (!this.boxPrefab) {
      console.log('[ShortcutRun] 未指定 prefab，使用内置程序化灰盒（零装配模式）');
    }

    const trackNode = new Node('Track');
    trackNode.parent = this.node;
    this.track = trackNode.addComponent(TrackBuilder)!;
    this.track.boxPrefab = this.boxPrefab;

    const camNode = this.findOrCreateCamera();
    this.camFollow = camNode.addComponent(CameraFollow)!;

    // HUD 可选：场景里有挂了 GameUI 的 Canvas 就接上，否则只打日志
    const canvasNode = this.node.scene.getChildByName('Canvas');
    this.ui = canvasNode ? canvasNode.getComponent(GameUI) : null;

    // 关卡推进（母本 progression.mjs，跨重启存活，脏数据自愈）
    const store: ProgressStore = {
      getItem: (k) => sys.localStorage.getItem(k),
      setItem: (k, v) => sys.localStorage.setItem(k, v),
    };
    this.prog = createProgress(store);

    this.bindInput();
    this.startLevel();
  }

  // 开局/重开：生成关卡、搭场景、复位状态（原地重建，不重载场景）
  private startLevel(): void {
    const cur = this.prog.current((lv) => cfgForLevel(lv, CFG));
    this.levelNum = cur.level;
    this.attempt = Math.floor(cur.seed % 1000);
    this.cfg = cur.cfg;
    this.levelDef = genLevelV3(cur.seed, this.cfg);
    console.log(
      `[ShortcutRun] 第 ${this.levelNum} 关 (attempt ${this.attempt}) 断崖=${this.levelDef.gaps.length} ` +
      `拾取=${this.levelDef.pickups.length} 终点z=${this.levelDef.gateZ.toFixed(1)} 门需求=${this.cfg.gateCost}`
    );

    this.track.build(this.levelDef, this.cfg);
    this.pickups = this.track.pickups;
    this.player = this.track.buildPlayer(this.cfg);
    this.player.setPosition(new Vec3(0, 0, 0));
    this.player.eulerAngles = new Vec3(0, 0, 0);
    this.camFollow.target = this.player;
    this.camFollow.offsetY = this.cfg.camOffsetY;
    this.camFollow.offsetZ = this.cfg.camOffsetZ;
    this.camFollow.xFactor = this.cfg.camXFactor;
    this.camFollow.lerp = this.cfg.camLerp;

    this.state = 'ready';
    this.bricks = 0;
    this.speed = this.cfg.runSpeed;
    this.targetX = 0;
    this.fallVel = 0;
    this.heldLeft = false;
    this.heldRight = false;
    this.dragging = false;
    this.ui?.setBricks(0);
    const best = this.prog.state().best[cur.level];
    const bestTxt = best ? `（最佳 ${best.stars}★ ${best.time}s）` : '';
    this.ui?.showHint(`第 ${cur.level} 关 · 点击开始（终点需 ${this.cfg.gateCost} 砖）${bestTxt}`);
  }

  private findOrCreateCamera(): Node {
    let cam = this.node.scene.getChildByName('Main Camera');
    if (!cam) {
      cam = new Node('Main Camera');
      cam.parent = this.node.scene;
      cam.addComponent(Camera);
    }
    return cam;
  }

  // ---------------- 输入 ----------------
  // 注意：Cocos 在 PC 预览时会把鼠标映射为触摸事件，所以只绑 TOUCH_*。
  // 同时绑 MOUSE_* 会让桌面预览转向灵敏度翻倍（Qoder 评审发现，2026-09-21 已修）。

  private bindInput(): void {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_PRESSING, this.onKeyPressing, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  // 场景重载时旧实例不会自动解绑全局 input 监听，必须手动 off
  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_PRESSING, this.onKeyPressing, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  private onTouchStart(ev: EventTouch): void {
    if (this.dragging) return; // 多指时忽略后续手指，防视角跳变
    this.startRun();
    this.dragging = true;
    this.dragLastX = ev.getUILocation().x;
  }

  private onTouchMove(ev: EventTouch): void {
    this.applyDrag(ev.getUILocation().x);
  }

  private applyDrag(x: number): void {
    if (!this.dragging) return;
    const dx = x - this.dragLastX;
    this.dragLastX = x;
    this.targetX += dx * this.cfg.steerPerPixel;
    this.clampTarget();
  }

  private onTouchEnd(): void {
    this.dragging = false;
  }

  private onKeyDown(ev: EventKeyboard): void {
    this.startRun();
    this.applyKeyHold(ev.keyCode, true);
  }

  private onKeyPressing(ev: EventKeyboard): void {
    this.startRun();
    this.applyKeyHold(ev.keyCode, true);
    if (ev.keyCode === KeyCode.KEY_T) this.toggleTheme();
  }

  private onKeyUp(ev: EventKeyboard): void {
    this.applyKeyHold(ev.keyCode, false);
  }

  private applyKeyHold(code: number, down: boolean): void {
    if (code === KeyCode.KEY_A || code === KeyCode.ARROW_LEFT) this.heldLeft = down;
    if (code === KeyCode.KEY_D || code === KeyCode.ARROW_RIGHT) this.heldRight = down;
  }

  // T 键换肤：切主题 + 清材质缓存 + 重建当前关卡（种子不变，同图换色）
  private toggleTheme(): void {
    cycleTheme();
    applyTheme();
    console.log(`[ShortcutRun] 切换主题：${currentTheme().name}`);
    this.startLevel();
  }

  private clampTarget(): void {
    const m = this.cfg.trackHalfWidth - 0.45;
    this.targetX = clamp(this.targetX, -m, m);
  }

  // ---------------- 主循环 ----------------

  update(dt: number): void {
    this.elapsed += dt;
    if (this.state === 'ready' || this.state === 'win' || this.state === 'lose') {
      this.track.syncRig(this.state, 0, this.elapsed);
      return;
    }

    if (this.heldLeft) this.targetX -= this.cfg.keySteerSpeed * dt;
    if (this.heldRight) this.targetX += this.cfg.keySteerSpeed * dt;
    this.clampTarget();

    const p = this.player.position;
    const prevZ = p.z; // 扫掠检测用：低端机帧抖动时一帧可能移动数米，必须按区间判定
    let x = p.x, y = p.y, z = p.z;

    if (this.state === 'run') {
      this.speed = Math.min(this.cfg.maxSpeed, this.cfg.runSpeed + this.bricks * this.cfg.speedPerBrick);
      z += this.speed * dt;
      const k = 1 - Math.exp(-this.cfg.steerSpeed * dt);
      x += (this.targetX - x) * k;
      y = 0;
    } else if (this.state === 'fall') {
      this.fallVel += 22 * dt;
      y -= this.fallVel * dt;
      if (y < -8) { this.lose('掉落！'); return; }
    }

    this.player.setPosition(new Vec3(x, y, z)); // rig 根节点在脚底
    const tilt = clamp((this.targetX - x) * 0.25, -0.35, 0.35);
    this.player.eulerAngles = new Vec3(this.state === 'fall' ? -0.9 : 0.04, 0, -tilt);

    if (this.state === 'run') {
      this.checkPickups(x, prevZ, z);
      this.checkGaps(prevZ, z);
      this.checkGate(z);
    }
    this.track.syncStack(this.bricks);
    this.track.syncRig(this.state, this.speed, this.elapsed);
  }

  // 拾取判定：本帧位移区间 [prevZ, z] 与拾取点区间相交即吃到（防高帧移动量穿透）
  private checkPickups(x: number, prevZ: number, z: number): void {
    for (const p of this.pickups) {
      if (p.taken) continue;
      const hitZ = z >= p.def.z - 0.7 && prevZ <= p.def.z + 0.7;
      if (hitZ && Math.abs(x - p.def.x) < 0.95) {
        this.track.takePickup(p);
        this.bricks += this.cfg.brickCluster;
        this.ui?.setBricks(this.bricks);
      }
    }
  }

  // 断崖判定：本帧是否进入断崖区（扫掠，防穿透）。砖够拍桥，砖不够掉落
  private checkGaps(prevZ: number, z: number): void {
    for (const g of this.levelDef.gaps) {
      if (g.bridged) continue;
      if (z >= g.zStart && prevZ < g.zEnd + 0.5) {
        if (this.bricks >= g.cost) {
          this.bricks -= g.cost;
          g.bridged = true;
          this.track.bridge(g);
          this.ui?.setBricks(this.bricks);
          console.log(`[ShortcutRun] 铺桥 -${g.cost} 砖，剩余 ${this.bricks}`);
        } else {
          this.enterFall();
        }
        return;
      }
    }
  }

  private enterFall(): void {
    console.log('[ShortcutRun] 砖不够，掉落！');
    this.ui?.showHint('掉落！');
    this.state = 'fall';
    this.fallVel = 1;
  }

  private checkGate(z: number): void {
    if (z >= this.levelDef.gateZ - 0.5) {
      if (this.bricks >= this.cfg.gateCost) this.win();
      else this.lose(`终点砖不够 ${this.bricks}/${this.cfg.gateCost}`);
    }
  }

  // ---------------- 状态切换 ----------------

  private startRun(): void {
    if (this.state === 'ready') {
      this.state = 'run';
      this.runT0 = this.elapsed;
      this.ui?.hideHint();
      console.log('[ShortcutRun] GO!');
    }
  }

  private win(): void {
    this.state = 'win';
    this.track.openGate();
    const timeSec = this.elapsed - this.runT0;
    const r = this.prog.win(timeSec, this.bricks);
    this.ui?.showHint(`第 ${this.levelNum} 关通过！${'★'.repeat(r.stars)}`);
    const p = this.player.position;
    tweenPos(this.player, 0.25, new Vec3(p.x, p.y + 0.7, p.z), () => {
      tweenPos(this.player, 0.25, new Vec3(p.x, p.y, p.z));
    });
    console.log(`[ShortcutRun] WIN 第 ${this.levelNum} 关 ${timeSec.toFixed(1)}s 余砖 ${this.bricks} ${r.stars}星！1.6 秒后进入第 ${r.nextLevel} 关`);
    this.scheduleOnce(() => this.startLevel(), 1.6);
  }

  private lose(reason = '失败'): void {
    if (this.state === 'lose') return;
    this.state = 'lose';
    this.prog.lose();
    this.ui?.showHint(`${reason} · 重试`);
    console.log(`[ShortcutRun] LOSE: ${reason}. 1.6 秒后重试第 ${this.levelNum} 关`);
    this.scheduleOnce(() => this.startLevel(), 1.6);
  }
}
