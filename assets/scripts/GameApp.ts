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
import { cfgForLevel, itemsFor } from './LevelCurve';
import { createProgress, ProgressStore } from './Progression';
import { cycleTheme, currentTheme } from './Theme';
import { applyTheme } from './BoxFactory';
import { AudioMgr } from './AudioMgr';
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
  private audio: AudioMgr | null = null;

  private state: State = 'ready';
  private levelNum = 1;
  private attempt = 1;
  private curSeed = 1;
  private bricks = 0;
  private speed = 0;
  private shoeT = 0; // v4 加速鞋剩余时间（秒），<=0 未加速
  private targetX = 0;
  private fallVel = 0;
  private dragging = false;
  private dragLastX = 0;
  private heldLeft = false;
  private heldRight = false;
  private elapsed = 0;
  private runT0 = 0;
  private speedDip = 0; // 铺桥瞬间轻微减速（J4 手感）

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

    // 音效可选：场景里有 AudioMgr 且素材已放即响，否则静默跳过
    this.audio = this.node.scene.getComponentInChildren(AudioMgr);

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
    this.curSeed = cur.seed;
    this.cfg = cur.cfg;
    // v4 道具：itemsFor 分带（L1-2 无道具），关闭时输出与 v3 逐字节一致
    this.levelDef = genLevelV3(cur.seed, this.cfg, { items: itemsFor(cur.level) ?? undefined });
    console.log(
      `[ShortcutRun] 第 ${this.levelNum} 关 (attempt ${this.attempt}) 断崖=${this.levelDef.gaps.length} ` +
      `拾取=${this.levelDef.pickups.length} 终点z=${this.levelDef.gateZ.toFixed(1)} 门需求=${this.cfg.gateCost}`
    );

    this.track.build(this.levelDef, this.cfg, cur.seed);
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
    this.shoeT = 0;
    this.targetX = 0;
    this.fallVel = 0;
    this.heldLeft = false;
    this.heldRight = false;
    this.dragging = false;
    this.ui?.setBricks(0);
    this.ui?.setLevel(cur.level);
    this.ui?.hideResult();
    const best = this.prog.state().best[cur.level];
    const bestTxt = best ? `${best.stars}★ ${best.time}s` : '暂无';
    this.ui?.showHint(`第 ${cur.level} 关 · 点击开始（终点需 ${this.cfg.gateCost} 砖）`);
    console.log(`[ShortcutRun] 第 ${cur.level} 关本关最佳：${bestTxt}`);
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
    if (ev.keyCode === KeyCode.KEY_M && this.audio) {
      const m = this.audio.toggleMute();
      console.log(`[ShortcutRun] 音效 ${m ? '关' : '开'}`);
    }
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
      if (this.shoeT > 0) this.shoeT -= dt;
      if (this.speedDip > 0) this.speedDip -= dt;
      // 提速鞋：终速 ×1.35（可短暂超 maxSpeed，提速感优先；母本 botRun 同口径）
      // 铺桥瞬间减速 ×0.55（J4：给“落桥”一个可感知的停顿）
      this.speed = Math.min(this.cfg.maxSpeed, this.cfg.runSpeed + this.bricks * this.cfg.speedPerBrick)
        * (this.shoeT > 0 ? 1.35 : 1) * (this.speedDip > 0 ? 0.55 : 1);
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
      this.checkGates(prevZ, z);
      this.checkGate(z);
    }
    this.track.syncStack(this.bricks);
    this.track.syncRig(this.state, this.speed, this.elapsed);
    this.ui?.setProgress(z, this.levelDef.gateZ);
    // J1：速度因子喂相机（FOV 冲刺）
    const span = Math.max(0.1, this.cfg.maxSpeed - this.cfg.runSpeed);
    this.camFollow.speedFactor = Math.max(0, Math.min(1, (this.speed - this.cfg.runSpeed) / span));
  }

  // 拾取判定：本帧位移区间 [prevZ, z] 与拾取点区间相交即吃到（防高帧移动量穿透）
  private checkPickups(x: number, prevZ: number, z: number): void {
    for (const p of this.pickups) {
      if (p.taken) continue;
      const hitZ = z >= p.def.z - 0.7 && prevZ <= p.def.z + 0.7;
      if (hitZ && Math.abs(x - p.def.x) < 0.95) {
        this.track.takePickup(p);
        if (p.def.kind === 'shoe') {
          // v4 加速鞋：不产砖，speed ×1.35 持续 3.5s（母本 botRun 同口径）
          this.shoeT = 3.5;
        } else {
          this.bricks += this.cfg.brickCluster;
        }
        this.ui?.setBricks(this.bricks);
        this.audio?.play('pickup');
      }
    }
  }

  // v4 道具门：扫掠判定过门（不扣砖），+N 加砖 / ×N 乘砖（母本 botRun 同口径）
  private checkGates(prevZ: number, z: number): void {
    if (!this.levelDef.gates) return;
    for (const g of this.levelDef.gates) {
      if (g.used) continue;
      if (z >= g.z && prevZ < g.z) {
        g.used = true;
        if (g.type === 'add') this.bricks += g.v;
        else this.bricks *= g.v;
        this.ui?.setBricks(this.bricks);
        this.audio?.play('pickup');
        console.log(`[ShortcutRun] 道具门 ${g.type === 'add' ? '+' + g.v : '×' + g.v}，现有 ${this.bricks} 砖`);
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
          this.audio?.play('bridge');
          this.speedDip = 0.35;                 // J4：落桥停顿
          this.camFollow.addShake(0.22, 0.25);  // J1：落桥震屏
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
    this.camFollow.addShake(0.18, 0.2); // J1：掉落实感
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
    this.audio?.play('win');
    const timeSec = this.elapsed - this.runT0;
    this.pushTelemetry({
      level: this.levelNum, seed: this.curSeed, outcome: 'win',
      t: +timeSec.toFixed(2), bricksLeft: this.bricks,
      failZ: null, pickupsTotal: this.levelDef.pickups.length,
    });
    const r = this.prog.win(timeSec, this.bricks);
    const best = this.prog.state().best[this.levelNum];
    this.ui?.setResult(true, r.stars, timeSec, this.bricks, `${best.stars}★ ${best.time}s`);
    this.ui?.showHint(`第 ${this.levelNum} 关通过！`);
    const p = this.player.position;
    tweenPos(this.player, 0.25, new Vec3(p.x, p.y + 0.7, p.z), () => {
      tweenPos(this.player, 0.25, new Vec3(p.x, p.y, p.z));
    });
    console.log(`[ShortcutRun] WIN 第 ${this.levelNum} 关 ${timeSec.toFixed(1)}s 余砖 ${this.bricks} ${r.stars}星！（进度已存档）`);
    this.scheduleOnce(() => this.startLevel(), 2.5);
  }

  private lose(reason = '失败'): void {
    if (this.state === 'lose') return;
    this.state = 'lose';
    this.pushTelemetry({
      level: this.levelNum, seed: this.curSeed, outcome: 'lose',
      t: +(this.elapsed - this.runT0).toFixed(2), bricksLeft: this.bricks,
      failZ: +this.player.position.z.toFixed(1), pickupsTotal: this.levelDef.pickups.length,
    });
    this.prog.lose();
    this.audio?.play('lose');
    const best = this.prog.state().best[this.levelNum];
    this.ui?.setResult(false, 0, 0, 0, best ? `${best.stars}★ ${best.time}s` : '暂无');
    this.ui?.showHint(reason);
    console.log(`[ShortcutRun] LOSE: ${reason}. 2.5 秒后换图重试第 ${this.levelNum} 关`);
    this.scheduleOnce(() => this.startLevel(), 2.5);
  }

  // G1 遥测（Q6 schema：docs/qoder/g1-tuning.md），与浏览器版 sr_telemetry_v1 键名对齐
  private pushTelemetry(ev: Record<string, unknown>): void {
    try {
      const raw = sys.localStorage.getItem('sr_telemetry_v1');
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return;
      arr.push({ ...ev, ts: Date.now() });
      if (arr.length > 500) arr.splice(0, arr.length - 500); // 封顶防无限膨胀
      sys.localStorage.setItem('sr_telemetry_v1', JSON.stringify(arr));
    } catch (e) { /* 遥测失败不影响游戏 */ }
  }
}
