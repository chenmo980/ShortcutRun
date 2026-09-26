// core.ts — 刀1: 纯 Three.js 游戏运行时(零 React 零 JSX, DOM 仅 canvas/2D 两个注入点)
// GameCanvas 退化为薄壳: 负责 HUD/面板/对话框与事件订阅; 本文件负责场景/角色/仿真/渲染/输入/音频/遥测
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ColorPalette, VisualSettings } from '../types';
import { metricsStore } from '../utils/metricsStore';
import { sound } from '../utils/audio';
import {
  buildArticulatedCharacter,
  animateCharacter,
  ArticulatedCharacter,
} from '../components/characterBuilder';

// 悬浮基准1.35: 板底(高0.28)离甲板面0.8留~0.4m净空(原1.0时净空仅0.06m, 波谷穿面, 读感退化成路面色块);
// 拾取判定是纯XZ盒(1.3/1.4)不含Y, 抬高不碰手感
export const PICKUP_BASE_Y = 1.35;

// Precise track centerline at distance Z (meters)
export function getTrackCenterX(z: number): number {
  if (z <= 59) return 0;
  if (z < 75) {
    const t = (z - 59) / (75 - 59);
    return t * 14;
  }
  if (z <= 140) return 14;
  if (z < 160) {
    const t = (z - 140) / (160 - 140);
    return 14 + t * (-5 - 14); // 14 -> -5
  }
  if (z <= 220) return -5;
  if (z < 240) {
    const t = (z - 220) / (240 - 220);
    return -5 + t * 5; // -5 -> 0
  }
  return 0;
}

export function getTrackHeading(z: number): number {
  const d = 0.5;
  const x1 = getTrackCenterX(z - d);
  const x2 = getTrackCenterX(z + d);
  return Math.atan2(x2 - x1, 2 * d);
}

/**
 * 计算三维世界中任意 (x, z) 坐标处的地面与斜坡标高 (Ground Elevation)
 * - 基础栈道与直道表面高度: Y = 0.8
 * - 水面浮桥木板表面高度: Y = 0.56
 * - 冲刺终点倍率坡道/阶梯 (Z: 287 ~ 355):
 *   阶梯共 10 级，每级沿 Z 跨度 6 单位，台阶高度以 0.4 逐级抬升 (H: 0.8 -> 4.4)
 *   顶层领奖台高度: Y = 4.4
 */
export function getGroundHeight(x: number, z: number, isOverWater: boolean = false): number {
  if (isOverWater) {
    return 0.56; // 浮在水面上的木板表面标高
  }
  if (z < 287) {
    return 0.8; // 常规栈道路面高度
  }
  if (z >= 341) {
    return 4.4; // 终点最高倍率领奖台表面高度
  }
  // 终点冲刺阶梯与坡度段 (Z: 287 ~ 341)
  const stepIdx = Math.min(9, Math.max(0, Math.floor((z - 287) / 6)));
  return 0.8 + stepIdx * 0.4;
}

export const SECTION_SHORTCUTS = [
  { name: '起点直道', z: 0, tag: '0m' },
  { name: '龙骨右弯', z: 65, tag: '65m' },
  { name: '右侧海域直道', z: 110, tag: '110m' },
  { name: '碧波回转近道', z: 145, tag: '145m' },
  { name: '终前直道', z: 210, tag: '210m' },
  { name: '龙门冲刺阶梯', z: 285, tag: '285m' },
];

export type GameState = 'idle' | 'running' | 'bridging' | 'drowned' | 'finished';
export type CameraViewMode = 'chase' | 'front' | 'side';

// 壳层事件: 帧末合并 flush(去重), 壳只订阅不驱动仿真
export interface GameEvent {
  state?: GameState;
  planks?: number;
  score?: number;
  multiplier?: number;
  progress?: number; // 0~350 整数米
  paused?: boolean;
  finished?: boolean; // state==='finished' 的跳变沿(壳放 confetti)
  cameraView?: CameraViewMode;
  perf?: { fps: number; drawCalls: number; renderMs: number };
}

// 输入总线: web 由 window/pointer 监听写入, 小游戏由 wx.onTouch 同接口写入
export interface GameInput {
  left: boolean;
  right: boolean;
  dragging: boolean;
}

export interface CreateGameOptions {
  parent?: HTMLElement | null; // web 壳容器(传入则把 renderer.domElement 挂上去)
  canvas?: HTMLCanvasElement | null; // 小游戏壳直传 wx.createCanvas
  width?: number;
  height?: number;
  palette: ColorPalette;
  settings: VisualSettings;
  create2DCanvas?: (w: number, h: number) => HTMLCanvasElement; // node 端注入
  devicePixelRatio?: number;
}

export interface GameHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  resize(width: number, height: number): void;
  reset(targetZ?: number): void;
  setSettings(patch: Partial<VisualSettings>): void;
  setCameraView(mode: CameraViewMode): void;
  togglePaused(): void;
  onEvent(cb: (e: GameEvent) => void): () => void;
  input: GameInput;
  debug(): Record<string, unknown>;
}

export function createGame(options: CreateGameOptions): GameHandle {
  const { palette } = options;
  let liveSettings: VisualSettings = { ...options.settings };

  const make2D =
    options.create2DCanvas ??
    ((w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    });

  const width = options.width ?? options.parent?.clientWidth ?? 800;
  const height = options.height ?? options.parent?.clientHeight ?? 600;

  // Scene setup
  const scene = new THREE.Scene();
  // 天空: skyTop→skyBottom 垂直渐变; 地平线色=雾色, 与远处水面无缝衔接
  const skyCanvas = make2D(2, 256);
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, palette.skyTop);
  skyGrad.addColorStop(0.78, palette.skyBottom);
  skyGrad.addColorStop(1, palette.skyBottom);
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(skyCanvas);
  scene.fog = new THREE.FogExp2(palette.skyBottom, 0.007);

  // Camera setup
  // 竖屏适配: FOV锚定水平视野(16:9桌面下55°vFOV≈75°hFOV), 窄屏时反算vFOV保跑道±3.5m恒可见
  const FOV_ANCHOR_H = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(55 / 2)) * (16 / 9));
  const fovForAspect = (aspect: number) =>
    Math.min(75, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(FOV_ANCHOR_H / 2) / Math.max(0.3, aspect))));
  const camera = new THREE.PerspectiveCamera(fovForAspect(width / height), width / height, 0.1, 1000);
  camera.position.set(0, 8, -11);
  camera.lookAt(0, 1.5, 8);

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    canvas: options.canvas ?? undefined,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(options.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1), 2));
  renderer.shadowMap.enabled = liveSettings.planarShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 轮36 阴影图20Hz: 光轴随跑者平滑移动, 60fps逐帧重刷阴影pass(全castShadow再画一遍)无感知增益,
  // 改每3帧needsUpdate重烘一次; 首帧先烘, 避免开场1帧无影
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  if (options.parent && !options.canvas) {
    options.parent.innerHTML = '';
    options.parent.appendChild(renderer.domElement);
  }
  const canvasDom = renderer.domElement;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(15, 30, -10);
  dirLight.castShadow = liveSettings.planarShadows;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 150;
  const d = 30;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);
  // 阴影相机是平行光局部的固定视锥(±30m, 原点附近)——不跟随跑者则 30m 外
  // 全部出框, 拾取板/角色投影整程消失(截图实锤"贴纸感"), 故每帧随 playerZ 平移
  dirLight.target.position.set(0, 0, 0);
  scene.add(dirLight.target);

  // Materials dictionary
  // 轮10 赛道色带协调: 顶面不再直取 palette 原色——
  // 浅色系(l>0.85)降饱和+明度压到0.9一档, 根治"惨白跑道 vs 金色阶梯/彩侧沿"断层;
  // 深色系仅微降饱和不动明度(赛博/灰模不回归); 侧沿=顶面压暗后向 trackBorder 借 16% 色相,
  // 成为 顶面↔桥柱/边界 的中间过渡带, 全主题色带梯度: 顶面 → 侧沿(暖化) → 桥柱(主题色)
  const trackTopColor = new THREE.Color(palette.trackColor);
  {
    const hsl = { h: 0, s: 0, l: 0 };
    trackTopColor.getHSL(hsl, THREE.SRGBColorSpace);
    if (hsl.l > 0.85) {
      trackTopColor.setHSL(hsl.h, hsl.s * 0.55, 0.9, THREE.SRGBColorSpace);
    } else {
      trackTopColor.setHSL(hsl.h, hsl.s * 0.85, hsl.l, THREE.SRGBColorSpace);
    }
  }
  const trackSideColor = trackTopColor
    .clone()
    .multiplyScalar(0.72)
    .lerp(new THREE.Color(palette.trackBorder), 0.16);
  const materials = {
    water: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      flatShading: true,
      roughness: 0.1,
      metalness: 0.2,
    }),
    trackBottom: new THREE.MeshStandardMaterial({
      color: trackTopColor.clone().multiplyScalar(0.45),
      roughness: 0.7,
    }),
    trackBorder: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.trackBorder),
      roughness: 0.5,
    }),
    plank: new THREE.MeshStandardMaterial({
      vertexColors: true,
      color:
        liveSettings.plankStyle === 'bamboo_raft'
          ? new THREE.Color('#22C55E')
          : liveSettings.plankStyle === 'jade_slab'
          ? new THREE.Color('#10B981')
          : liveSettings.plankStyle === 'gold_bar'
          ? new THREE.Color('#F59E0B')
          : liveSettings.plankStyle === 'neon_crystal'
          ? new THREE.Color('#00F5D4')
          : new THREE.Color(palette.plankColor),
      roughness:
        liveSettings.plankStyle === 'jade_slab'
          ? 0.15
          : liveSettings.plankStyle === 'bamboo_raft'
          ? 0.28
          : liveSettings.plankStyle === 'neon_crystal'
          ? 0.1
          : 0.35,
      metalness:
        liveSettings.plankStyle === 'gold_bar'
          ? 0.85
          : liveSettings.plankStyle === 'jade_slab'
          ? 0.15
          : 0.0,
      emissive:
        liveSettings.plankStyle === 'neon_crystal'
          ? new THREE.Color('#00A896')
          : new THREE.Color(0x000000),
      emissiveIntensity: liveSettings.plankStyle === 'neon_crystal' ? 0.45 : 0.0,
    }),
    player: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.playerColor),
      roughness: 0.3,
    }),
    aiPlayer: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.accentColor),
      roughness: 0.3,
    }),
    finish: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.finishColor),
      roughness: 0.2,
    }),
    goldStep: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFD166'),
      metalness: 0.4,
      roughness: 0.2,
    }),
  };
  // 轮19 厚度感回退修复: 轮14/18 六面分材使每块板 6 draw calls(DC 275→558), 小游戏预算不可接受
  // → 改 BoxGeometry 顶点色(顶1.0/侧0.68/底0.42 乘材质色), 单材质单 DC, 观感等价
  const shadeBoxGeo = (geo: THREE.BoxGeometry, side = 0.68, bottom = 0.42, front = side) => {
    const c = new Float32Array(24 * 3);
    const put = (i0: number, v: number) => {
      for (let i = i0; i < i0 + 4; i++) {
        c[i * 3] = v;
        c[i * 3 + 1] = v;
        c[i * 3 + 2] = v;
      }
    };
    put(0, side); put(4, side); put(8, 1); put(12, bottom); put(16, front); put(20, front);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  };

  // 1. Water Plane (Large low-poly mesh with animated vertices)
  // 扩到 600x800: 远边缘推进 FogExp2 全雾区, 硬地平线消失
  const waterGeo = new THREE.PlaneGeometry(600, 800, 60, 80);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, materials.water);
  waterMesh.position.set(0, 0, 150);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  // Store original water vertex heights
  const waterPos = waterGeo.attributes.position;
  const initialWaterY = new Float32Array(waterPos.count);
  for (let i = 0; i < waterPos.count; i++) {
    initialWaterY[i] = waterPos.getY(i);
  }
  // 水面双层色: 波峰=waterShallow / 波谷=waterDeep, 逐帧随波浪写入顶点色
  const waterColAttr = new Float32Array(waterPos.count * 3);
  const wShal = new THREE.Color(palette.waterShallow);
  const wDeep = new THREE.Color(palette.waterDeep);
  for (let i = 0; i < waterPos.count; i++) {
    waterColAttr[i * 3] = wShal.r;
    waterColAttr[i * 3 + 1] = wShal.g;
    waterColAttr[i * 3 + 2] = wShal.b;
  }
  waterGeo.setAttribute('color', new THREE.BufferAttribute(waterColAttr, 3));

  // 2. Track Generation: An S-shaped floating boardwalk layout
  // Track bounds define walkable solid ground:
  // Section 1: Z: 0 to 60, X: -3.5 to 3.5 (Straight start)
  // Section 2: Z: 60 to 80, X: -3.5 to 16.5 (Turn Right)
  // Section 3: Z: 80 to 140, X: 11.5 to 18.5 (Right Straight) — 原版"必须铺板过海"还原：
  //   断开两个 6m 缺口（Z99-105 / Z116-122，避开 95/110/125 三处拾取堆），
  //   缺口处只剩水：断口内 isOverWater=true 自动接管落板/耗板/溺水逻辑（见下方 Bridge building）
  // Section 4: Z: 140 to 160, X: -8.5 to 18.5 (Turn Left Across)
  // Section 5: Z: 160 to 220, X: -8.5 to -1.5 (Left Straight) — 同上断开 1 个 6m 缺口（Z199-205）
  // Section 6: Z: 220 to 240, X: -8.5 to 3.5 (Turn Center)
  // Section 7: Z: 240 to 290, X: -3.5 to 3.5 (Straight to Finish)
  // Section 8: Z: 290 to 360, X: -2.5 to 2.5 (Multiplier Staircase)
  const trackBounds = [
    { minZ: -10, maxZ: 60, minX: -3.5, maxX: 3.5 },
    { minZ: 50, maxZ: 75, minX: -3.5, maxX: 16.5 },
    { minZ: 75, maxZ: 99, minX: 10.5, maxX: 17.5 },
    { minZ: 105, maxZ: 116, minX: 10.5, maxX: 17.5 },
    { minZ: 122, maxZ: 140, minX: 10.5, maxX: 17.5 },
    { minZ: 135, maxZ: 160, minX: -8.5, maxX: 17.5 },
    { minZ: 160, maxZ: 199, minX: -8.5, maxX: -1.5 },
    { minZ: 205, maxZ: 220, minX: -8.5, maxX: -1.5 },
    { minZ: 215, maxZ: 240, minX: -8.5, maxX: 3.5 },
    { minZ: 240, maxZ: 290, minX: -3.5, maxX: 3.5 },
    { minZ: 287, maxZ: 360, minX: -2.8, maxX: 2.8 },
  ];

  // 轮97b: 预计算可铺板水道=相邻甲板矩形间的Z断口, X实宽取两甲板重叠段。
  // 落板行按水道真实宽度铺满(原锚playerX±2.4, 拐弯操舵偏中心时整侧露海)
  const waterChannels: { minZ: number; maxZ: number; minX: number; maxX: number }[] = [];
  for (let i = 0; i < trackBounds.length - 1; i++) {
    const a = trackBounds[i];
    const b = trackBounds[i + 1];
    if (a.maxZ < b.minZ) {
      waterChannels.push({
        minZ: a.maxZ,
        maxZ: b.minZ,
        minX: Math.max(a.minX, b.minX),
        maxX: Math.min(a.maxX, b.maxX),
      });
    }
  }

  // 轮99: 用户三令"视觉看到的海面都要铺板"——赛道周边静态木栈台:
  // 距任甲板矩形AP_REACH内的水面按连续板阵铺满(单InstancedMesh恒1DC),
  // 动态铺板水道挖空保留"必须铺板过海"玩法。网格跨甲板缘连续(板心入矩形者保留藏进板体),
  // 任何网格相位下缘侧都无半格水带
  {
    const apGeo = shadeBoxGeo(new THREE.BoxGeometry(2.6, 0.18, 1.5));
    const AP_PITCH_X = 2.45;
    const AP_PITCH_Z = 1.5;
    const AP_REACH = 4.2;
    const AP_Y = 0.5;
    const apList: { x: number; z: number }[] = [];
    for (let cz = -16; cz <= 300; cz += AP_PITCH_Z) {
      for (let cx = -25; cx <= 35; cx += AP_PITCH_X) {
        let near = false;
        for (const r of trackBounds) {
          const dx = Math.max(r.minX - cx, 0, cx - r.maxX);
          const dz = Math.max(r.minZ - cz, 0, cz - r.maxZ);
          if (Math.hypot(dx, dz) < AP_REACH) {
            near = true;
            break;
          }
        }
        if (near) apList.push({ x: cx, z: cz });
      }
    }
    const apFinal = apList.filter(
      (c) =>
        !waterChannels.some(
          (ch) =>
            c.x >= ch.minX - 1.4 &&
            c.x <= ch.maxX + 1.4 &&
            c.z >= ch.minZ - 0.8 &&
            c.z <= ch.maxZ + 0.8
        )
    );
    // 轮100: 栈台不吃玩家板皮(bamboo_raft默认#22C55E把整片海面染成绿草坪, 用户"不要绿色的部分")
    // 环境木栈台恒用主题经典板色(木纹琥珀), 与手持/拾取资源色解耦
    const apronMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: new THREE.Color(palette.plankColor),
      roughness: 0.6,
    });
    const apronMesh = new THREE.InstancedMesh(apGeo, apronMat, apFinal.length);
    const apPos = new THREE.Vector3();
    const apQuat = new THREE.Quaternion();
    const apOne = new THREE.Vector3(1, 1, 1);
    const apM = new THREE.Matrix4();
    apFinal.forEach((c, i) => {
      apPos.set(c.x, AP_Y, c.z);
      apM.compose(apPos, apQuat, apOne);
      apronMesh.setMatrixAt(i, apM);
    });
    apronMesh.instanceMatrix.needsUpdate = true;
    apronMesh.receiveShadow = true;
    apronMesh.frustumCulled = false;
    scene.add(apronMesh);
  }

  const trackMeshes: THREE.Mesh[] = [];

  // 桥柱水线: 吃水线处的湿润深色带（比桥体底色更暗）+ 水面泡沫环
  // 轮30: 几何改为每段实例化后合并(见createTrackSegment内collector), 此处只留材质
  const waterlineMat = new THREE.MeshStandardMaterial({
    color: trackTopColor.clone().multiplyScalar(0.35),
    roughness: 0.85,
  });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const borderGeos: THREE.BufferGeometry[] = [];
  const ringGeos: THREE.BufferGeometry[] = [];
  const foamGeos: THREE.BufferGeometry[] = [];

  // Helper to build a track segment with raised edges/curbs
  // 轮31 甲板批处理: 原10段×六面分材=60材质组(阴影再60), 是桥段DC最大残块。
  // 轮13顶面每4m接缝/轮15侧壁每1.5m竖缝+顶沿高亮/轮27吃水泡沫带的画法不变,
  // 但把 repeat 瓦片烘进各面几何UV(scaleUV), 全赛道顶/侧/泡沫侧各共用1材 → 面片收集后整段合并。
  const deckTopGeos: THREE.BufferGeometry[] = [];
  const deckSideGeos: THREE.BufferGeometry[] = [];
  const deckSideFoamGeos: THREE.BufferGeometry[] = [];
  const deckBottomGeos: THREE.BufferGeometry[] = [];
  const scaleUV = (g: THREE.BufferGeometry, su: number, sv = 1) => {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return g;
  };
  const deckTexMat = (
    paint: (ctx: CanvasRenderingContext2D) => void,
    w: number,
    h: number,
    roughness: number
  ) => {
    const cv = make2D(w, h);
    paint(cv.getContext('2d')!);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // DoubleSide: 合并后甲板各面为独立平面(非闭合盒), 保证双向投影不丢桥影
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness, side: THREE.DoubleSide });
  };
  const deckTopMat = deckTexMat((ctx) => {
    // 轮43: 板纹走向纠正——木板沿赛道纵向铺(原32x128整格横差+斜视摩尔纹, 读作同心弧"马桶圈")
    const base = trackTopColor.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl, THREE.SRGBColorSpace);
    const shade = (dl: number, a = 1) =>
      new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + dl)), THREE.SRGBColorSpace);
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(0, 0, 32, 128);
    // 4条纵向板(每块~0.9m宽): 微差提亮/压暗 + 板缝暗线
    const boards = [0, 8, 16, 24];
    const deltas = [0.02, -0.015, 0.03, 0];
    boards.forEach((bx, i) => {
      ctx.fillStyle = shade(deltas[i]).getStyle();
      ctx.fillRect(bx, 0, 7, 128);
      ctx.fillStyle = base.clone().multiplyScalar(0.9).getStyle();
      ctx.fillRect(bx + 7, 0, 1, 128);
    });
    // 顺纹短条(每板2道, 打断纯色)
    ctx.fillStyle = base.clone().multiplyScalar(0.95).getStyle();
    boards.forEach((bx, i) => {
      ctx.fillRect(bx + 2, (i * 37) % 100, 1, 22);
      ctx.fillRect(bx + 5, (i * 53 + 19) % 100, 1, 16);
    });
    // 横向接缝: 每瓦片(=4m)一道压暗线
    ctx.fillStyle = base.clone().multiplyScalar(0.88).getStyle();
    ctx.fillRect(0, 125, 32, 3);
  }, 32, 128, 0.4);
  const buildSideMat = (foam: boolean) =>
    deckTexMat((ctx) => {
      ctx.fillStyle = trackSideColor.getStyle();
      ctx.fillRect(0, 0, 32, 16);
      const hsl = { h: 0, s: 0, l: 0 };
      trackSideColor.getHSL(hsl, THREE.SRGBColorSpace);
      ctx.fillStyle = new THREE.Color()
        .setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + 0.09), THREE.SRGBColorSpace)
        .getStyle();
      ctx.fillRect(0, 0, 32, 4);
      ctx.fillStyle = trackSideColor.clone().multiplyScalar(0.74).getStyle();
      ctx.fillRect(29, 4, 3, 12);
      if (foam) {
        const foamCol = trackSideColor.clone().lerp(new THREE.Color(0xffffff), 0.5).getStyle();
        const foamEdge = trackSideColor.clone().lerp(new THREE.Color(0xffffff), 0.82).getStyle();
        for (let px = 0; px < 32; px++) {
          const h = 5.5 + Math.sin((px / 32) * Math.PI * 4) * 1.5;
          ctx.fillStyle = foamCol;
          ctx.fillRect(px, 16 - h, 1, h);
          ctx.fillStyle = foamEdge;
          ctx.fillRect(px, 16 - h, 1, 1.5);
        }
      }
    }, 32, 16, 0.55);
  const deckSideMat = buildSideMat(false);
  const deckSideFoamMat = buildSideMat(true);
  const createTrackSegment = (x: number, z: number, w: number, l: number, overWater = false) => {
    const sideSink = overWater ? deckSideFoamGeos : deckSideGeos;
    const top = new THREE.PlaneGeometry(w, l);
    scaleUV(top, 1, l / 4);
    top.rotateX(-Math.PI / 2);
    top.translate(x, 0.8, z);
    deckTopGeos.push(top);
    const bottom = new THREE.PlaneGeometry(w, l);
    bottom.rotateX(Math.PI / 2);
    bottom.translate(x, 0, z);
    deckBottomGeos.push(bottom);
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(l, 0.8);
      scaleUV(g, l / 1.5);
      g.rotateY((s * Math.PI) / 2);
      g.translate(x + (s * w) / 2, 0.4, z);
      sideSink.push(g);
    }
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(w, 0.8);
      scaleUV(g, w / 1.5);
      if (s < 0) g.rotateY(Math.PI);
      g.translate(x, 0.4, z + (s * l) / 2);
      sideSink.push(g);
    }

    // 轮17/20 缘石围框 + 轮16 桥柱外移(甲板缘外0.35m)
    // 轮30 静态批处理: 原每段8小mesh×10段=80 draw call, 改收集平移后几何, 全段合并为3个静态mesh
    // (缘石+桥柱同材trackBorder并1; 吃水环并1; 泡沫环并1) 视觉零差异, 桥段DC约-110
    {
      const border = (g: THREE.BufferGeometry, px: number, py: number, pz: number) => {
        g.translate(px, py, pz);
        borderGeos.push(g);
      };
      border(new THREE.BoxGeometry(0.16, 0.16, l), x - w / 2 + 0.02, 0.88, z);
      border(new THREE.BoxGeometry(0.16, 0.16, l), x + w / 2 - 0.02, 0.88, z);
      border(new THREE.BoxGeometry(w, 0.16, 0.16), x, 0.88, z - l / 2 + 0.02);
      border(new THREE.BoxGeometry(w, 0.16, 0.16), x, 0.88, z + l / 2 - 0.02);
      const pillarY = -1;
      const px1 = x - w / 2 - 0.35;
      const px2 = x + w / 2 + 0.35;
      const pz1 = z - l / 3;
      const pz2 = z + l / 3;
      border(new THREE.CylinderGeometry(0.35, 0.35, 3.5, 6), px1, pillarY, pz1);
      border(new THREE.CylinderGeometry(0.35, 0.35, 3.5, 6), px2, pillarY, pz2);
      // 吃水深色环(轮5)与泡沫环(轮7/16): 原为桥柱子mesh局部y1.05/1.08, 世界y=柱心-1+局部
      const ring1 = new THREE.CylinderGeometry(0.46, 0.46, 0.6, 6);
      ring1.translate(px1, pillarY + 1.05, pz1);
      ringGeos.push(ring1);
      const ring2 = new THREE.CylinderGeometry(0.46, 0.46, 0.6, 6);
      ring2.translate(px2, pillarY + 1.05, pz2);
      ringGeos.push(ring2);
      const foam1 = new THREE.RingGeometry(0.45, 1.05, 14);
      foam1.rotateX(-Math.PI / 2);
      foam1.translate(px1, pillarY + 1.08, pz1);
      foamGeos.push(foam1);
      const foam2 = new THREE.RingGeometry(0.45, 1.05, 14);
      foam2.rotateX(-Math.PI / 2);
      foam2.translate(px2, pillarY + 1.08, pz2);
      foamGeos.push(foam2);
    }
  };

  createTrackSegment(0, 25, 7, 70); // Seg 1
  createTrackSegment(6.5, 62.5, 20, 7); // Seg 2
  // Seg 3（右侧海域直道）：拆 3 段，留 2 个 6m 海缺口（Z99-105 / Z116-122）——原版必须铺板过海
  createTrackSegment(14, 87, 7, 24, true);   // Seg 3a: Z75-99
  createTrackSegment(14, 110.5, 7, 11, true); // Seg 3b: Z105-116（缺口间小岛）
  createTrackSegment(14, 131, 7, 18, true);   // Seg 3c: Z122-140
  createTrackSegment(4.5, 147.5, 26, 7); // Seg 4
  // Seg 5（左侧直道）：拆 2 段，留 1 个 6m 海缺口（Z199-205）
  createTrackSegment(-5, 179.5, 7, 39, true);  // Seg 5a: Z160-199
  createTrackSegment(-5, 212.5, 7, 15, true);  // Seg 5b: Z205-220
  createTrackSegment(-2.5, 227.5, 12, 7); // Seg 6
  createTrackSegment(0, 265, 7, 50); // Seg 7

  // 轮30 静态批处理落网: 三段收集器合并为3个mesh(60个装饰mesh→3)
  {
    const borderMesh = new THREE.Mesh(mergeGeometries(borderGeos), materials.trackBorder);
    scene.add(borderMesh);
    const ringMesh = new THREE.Mesh(mergeGeometries(ringGeos), waterlineMat);
    scene.add(ringMesh);
    const foamMesh = new THREE.Mesh(mergeGeometries(foamGeos), foamMat);
    foamMesh.renderOrder = 2;
    scene.add(foamMesh);
    // 轮31 甲板主体落网: 10段盒×6材质组=60 draw → 顶/侧/泡沫侧/底 4个合并mesh(阴影pass同步 60→3)
    const deckTopMesh = new THREE.Mesh(mergeGeometries(deckTopGeos), deckTopMat);
    deckTopMesh.receiveShadow = true;
    deckTopMesh.castShadow = true;
    scene.add(deckTopMesh);
    const deckSideMesh = new THREE.Mesh(mergeGeometries(deckSideGeos), deckSideMat);
    deckSideMesh.receiveShadow = true;
    deckSideMesh.castShadow = true;
    scene.add(deckSideMesh);
    const deckFoamMesh = new THREE.Mesh(mergeGeometries(deckSideFoamGeos), deckSideFoamMat);
    deckFoamMesh.receiveShadow = true;
    deckFoamMesh.castShadow = true;
    scene.add(deckFoamMesh);
    const deckBottomMesh = new THREE.Mesh(mergeGeometries(deckBottomGeos), materials.trackBottom);
    scene.add(deckBottomMesh);
    trackMeshes.push(deckTopMesh, deckSideMesh, deckFoamMesh, deckBottomMesh);
  }

  // Multiplier finish stairway: 无缝阶梯坡道与胜利领奖台
  // 轮10: 金阶底色从"跑道顶面同系淡金"逐级渐变到纯金#FFD166——
  // 最下一级贴近跑道色(过渡带), 逐级加金, 顶面→阶梯色带连续无断层(全主题通用)
  // 轮25: 阶梯顶点色分面(侧0.88/底0.5/立面0.72)——甲板有围框接缝语言后, 整块同色阶梯显平
  // 轮30: 逐级色×分面灰度烘进同一color属性, 9级渐变阶合并1 mesh(白底stairMat);
  // 领奖台PBR不同(finish无metalness)保持独立, 但不再需要materials.finish克隆——
  // 注意: materials.finish 仍被龙门 archMat 取色共用, 本体不许动
  const stepCount = 10;
  const goldColor = new THREE.Color('#FFD166');
  const stairMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.4,
    roughness: 0.2,
  });
  const tintShadedGeo = (
    geo: THREE.BoxGeometry,
    col: THREE.Color,
    side = 0.88,
    front = 0.72,
    bottom = 0.5
  ) => {
    shadeBoxGeo(geo, side, bottom, front);
    const cAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    for (let v = 0; v < cAttr.count; v++) {
      cAttr.setXYZ(v, col.r * cAttr.getX(v), col.g * cAttr.getY(v), col.b * cAttr.getZ(v));
    }
    return geo;
  };
  const stepGeos: THREE.BoxGeometry[] = [];
  let podiumGeo: THREE.BoxGeometry | undefined;
  for (let i = 0; i < stepCount; i++) {
    const stepZ = 290 + i * 6;
    const stepH = 0.8 + i * 0.4;
    const isTop = i === stepCount - 1;
    const stepLength = isTop ? 14 : 6.05;
    const stepColor = isTop
      ? new THREE.Color((materials.finish as THREE.MeshStandardMaterial).color)
      : trackTopColor.clone().lerp(goldColor, 0.2 + 0.8 * (i / (stepCount - 2)));
    const geo = tintShadedGeo(new THREE.BoxGeometry(5.2, stepH, stepLength), stepColor);
    geo.translate(0, stepH / 2, isTop ? stepZ + 3.5 : stepZ);
    if (isTop) podiumGeo = geo;
    else stepGeos.push(geo);
  }
  const stairMesh = new THREE.Mesh(mergeGeometries(stepGeos), stairMat);
  stairMesh.castShadow = true;
  stairMesh.receiveShadow = true;
  scene.add(stairMesh);
  // 领奖台沿用finish的PBR(无metalness), 色已烘顶点
  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.2,
  });
  const podiumMesh = new THREE.Mesh(podiumGeo, podiumMat);
  podiumMesh.castShadow = true;
  podiumMesh.receiveShadow = true;
  scene.add(podiumMesh);

  // 轮54: 台阶立面倍率数字(x1.5→x6, 与结算公式 1+stepsClimbed*0.5 同口径)——
  // 原阶梯素面无读数, 玩家不知道"多爬一级=结算倍率+0.5"; 10格图集+10面片合并1 mesh(1 DC)
  {
    const multCanvas = make2D(2048, 128);
    const mctx = multCanvas.getContext('2d')!;
    mctx.font = 'bold 92px "Arial Black", sans-serif';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    const multLabels = ['×1.5', '×2', '×2.5', '×3', '×3.5', '×4', '×4.5', '×5', '×5.5', '×6'];
    multLabels.forEach((lb, i) => {
      const cx = (i + 0.5) * (2048 / 10); // 格204.8×128≈1.6:1, 与面片3.6×1.8同比例免拉扁
      mctx.lineWidth = 14;
      mctx.strokeStyle = 'rgba(74,40,4,0.9)';
      mctx.strokeText(lb, cx, 70);
      mctx.fillStyle = '#FFF3C4';
      mctx.fillText(lb, cx, 70);
    });
    const multTex = new THREE.CanvasTexture(multCanvas);
    multTex.colorSpace = THREE.SRGBColorSpace;
    multTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const multMat = new THREE.MeshBasicMaterial({ map: multTex, transparent: true });
    const labelGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 10; i++) {
      const isTop = i === 9;
      const stepH = 0.8 + i * 0.4;
      const lz = isTop ? 345 : 290 + i * 6;
      // 朝 -z 面 (追拍来向): 屏右=世界-x, u须随x递减取镜像格; v按flipY实测校准(r54b/c两版对照)
      const lg = new THREE.PlaneGeometry(3.6, 1.8);
      const uv = lg.getAttribute('uv') as THREE.BufferAttribute;
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (i + 1 - uv.getX(v)) / 10, 1 - uv.getY(v));
      lg.rotateX(-Math.PI / 2);
      lg.translate(0, stepH + 0.02, lz);
      labelGeos.push(lg);
      // 朝 +z 面 (r73侧颜帧实锤: 正前/3/4侧颜从台阶上方回看只剩镜像字): 原始u+flipY, 法线+z
      const lg2 = new THREE.PlaneGeometry(3.6, 1.8);
      const uv2 = lg2.getAttribute('uv') as THREE.BufferAttribute;
      for (let v = 0; v < uv2.count; v++) uv2.setX(v, (i + uv2.getX(v)) / 10);
      lg2.rotateX(Math.PI / 2);
      lg2.translate(0, stepH + 0.02, lz);
      labelGeos.push(lg2);
    }
    const multMesh = new THREE.Mesh(mergeGeometries(labelGeos), multMat);
    scene.add(multMesh);
  }

  // Finish Arch at Z: 288
  const archMat = materials.finish;
  // 龙门: 糖果条纹柱+顶梁+白横幅(原为三块同色板, 远景识别度差)
  // 轮26: 柱带/顶梁顶点色分面(与轮25阶梯同法)
  // 轮30: 金带×4+顶梁并1网、白带×4并1网(9 mesh→2), 色烘顶点, archMat本体仍只供取色
  {
    const finishColor = (archMat as THREE.MeshStandardMaterial).color;
    const goldBandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.2,
    });
    const whiteBandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.5,
    });
    const bands = 4;
    const bandH = 6 / bands;
    const goldGeos: THREE.BoxGeometry[] = [];
    const whiteGeos: THREE.BoxGeometry[] = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let b = 0; b < bands; b++) {
        const geos = b % 2 === 0 ? goldGeos : whiteGeos;
        const col = b % 2 === 0 ? finishColor : new THREE.Color(0xffffff);
        const g = tintShadedGeo(
          new THREE.BoxGeometry(0.85, bandH, 0.85),
          col,
          0.82,
          0.95
        );
        g.translate(side * 3.5, bandH / 2 + b * bandH, 288);
        geos.push(g);
      }
    }
    const beam = new THREE.BoxGeometry(8, 1.4, 1);
    tintShadedGeo(beam, finishColor, 0.82, 0.95);
    beam.translate(0, 6.7, 288);
    goldGeos.push(beam);
    const archGoldMesh = new THREE.Mesh(mergeGeometries(goldGeos), goldBandMat);
    archGoldMesh.castShadow = true;
    scene.add(archGoldMesh);
    const archWhiteMesh = new THREE.Mesh(mergeGeometries(whiteGeos), whiteBandMat);
    archWhiteMesh.castShadow = true;
    scene.add(archWhiteMesh);
    // 横幅: 空白牌改为"终点 FINISH"文字贴图(挂迎面nz侧, 跑者视角可读)
    const bannerCanvas = make2D(512, 72);
    const bCtx = bannerCanvas.getContext('2d')!;
    bCtx.fillStyle = '#ffffff';
    bCtx.fillRect(0, 0, 512, 72);
    const archHex = '#' + (archMat as THREE.MeshStandardMaterial).color.getHexString();
    bCtx.fillStyle = archHex;
    bCtx.font = 'bold 46px "Microsoft YaHei", sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText('终点 FINISH', 256, 38);
    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    const bannerFace = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.5 });
    const bannerPlain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    // 轮33: 横幅原六面材质数组=6 draw, 改单材盒体+文字面片挂nz侧(u轴映射与原盒nz面一致, 不镜像)
    const bannerBody = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 0.2), bannerPlain);
    bannerBody.position.set(0, 6.7, 287.39);
    scene.add(bannerBody);
    const bannerFaceMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.9), bannerFace);
    bannerFaceMesh.rotation.y = Math.PI;
    bannerFaceMesh.position.set(0, 6.7, 287.39 - 0.101);
    scene.add(bannerFaceMesh);
  }

  // 3. Scatter collectible wooden planks along the track
  // 轮37: 42块拾取板合并为单 InstancedMesh（原逐件mesh=可见集内每板1 DC；
  // 实例包围球只按几何体算不含逐实例偏移，须关视锥剔除）
  type PickupItem = {
    mesh: THREE.InstancedMesh;
    idx: number;
    collected: boolean;
    z: number;
    x: number;
    y: number;
    phase: number;
  };
  const pickupItems: PickupItem[] = [];
  // 轮19: 拾取板/手持堆/桥板三种几何共享+顶点色分面(原轮14/18六面材质数组每板6 DC)
  const plankGeo = shadeBoxGeo(new THREE.BoxGeometry(2.4, 0.28, 0.85));
  const stackPlankGeo = shadeBoxGeo(new THREE.BoxGeometry(1.45, 0.15, 0.55));
  const bPlankGeo = shadeBoxGeo(new THREE.BoxGeometry(2.6, 0.22, 1.4));

  const plankSpawns: { z: number; x: number; phase: number }[] = [];
  const spawnPlankCluster = (centerZ: number, centerX: number, count: number = 3) => {
    for (let i = 0; i < count; i++) {
      const offsetZ = (i - (count - 1) / 2) * 1.6;
      // 确定性斜向扇形排布(原随机±1.1常致两板同位叠死, 远景糊成一块绿斑读不出"3块可拾")
      const offsetX = (i - (count - 1) / 2) * 0.8;
      const pz = centerZ + offsetZ;
      const px = centerX + offsetX;
      plankSpawns.push({ z: pz, x: px, phase: (pz * 0.9 + px * 2.3) % (Math.PI * 2) });
    }
  };

  // Scatter on track segments
  [15, 30, 45, 80, 95, 110, 125, 165, 180, 195, 210, 245, 255, 270].forEach((z) => {
    let trackX = 0;
    if (z >= 75 && z <= 135) trackX = 14;
    else if (z >= 160 && z <= 215) trackX = -5;
    spawnPlankCluster(z, trackX, 3);
  });

  const pickupMesh = new THREE.InstancedMesh(plankGeo, materials.plank, plankSpawns.length);
  pickupMesh.castShadow = true;
  pickupMesh.frustumCulled = false;
  pickupMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(pickupMesh);
  const pickupEuler = new THREE.Euler(0, 0, 0);
  const pickupQuat = new THREE.Quaternion();
  const pickupScale = new THREE.Vector3(1, 1, 1);
  const pickupPos = new THREE.Vector3();
  const pickupMat = new THREE.Matrix4();
  // 写实例矩阵：collected → 零尺度（隐藏）；否则挂起 y、可选摆角 yaw
  const writePickupInstance = (
    item: PickupItem,
    y: number,
    yaw: number,
    collected: boolean
  ) => {
    if (collected) {
      pickupMat.makeScale(0, 0, 0);
    } else {
      pickupPos.set(item.x, y, item.z);
      pickupEuler.y = yaw;
      pickupQuat.setFromEuler(pickupEuler);
      pickupMat.compose(pickupPos, pickupQuat, pickupScale);
    }
    pickupMesh.setMatrixAt(item.idx, pickupMat);
  };
  plankSpawns.forEach((s, idx) => {
    const item: PickupItem = {
      mesh: pickupMesh,
      idx,
      collected: false,
      z: s.z,
      x: s.x,
      y: PICKUP_BASE_Y,
      phase: s.phase,
    };
    pickupItems.push(item);
    writePickupInstance(item, PICKUP_BASE_Y, 0, false);
  });
  pickupMesh.instanceMatrix.needsUpdate = true;

  // 轮97: 桥板单实例化网格——拐弯缺口全宽3列×每圈~40步若逐mesh将+~120 DC,
  // InstancedMesh 恒 1 DC(同轮37拾板方案)。容量溢出时裁最旧行(远在镜头身后)
  const BRIDGE_MAX = 224;
  const bridgePlanks: {
    idx: number;
    x: number;
    z: number;
    y: number;
    velY: number;
    phase: number;
    tilt: number;
  }[] = [];
  const bridgeMesh = new THREE.InstancedMesh(bPlankGeo, materials.plank, BRIDGE_MAX);
  bridgeMesh.castShadow = true;
  bridgeMesh.receiveShadow = true;
  bridgeMesh.frustumCulled = false;
  bridgeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bridgeMesh.count = 0;
  scene.add(bridgeMesh);
  const bridgeEuler = new THREE.Euler(0, 0, 0);
  const bridgeQuat = new THREE.Quaternion();
  const bridgePos = new THREE.Vector3();
  const bridgeScaleOne = new THREE.Vector3(1, 1, 1);
  const bridgeMat4 = new THREE.Matrix4();
  const writeBridgeInstance = (i: number) => {
    const bp = bridgePlanks[i];
    bridgePos.set(bp.x, bp.y, bp.z);
    bridgeEuler.z = bp.tilt;
    bridgeQuat.setFromEuler(bridgeEuler);
    bridgeMat4.compose(bridgePos, bridgeQuat, bridgeScaleOne);
    bridgeMesh.setMatrixAt(i, bridgeMat4);
  };
  const rebuildBridgeInstances = () => {
    bridgeMesh.count = bridgePlanks.length;
    for (let i = 0; i < bridgePlanks.length; i++) writeBridgeInstance(i);
    bridgeMesh.instanceMatrix.needsUpdate = true;
  };
  const compactBridgeIfNeeded = (incoming = 3) => {
    if (bridgePlanks.length + incoming <= BRIDGE_MAX) return;
    bridgePlanks.splice(0, Math.min(12, bridgePlanks.length));
    bridgePlanks.forEach((p, i) => {
      p.idx = i;
    });
    rebuildBridgeInstances();
  };

  // 4. Build Player Character (Lively articulated low-poly runner)
  const playerChar = buildArticulatedCharacter(liveSettings.characterType || 'runner_boy', palette, false);
  playerChar.root.position.set(0, 0.85, 0);
  scene.add(playerChar.root);

  // 5. Optional AI Competitor Runner (Only created if enabled, default is single player)
  let aiChar: ArticulatedCharacter | null = null;
  if (liveSettings.showOpponent) {
    aiChar = buildArticulatedCharacter(
      liveSettings.characterType === 'chibi_ninja' ? 'runner_boy' : 'chibi_ninja',
      palette,
      true
    );
    aiChar.root.position.set(2.2, 0.85, 0);
    scene.add(aiChar.root);
  }

  // ---- 事件总线: 帧末合并 flush, 壳只订阅 ----
  type Listener = (e: GameEvent) => void;
  const listeners = new Set<Listener>();
  let pendingEvent: GameEvent = {};
  let prevState: GameState = 'idle';
  const emit = (patch: GameEvent) => {
    pendingEvent = { ...pendingEvent, ...patch };
  };

  // ---- 游戏状态(原 gameRef) ----
  const g: {
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    playerChar: ArticulatedCharacter | null;
    aiChar: ArticulatedCharacter | null;
    waterMesh: THREE.Mesh | null;
    trackMeshes: THREE.Mesh[];
    pickupItems: PickupItem[];
    bridgePlanks: {
      idx: number;
      x: number;
      z: number;
      y: number;
      velY: number;
      phase: number;
      tilt: number;
    }[];
    bridgeMesh: THREE.InstancedMesh | null;
    rebuildBridgeInstances?: () => void;
    particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[];
    speed: number;
    playerX: number;
    playerY: number;
    playerZ: number;
    aiY: number;
    playerVelX: number;
    targetPlayerX: number;
    steerOffset: number;
    steerVelocityX: number;
    isPaused: boolean;
    isOverWater: boolean;
    carriedPlanks: number;
    state: GameState;
    lastBridgeDropZ: number;
    runCycle: number;
    pickupPulse: number;
    stepTimer: number;
    cameraViewMode: CameraViewMode;
    materials: { [key: string]: THREE.Material };
    trackBounds: { minZ: number; maxZ: number; minX: number; maxX: number }[];
    score: number;
    finalMultiplier: number;
    manualOverride: boolean;
    updatePlankStackVisual?: (count: number) => void;
  } = {
    renderer,
    scene,
    camera,
    playerChar,
    aiChar,
    waterMesh,
    trackMeshes,
    pickupItems,
    bridgePlanks,
    bridgeMesh,
    rebuildBridgeInstances,
    particles: [],
    speed: 16,
    playerX: 0,
    playerY: 0.85,
    playerZ: 0,
    aiY: 0.85,
    playerVelX: 0,
    targetPlayerX: 0,
    steerOffset: 0,
    steerVelocityX: 0,
    isPaused: false,
    isOverWater: false,
    carriedPlanks: 12,
    state: 'running',
    lastBridgeDropZ: 0,
    runCycle: 0,
    pickupPulse: 0,
    stepTimer: 0,
    cameraViewMode: 'chase',
    materials,
    trackBounds,
    score: 0,
    finalMultiplier: 1,
    manualOverride: false,
  };

  // Update stack visual helper (Held proudly in front of runner, supported by arms)
  // 轮32: 手持堆8板→1个合并mesh(按displayCount缓存几何, 计数变化只换geometry引用)。
  // 拾板高频触发本函数, 原每次重建8 mesh(渲染+阴影16 DC), 现稳态 2 DC。
  const stackGeoByCount = new Map<number, THREE.BufferGeometry>();
  let stackMesh: THREE.Mesh | null = null;
  const updatePlankStackVisual = (count: number) => {
    // 视觉封顶 8 块：再多只加高绿塔遮脸（真实数量看 HUD 木板计数）；交错叠放模拟手托柴捆
    const displayCount = Math.min(count, 8);
    if (displayCount <= 0) {
      if (stackMesh) {
        playerChar.plankMount.remove(stackMesh);
        stackMesh = null;
      }
      return;
    }
    let geo = stackGeoByCount.get(displayCount);
    if (!geo) {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < displayCount; i++) {
        const part = stackPlankGeo.clone();
        part.rotateY(i % 2 === 0 ? 0.04 : -0.04);
        // 轮42: 层距0.155→0.10(板厚0.15本就互叠)+绕托点真居中——8层塔高1.24→0.80m,
        // 跨胸线(1.06~1.86 vs 下巴2.12)不遮脸, 堆形也不再高瘦
        part.translate(
          (i % 2 === 0 ? 0.05 : -0.05),
          i * 0.10 - (displayCount - 1) * 0.10 * 0.5,
          (i % 3 === 1 ? 0.04 : 0)
        );
        parts.push(part);
      }
      geo = mergeGeometries(parts);
      stackGeoByCount.set(displayCount, geo);
    }
    if (!stackMesh) {
      stackMesh = new THREE.Mesh(geo, materials.plank);
      stackMesh.castShadow = true;
      playerChar.plankMount.add(stackMesh);
    } else if (stackMesh.geometry !== geo) {
      stackMesh.geometry = geo;
    }
  };
  g.updatePlankStackVisual = updatePlankStackVisual;
  updatePlankStackVisual(12);

  // Reset or jump to specific section
  const resetGame = (targetZ: number = 0) => {
    if (!g.playerChar) return;

    const startX = getTrackCenterX(targetZ);
    const startY = getGroundHeight(startX, targetZ, false) + 0.05;
    g.playerX = startX;
    g.playerY = startY;
    g.playerZ = targetZ;
    g.targetPlayerX = startX;
    g.steerOffset = 0;
    g.steerVelocityX = 0;
    g.manualOverride = false;
    g.carriedPlanks = liveSettings.infinitePlanks ? 30 : 16;
    g.state = 'running';
    // 轮48: 暂停中点"从头跑"/秒传会留下 isPaused=true 的僵尸局(整场frozen, 面板却显示奔跑中)——重开隐含恢复
    g.isPaused = false;
    g.lastBridgeDropZ = targetZ;
    g.isOverWater = false;
    g.runCycle = 0;
    if (targetZ === 0) {
      g.score = 0;
      g.finalMultiplier = 1;
    }

    // Reset player position & limbs
    g.playerChar.root.position.set(startX, startY, targetZ);
    g.playerChar.root.rotation.set(0, getTrackHeading(targetZ), 0);
    g.playerChar.torso.rotation.set(0, 0, 0);
    g.playerChar.torso.position.set(0, 0.72, 0);

    // Reset AI position
    if (g.aiChar) {
      const aiStartY = getGroundHeight(startX + 2.2, targetZ, false) + 0.05;
      g.aiY = aiStartY;
      g.aiChar.root.position.set(startX + 2.2, aiStartY, targetZ);
      g.aiChar.root.rotation.set(0, getTrackHeading(targetZ), 0);
    }

    // Reset pickup items ahead of targetZ
    g.pickupItems.forEach((item) => {
      if (item.z >= targetZ) {
        item.collected = false;
        // 轮37: 隐藏=零尺度实例矩阵（原逐mesh visible 开关）
        const m = item.mesh.instanceMatrix.array as Float32Array;
        const o = item.idx * 16;
        m.fill(0, o, o + 16);
        m[o + 15] = 1;
        item.mesh.instanceMatrix.needsUpdate = true;
      }
    });

    // Remove existing bridge planks ahead of targetZ
    // 轮97: 实例化后原地过滤(保持数组引用恒等, init闭包共享)+重排idx重建矩阵
    for (let i = g.bridgePlanks.length - 1; i >= 0; i--) {
      if (targetZ === 0 || g.bridgePlanks[i].z >= targetZ - 2) {
        g.bridgePlanks.splice(i, 1);
      }
    }
    g.bridgePlanks.forEach((p, i) => {
      p.idx = i;
    });
    g.rebuildBridgeInstances?.();

    // Remove existing particles
    g.particles.forEach((p) => g.scene?.remove(p.mesh));
    g.particles = [];

    g.updatePlankStackVisual?.(g.carriedPlanks);
    emit({
      state: 'running',
      planks: g.carriedPlanks,
      progress: targetZ,
      paused: false,
      ...(targetZ === 0 ? { score: 0, multiplier: 1 } : {}),
    });
  };

  // ---- 输入总线(刀2): web 监听写入 input; 小游戏壳直接置同字段 ----
  const input: GameInput = { left: false, right: false, dragging: false };
  const keys = { left: false, right: false };
  const keyHoldTime = { left: 0, right: 0 };
  let isDragging = false;
  let lastClientX = 0;

  const isLeftKey = (e: KeyboardEvent) =>
    e.code === 'KeyA' ||
    e.key === 'a' ||
    e.key === 'A' ||
    e.key === 'ArrowLeft' ||
    e.keyCode === 65 ||
    e.keyCode === 37;

  const isRightKey = (e: KeyboardEvent) =>
    e.code === 'KeyD' ||
    e.key === 'd' ||
    e.key === 'D' ||
    e.key === 'ArrowRight' ||
    e.keyCode === 68 ||
    e.keyCode === 39;

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    input.dragging = true;
    g.manualOverride = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    lastClientX = clientX;
  };

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    g.manualOverride = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - lastClientX;
    lastClientX = clientX;

    // Adjust steer offset relative to track centerline (subtracted to align screen drag right -> character moves right)
    const moveDist = -deltaX * 0.042;
    g.steerOffset += moveDist;
    g.steerOffset = Math.max(-14, Math.min(14, g.steerOffset));

    // 同步鼠标滑动瞬时速度矢量到 steerVelocityX，释放鼠标时与键盘享受一致的速度矢量阻尼插值
    const instantMouseVel = moveDist / 0.016;
    g.steerVelocityX = THREE.MathUtils.lerp(
      g.steerVelocityX,
      Math.max(-28, Math.min(28, instantMouseVel)),
      0.5
    );
  };

  const onPointerUp = () => {
    isDragging = false;
    input.dragging = false;
  };

  const togglePaused = () => {
    g.isPaused = !g.isPaused;
    emit({ paused: g.isPaused });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isLeftKey(e)) {
      g.manualOverride = true;
      if (!keys.left) {
        keyHoldTime.left = 0;
        // 初速度矢量响应（不瞬移位置，由速度矢量插值驱动位移，与鼠标轻推手感一致）
        g.steerVelocityX = Math.max(g.steerVelocityX, 5.0);
      }
      keys.left = true;
      input.left = true;
    } else if (isRightKey(e)) {
      g.manualOverride = true;
      if (!keys.right) {
        keyHoldTime.right = 0;
        // D 键专属初速度矢量强化：增加对 D 键按下的灵敏度响应，瞬时赋予向右初速度 (-6.5)，消除触键迟滞
        g.steerVelocityX = Math.min(g.steerVelocityX, -6.5);
      }
      keys.right = true;
      input.right = true;
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      togglePaused();
    } else if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
      resetGame(0);
    } else if (e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key, 10) - 1;
      if (SECTION_SHORTCUTS[idx]) {
        resetGame(SECTION_SHORTCUTS[idx].z);
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (isLeftKey(e)) {
      keys.left = false;
      input.left = false;
      keyHoldTime.left = 0;
    } else if (isRightKey(e)) {
      keys.right = false;
      input.right = false;
      keyHoldTime.right = 0;
    }
  };

  const onWindowBlur = () => {
    keys.left = false;
    keys.right = false;
    input.left = false;
    input.right = false;
    keyHoldTime.left = 0;
    keyHoldTime.right = 0;
    isDragging = false;
    input.dragging = false;
  };

  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) {
    canvasDom.addEventListener('mousedown', onPointerDown as EventListener);
    window.addEventListener('mousemove', onPointerMove as EventListener);
    window.addEventListener('mouseup', onPointerUp);
    canvasDom.addEventListener('touchstart', onPointerDown as EventListener, { passive: true });
    window.addEventListener('touchmove', onPointerMove as EventListener, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('keydown', onKeyDown as EventListener);
    window.addEventListener('keyup', onKeyUp as EventListener);
    window.addEventListener('blur', onWindowBlur);
  }

  const resizeObserver =
    typeof ResizeObserver !== 'undefined' && options.parent
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            const nw = entry.contentRect.width;
            const nh = entry.contentRect.height;
            if (nw > 0 && nh > 0 && camera && renderer) {
              camera.aspect = nw / nh;
              camera.fov = fovForAspect(nw / nh);
              camera.updateProjectionMatrix();
              renderer.setSize(nw, nh);
            }
          }
        })
      : null;
  resizeObserver?.observe(options.parent!);

  // Particle puff helper for bridge & plank pickup
  const footDustColor = trackTopColor.clone().multiplyScalar(0.78).getStyle();
  // 轮35: 粒子几何全场共享(原每次spawn新建+每次死亡dispose=GL缓冲churn, 步频~2Hz), 材质仍逐粒(独立opacity淡出)
  const puffGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  const spawnPuff = (pos: THREE.Vector3, color: string) => {
    if (!liveSettings.pickupVFX) return;
    const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true });
    for (let i = 0; i < 4; i++) {
      const pMesh = new THREE.Mesh(puffGeo, pMat);
      pMesh.position.copy(pos);
      scene.add(pMesh);
      g.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 3
        ),
        life: 0.35,
      });
    }
  };

  // 7. Animation Loop
  let clock = new THREE.Clock();
  let frameId: number | null = null;
  let running = false;
  let disposed = false;
  let fpsCounter = 0;
  let lastFpsTime = performance.now();
  let currentFps = 60;
  let lastTestPickupTrigger = 0;
  let lastProgressPush = 0;
  let lastPerfSample = 0;
  let lastMetricsPush = 0;

  let shadowTick = 0;
  const animate = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.getElapsedTime();

    // FPS tracking
    fpsCounter++;
    if (performance.now() - lastFpsTime >= 500) {
      currentFps = Math.round((fpsCounter * 1000) / (performance.now() - lastFpsTime));
      fpsCounter = 0;
      lastFpsTime = performance.now();
    }

    if (!g.playerChar || !g.scene) return;
    const curSettings = liveSettings;

    // Keep the shadow frustum riding along with the runner
    dirLight.position.set(g.playerX + 15, 30, g.playerZ - 10);
    dirLight.target.position.set(g.playerX, 0, g.playerZ);

    // 触发拾取动画预览测试 (Preview Pickup Action on Demand)
    if (
      curSettings.testPickupTrigger &&
      curSettings.testPickupTrigger !== lastTestPickupTrigger
    ) {
      lastTestPickupTrigger = curSettings.testPickupTrigger;
      g.pickupPulse = 1.0;
      sound.playPlankPickup(g.carriedPlanks);
      if (g.playerChar) {
        spawnPuff(
          new THREE.Vector3(g.playerX + 0.4, 0.9, g.playerZ + 0.2),
          palette.plankColor
        );
      }
    }

    // Handle pause state: 轮44起暂停只冻结仿真块(下方逐块 frozen 门), 相机插值与重绘继续
    // (原整帧早退在相机lerp之前: 暂停中切机位相机永久冻结半路, 取证实锤210m路点拍到65m视角)
    const frozen = g.isPaused;

    // Animate water waves
    if (!frozen && curSettings.waterWaves && g.waterMesh) {
      const posAttr = waterGeo.attributes.position;
      const colAttr = waterGeo.attributes.color;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const wave =
          Math.sin(vx * 0.12 + time * 1.8) * 0.35 +
          Math.cos(vz * 0.15 + time * 1.4) * 0.25;
        posAttr.setY(i, initialWaterY[i] + wave);
        const t = Math.max(0, Math.min(1, (wave + 0.6) / 1.2));
        colAttr.setXYZ(
          i,
          wDeep.r + (wShal.r - wDeep.r) * t,
          wDeep.g + (wShal.g - wDeep.g) * t,
          wDeep.b + (wShal.b - wDeep.b) * t
        );
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Animate collectible planks: hover bob + gentle sway (only near the runner)
    // 轻摆而非整圈旋转: 板子长轴保持横跨跑道, 读作"可拾的路径"而非乱飞碎片
    // 轮37: 经 writePickupInstance 写实例矩阵，距离窗外实例静止在 init 位姿
    let bobUpdated = false;
    for (const item of g.pickupItems) {
      if (frozen || item.collected || Math.abs(item.z - g.playerZ) > 80) continue;
      item.y = PICKUP_BASE_Y + Math.sin(time * 2.4 + item.phase) * 0.16;
      writePickupInstance(
        item,
        item.y,
        Math.sin(time * 1.6 + item.phase) * 0.14,
        false
      );
      bobUpdated = true;
    }
    if (bobUpdated) pickupMesh.instanceMatrix.needsUpdate = true;

    // Game state machine
    if (!frozen && (g.state === 'running' || g.state === 'bridging')) {
      // --- 键盘 A/D 速度矢量插值 (Velocity Interpolation) 与 D 键灵敏度曲线微调 ---
      const baseSteerSpeed = 17.0;
      let targetVelocityX = 0;

      if (keys.left) {
        keyHoldTime.left += delta;
        // A 键（向左 +X）响应曲线：平滑非线性缓入到满速
        const t = Math.min(1.0, keyHoldTime.left / 0.26);
        const curveA = 1.0 - Math.pow(1.0 - t, 2.2);
        const sensitivityA = 0.92 + 0.18 * curveA;
        targetVelocityX += baseSteerSpeed * sensitivityA;
      }

      if (keys.right) {
        keyHoldTime.right += delta;
        // D 键（向右 -X）专属灵敏度曲线微调：
        // 针对右侧水面抄近道与对抗左弯赛道离心力，采用更强劲的非线性攻击曲线（Attack Curve）与灵敏度增益
        // 初始响应区间提升（1.16x 起步增益），在 0.18s 内迅速达到充沛滑移速度，
        // 与鼠标向右快速滑动的敏捷反馈完全统一
        const t = Math.min(1.0, keyHoldTime.right / 0.18);
        const curveD = 1.0 - Math.pow(1.0 - t, 2.8);
        const sensitivityD = 1.16 + 0.24 * curveD;
        targetVelocityX -= baseSteerSpeed * sensitivityD;
      }

      // 速度矢量插值 (Velocity Interpolation):
      // 输入激活时高响应加速逼近目标速度（blendRate = 28），松开后平滑阻尼滑行缓冲（blendRate = 14）
      if (!isDragging) {
        const hasKeyInput = keys.left || keys.right;
        const blendRate = hasKeyInput ? 28.0 : 14.0;
        g.steerVelocityX = THREE.MathUtils.lerp(
          g.steerVelocityX,
          targetVelocityX,
          Math.min(1.0, delta * blendRate)
        );

        // 积分速度矢量到位移偏移量 (Velocity to Position Offset)
        g.steerOffset += g.steerVelocityX * delta;
        g.steerOffset = Math.max(-14, Math.min(14, g.steerOffset));
      }

      // Track centerline & intelligent lateral positioning
      const trackX = getTrackCenterX(g.playerZ);
      let desiredX = trackX + g.steerOffset;

      // Auto-Pilot continuous inspection mode:
      // ONLY active when enabled AND user has not actively taken over manual steering.
      // Once the user presses A/D or drags mouse, manualOverride is true and Auto-Pilot will not fight the player!
      if (curSettings.autoPilot && !g.manualOverride) {
        g.steerVelocityX = 0;
        // Gently glide toward track center
        g.steerOffset = THREE.MathUtils.lerp(g.steerOffset, 0, delta * 3.2);

        // Auto-seek nearest collectible plank ahead
        let nearestPlank: { x: number; z: number } | null = null;
        let minDZ = 18;
        for (const item of g.pickupItems) {
          if (!item.collected && item.z > g.playerZ && item.z < g.playerZ + 16) {
            const dz = item.z - g.playerZ;
            if (dz < minDZ) {
              minDZ = dz;
              nearestPlank = item;
            }
          }
        }
        if (nearestPlank) {
          desiredX = THREE.MathUtils.lerp(desiredX, nearestPlank.x, 0.45);
        }
      }

      g.targetPlayerX = desiredX;

      // VOODOO 核心物理手感：跑道抓地摩擦力与侧滑惯性模拟 (Lateral Friction & Drift Inertia)
      const friction = g.isOverWater
        ? (curSettings.trackFriction ?? 0.85) * 0.62 // 水面铺桥更具滑行推背感
        : (curSettings.trackFriction ?? 0.85);
      const drift = curSettings.lateralDrift ?? 0.20;

      // 转向敏捷响应度：摩擦力越大转向抓地力越强；侧滑系数越大转向惯性越持久
      const gripMultiplier = 10 + friction * 15;
      const targetVelX = (desiredX - g.playerX) * gripMultiplier;
      const blendRate = 24 * (1.0 - drift * 0.68) * Math.max(0.35, friction);
      g.playerVelX += (targetVelX - g.playerVelX) * Math.min(1.0, blendRate * delta);
      g.playerX += g.playerVelX * delta;

      // 奔跑前向速度与跨水滑行摩擦加成
      const targetSpeed = (curSettings.runSpeed ?? 18) * (g.isOverWater ? 1.08 : 1.0);
      g.speed += (targetSpeed - g.speed) * Math.min(1.0, delta * 6 * friction);
      g.playerZ += g.speed * delta;

      // Update progress meter — 5Hz 时间节流：15Hz 的进度推帧会拖着整棵
      // 壳层树（含 Recharts 面板）每帧重渲染，是稳态掉帧主因
      const nowProgress = performance.now();
      if (nowProgress - lastProgressPush >= 200) {
        lastProgressPush = nowProgress;
        emit({ progress: Math.min(350, Math.max(0, Math.round(g.playerZ))) });
      }

      // Check if player is on track or over water
      let onSolidGround = false;
      for (const b of g.trackBounds) {
        if (
          g.playerZ >= b.minZ &&
          g.playerZ <= b.maxZ &&
          g.playerX >= b.minX &&
          g.playerX <= b.maxX
        ) {
          onSolidGround = true;
          break;
        }
      }

      // 跑道边缘阻尼缓冲（微弱侧向缓冲，绝不锁死或限制玩家主动转向下水抄近道）
      if (onSolidGround && curSettings.collisionRestitution && curSettings.collisionRestitution > 0) {
        const restitution = curSettings.collisionRestitution;
        for (const b of g.trackBounds) {
          if (g.playerZ >= b.minZ && g.playerZ <= b.maxZ) {
            const curbMargin = 0.2;
            if (g.playerX > b.maxX - curbMargin && g.playerVelX > 2.0 && !keys.left) {
              g.playerVelX = -g.playerVelX * restitution * 0.3;
            } else if (g.playerX < b.minX + curbMargin && g.playerVelX < -2.0 && !keys.right) {
              g.playerVelX = -g.playerVelX * restitution * 0.3;
            }
          }
        }
      }

      // Bridge building over water!
      if (!onSolidGround) {
        // Player is venturing into water shortcut!
        g.isOverWater = true;

        // Infinite Planks mode ensures abundant stock
        if (curSettings.infinitePlanks && g.carriedPlanks < 15) {
          g.carriedPlanks = 30;
          emit({ planks: 30 });
          updatePlankStackVisual(30);
        }

        // 轮47: 等步距补板。原"每帧最多落1块"在低帧率下间距=单帧位移(~2m)>板长1.4m,
        // 桥板断成踏石; 改为把已走过区间按 STEP=1.25(板长1.4留0.15搭接)逐块补齐, 帧率无关
        const BRIDGE_STEP = 1.25;
        // lastBridgeDropZ 只在落板时前进; 入水/传送后可能落后几十米, 钳到脚下防止回溯铺满整段陆地
        if (g.lastBridgeDropZ < g.playerZ - BRIDGE_STEP * 2) {
          g.lastBridgeDropZ = g.playerZ - BRIDGE_STEP;
        }
        let dropGuard = 0;
        while (g.playerZ - g.lastBridgeDropZ >= BRIDGE_STEP && dropGuard++ < 6) {
          if (g.carriedPlanks <= 0 && !curSettings.infinitePlanks) {
            // Out of planks over water! DROWN!
            g.state = 'drowned';
            emit({ state: 'drowned' });
            sound.playSplash();

            // Splash animation
            if (g.playerChar) {
              spawnPuff(g.playerChar.root.position, palette.waterShallow);
            }

            // Auto-loop retry after 1.8s
            if (curSettings.autoLoop) {
              setTimeout(() => {
                resetGame(0);
              }, 1800);
            }
            break;
          }
          if (!curSettings.infinitePlanks) {
            g.carriedPlanks -= 1;
          }
          g.lastBridgeDropZ += BRIDGE_STEP;
          emit({ planks: g.carriedPlanks });
          updatePlankStackVisual(g.carriedPlanks);

          sound.playBridgePlace();

          // 轮19: 桥板共享几何+顶点色分面(原每板 new BoxGeometry + 六材数组 6 DC)
          // 轮97: 拐弯缺口铺满整宽——每个Z步沿X横排3列盖住可见海面(原只脚下1.4m单列, 两侧露海);
          // 行板写入同一 InstancedMesh, 全宽不加 DC(消费仍1板/步, 经济不变)
          const dampingVal = curSettings.waterDamping ?? 0.75;
          const impactSinkY = 0.45 - 0.12 * (1.2 - dampingVal * 0.5);
          const rowVelY = -0.65 * (1.15 - dampingVal * 0.5);
          const rowPhase = Math.random() * Math.PI * 2;
          // bPlankGeo X宽2.6; 轮97b: 列数/列位按所在水道实宽(+两侧0.3m压边)均布,
          // 任何操舵位置都整幅盖死缺口; 未知断口回退playerX 3列
          const ch = waterChannels.find(
            (c) => g.lastBridgeDropZ > c.minZ - 1.5 && g.lastBridgeDropZ < c.maxZ + 1.5
          );
          const colXs: number[] = [];
          if (ch) {
            const pad = 0.3;
            const w = ch.maxX - ch.minX + pad * 2;
            const n = Math.max(3, Math.ceil(w / 2.3));
            for (let k = 0; k < n; k++) colXs.push(ch.minX - pad + ((k + 0.5) * w) / n);
          } else {
            colXs.push(g.playerX - 2.4, g.playerX, g.playerX + 2.4);
          }
          compactBridgeIfNeeded(colXs.length);
          for (const x of colXs) {
            const bp = {
              idx: bridgePlanks.length,
              x,
              z: g.lastBridgeDropZ,
              y: impactSinkY,
              velY: rowVelY,
              phase: rowPhase,
              tilt: 0,
            };
            bridgePlanks.push(bp);
            writeBridgeInstance(bp.idx);
          }
          bridgeMesh.count = bridgePlanks.length;
          bridgeMesh.instanceMatrix.needsUpdate = true;

          spawnPuff(new THREE.Vector3(g.playerX, impactSinkY, g.lastBridgeDropZ), palette.plankColor);

          if (g.state !== 'bridging') {
            g.state = 'bridging';
            emit({ state: 'bridging' });
          }
        }
      } else {
        g.isOverWater = false;
        if (g.state === 'bridging') {
          g.state = 'running';
          emit({ state: 'running' });
        }
      }

      // Check collectible planks collision
      for (const item of g.pickupItems) {
        if (!item.collected) {
          const distZ = Math.abs(g.playerZ - item.z);
          const distX = Math.abs(g.playerX - item.x);
          if (distZ < 1.3 && distX < 1.4) {
            item.collected = true;
            writePickupInstance(item, PICKUP_BASE_Y, 0, true);
            pickupMesh.instanceMatrix.needsUpdate = true;
            // 轮49: 携板上限30(=无限模式补满值)。42拾取点×2=84板/圈只耗~15, 不设帽则读数涨到87,
            // 资源经济与8层手持堆封顶读数双双失效(实测三圈单调递增16→86)
            g.carriedPlanks = Math.min(30, g.carriedPlanks + 2);
            g.pickupPulse = 1.0;
            g.score += 20;
            emit({ score: g.score, planks: g.carriedPlanks });
            updatePlankStackVisual(g.carriedPlanks);
            sound.playPlankPickup(g.carriedPlanks);
            spawnPuff(new THREE.Vector3(item.x, item.y, item.z), palette.plankColor);
          }
        }
      }

      // Check Finish Line (Z >= 288)
      if (g.playerZ >= 288) {
        // Rush up bonus multiplier steps!
        // 轮75: 台阶实体分界在 z=284+i*6(盒心290+i*6×长6.05), 原288基准整体错位一级——
        // 站×5.5踏面上结算只报×5, 爬满×6台报×5.5; 改基准后读数=到手倍率
        const stepsClimbed = Math.min(
          Math.floor((g.playerZ - 284) / 6),
          10
        );
        const currentMult = 1 + stepsClimbed * 0.5;
        g.finalMultiplier = currentMult;
        emit({ multiplier: currentMult });

        if (g.playerZ >= 350 || (g.carriedPlanks <= 0 && !curSettings.infinitePlanks)) {
          g.state = 'finished';
          // finished 沿: 壳放 confetti(原 core 内 import canvas-confetti, 刀3 移出 UI 层)
          emit({ state: 'finished', finished: true });
          sound.playWin();

          // Continuous loop testing: celebration then smooth restart
          if (curSettings.autoLoop) {
            setTimeout(() => {
              resetGame(0);
            }, 2400);
          }
        }
      }

      // Steer velocity for dynamic character banking (smoothly bounded)
      const rawSteerVel = g.targetPlayerX - g.playerX;
      const steerVelocity = THREE.MathUtils.clamp(rawSteerVel, -1.2, 1.2);
      g.runCycle += delta * 15;
      const pickupDurationSec = Math.max(0.15, curSettings.pickupDuration ?? 0.45);
      g.pickupPulse = Math.max(0, g.pickupPulse - delta * (1.0 / pickupDurationSec));

      // Dynamic terrain elevation & slope climbing (防陷地与上下坡物理自适应)
      const currentGroundY = getGroundHeight(g.playerX, g.playerZ, g.isOverWater);
      const forwardGroundY = getGroundHeight(g.playerX, g.playerZ + 0.5, g.isOverWater);
      const effectiveGroundY = Math.max(currentGroundY, forwardGroundY);
      const targetPlayerY = effectiveGroundY + 0.05;
      const minSurfaceY = currentGroundY + 0.05;

      // Smooth elevation tracking with hard lower floor constraint (绝不下陷进入地面与台阶内部)
      g.playerY = THREE.MathUtils.lerp(g.playerY, targetPlayerY, Math.min(1.0, delta * 24));
      g.playerY = Math.max(minSurfaceY, g.playerY);

      // Footstep ground contact particles: 紧贴脚底与路面标高
      g.stepTimer += delta * 15;
      if (g.stepTimer >= Math.PI) {
        g.stepTimer -= Math.PI;
        if (curSettings.pickupVFX && (g.state === 'running' || g.state === 'bridging')) {
          const isLeftFoot = Math.sin(g.runCycle) > 0;
          const footX = g.playerX + (isLeftFoot ? -0.22 : 0.22);
          const footZ = g.playerZ - 0.05;
          const footY = g.playerY - 0.03;
          const stepColor = g.isOverWater ? palette.waterShallow : footDustColor;
          spawnPuff(new THREE.Vector3(footX, footY, footZ), stepColor);
        }
      }

      // Dynamic character heading, slope pitch & position
      const trackHeading = getTrackHeading(g.playerZ);
      const isClimbingSlope = g.playerZ >= 287 && g.playerZ < 342;
      const targetSlopePitch = isClimbingSlope ? -0.065 : 0;

      if (g.playerChar) {
        animateCharacter(
          g.playerChar,
          g.runCycle,
          steerVelocity,
          g.carriedPlanks,
          g.state,
          delta,
          g.pickupPulse,
          0,
          {
            amplitude: curSettings.pickupAmplitude ?? 1.0,
            armSpread: curSettings.holdingArmSpread ?? 0.0,
            armHeight: curSettings.holdingArmHeight ?? 0.0,
            armReach: curSettings.holdingArmReach ?? 0.0,
          }
        );
        g.playerChar.root.position.set(g.playerX, g.playerY, g.playerZ);
        g.playerChar.root.rotation.y = trackHeading;
        g.playerChar.root.rotation.x = THREE.MathUtils.lerp(
          g.playerChar.root.rotation.x,
          targetSlopePitch,
          Math.min(1.0, delta * 12)
        );
      }

      // AI competitor runner behavior & animation
      if (g.aiChar) {
        const aiZ = g.playerZ * 0.94 + 5;
        const aiTrackX = getTrackCenterX(aiZ);
        // 轮53: AI过海缺口原按0.8甲板高"贴空滑行"(比桥面0.56浮0.24m), 改与玩家同口径——trackBounds外=水上走桥面标高
        const aiX = aiTrackX + 1.2;
        const aiSolidAt = (z: number) =>
          g.trackBounds.some((b) => z >= b.minZ && z <= b.maxZ && aiX >= b.minX && aiX <= b.maxX);
        const aiGroundY = getGroundHeight(aiX, aiZ, !aiSolidAt(aiZ));
        const aiForwardGroundY = getGroundHeight(aiX, aiZ + 0.5, !aiSolidAt(aiZ + 0.5));
        const aiTargetY = Math.max(aiGroundY, aiForwardGroundY) + 0.05;
        g.aiY = THREE.MathUtils.lerp(g.aiY, aiTargetY, Math.min(1.0, delta * 24));
        g.aiY = Math.max(aiGroundY + 0.05, g.aiY);

        g.aiChar.root.position.set(aiTrackX + 1.2, g.aiY, aiZ);
        g.aiChar.root.rotation.y = getTrackHeading(aiZ);

        animateCharacter(
          g.aiChar,
          g.runCycle * 0.95,
          0,
          6,
          'running',
          delta
        );
      }
    } else if (g.state === 'drowned') {
      if (g.playerChar) {
        animateCharacter(
          g.playerChar,
          g.runCycle,
          0,
          0,
          'drowned',
          delta
        );
      }
    } else if (g.state === 'finished') {
      if (g.playerChar) {
        g.runCycle += delta * 4;
        animateCharacter(
          g.playerChar,
          g.runCycle,
          0,
          g.carriedPlanks,
          'finished',
          delta
        );
      }
    }

    // Animate particles
    for (let i = g.particles.length - 1; !frozen && i >= 0; i--) {
      const p = g.particles[i];
      p.life -= delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.vel.y -= 9.8 * delta; // Gravity
      if (p.life <= 0) {
        scene.remove(p.mesh);
        // 轮35: geometry为全场共享puffGeo, 不再逐粒dispose(会毁掉其他存活粒的缓冲); 材质逐粒仍释放
        (p.mesh.material as THREE.Material).dispose();
        g.particles.splice(i, 1);
      } else {
        // 淡出+收小: 消除"地上残留白点"的垃圾感
        const t = Math.min(1, p.life / 0.35);
        p.mesh.scale.setScalar(0.25 + 0.75 * t);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      }
    }

    // 8. 木板水面漂浮阻尼与浮力刚度物理模拟 (Plank Floating Damping & Buoyancy Spring)
    const waterDamp = curSettings.waterDamping ?? 0.75;
    const springK = (curSettings.buoyancySpring ?? 1.20) * 38;
    const dampingCoeff = waterDamp * 16 + 3.8;

    let bridgeAnyAnimated = false;
    for (let i = 0; !frozen && i < g.bridgePlanks.length; i++) {
      const bp = g.bridgePlanks[i];
      // 轮24核查结论: 0.45静止高度与getGroundHeight水上0.56(板顶=跑者站高)联动,
      // 改贴水会脚悬空+上下桥0.58m台阶, 悬浮踏石为自洽设计, 维持原值
      let surfaceLevel = 0.45;
      if (curSettings.waterWaves) {
        const wave =
          Math.sin(bp.x * 0.12 + time * 1.8 + bp.phase) * 0.07 * (1.0 - waterDamp * 0.45);
        surfaceLevel += wave;
      }
      const displacement = surfaceLevel - bp.y;
      const springForce = displacement * springK;
      const dragForce = -bp.velY * dampingCoeff;
      bp.velY += (springForce + dragForce) * delta;
      bp.y += bp.velY * delta;

      // 水面波浪轻微俯仰颠簸 (微动)
      if (curSettings.waterWaves) {
        bp.tilt = Math.sin(time * 2.2 + bp.phase) * 0.02 * (1.0 - waterDamp * 0.65);
      }
      // 轮97: 数据即真相, 每帧回写实例矩阵(原为直改 mesh.position)
      if (g.bridgeMesh && g.bridgeMesh.count > i) {
        writeBridgeInstance(i);
        bridgeAnyAnimated = true;
      }
    }
    if (bridgeAnyAnimated && g.bridgeMesh) g.bridgeMesh.instanceMatrix.needsUpdate = true;

    // Smooth Camera follow: elevated perspective with curve anticipation & multi-angle inspection
    if (camera && g.playerChar) {
      const tiltFactor = (curSettings.cameraTilt || 55) / 55;
      const camHeight = 9.4 * tiltFactor;
      const camDistZ = 12.8 * tiltFactor;
      const trackHeading = getTrackHeading(g.playerZ);

      let targetCamX = 0;
      let targetCamY = g.playerY + (camHeight - 0.85);
      let targetCamZ = 0;
      let lookAtX = g.playerX;
      let lookAtY = g.playerY + 0.8;
      let lookAtZ = g.playerZ;

      if (g.cameraViewMode === 'front') {
        // 正前方特写走查：近距离观察齐天小圣的面部、浓眉大眼双高光、如意卷云紧箍儿、黄色战袍交领与金靴
        // 轮91: 原机位y+1.15与胸前板堆(顶~2.4)齐平, 视线被板堆整幅挡死(r91 before/afterA帧实锤面部0可见); 抬高越过堆顶俯角看脸
        targetCamX = g.playerX;
        targetCamY = g.playerY + 3.4;
        targetCamZ = g.playerZ + 5.2;
        lookAtX = g.playerX;
        lookAtY = g.playerY + 1.55;
        lookAtZ = g.playerZ;
      } else if (g.cameraViewMode === 'side') {
        // 45° 黄金侧视走查：观察护腕双金箍、腰间虎皮战裙斑纹、背后斜插如意金箍棒与飞扬大红披巾飘带
        targetCamX = g.playerX + 3.8;
        targetCamY = g.playerY + 1.75;
        targetCamZ = g.playerZ + 3.4;
        lookAtX = g.playerX;
        lookAtY = g.playerY + 0.65;
        lookAtZ = g.playerZ;
      } else {
        // 默认跑酷追尾视角 (Chase Camera): 动态跟随上下坡高度
        targetCamX = g.playerX * 0.65 - Math.sin(trackHeading) * 3.5;
        targetCamY = g.playerY + (camHeight - 0.85);
        targetCamZ = g.playerZ - camDistZ;
        lookAtX = g.playerX * 0.75;
        lookAtY = g.playerY + 0.95;
        lookAtZ = g.playerZ + 6.5;
      }

      camera.position.z += (targetCamZ - camera.position.z) * 6 * delta;
      camera.position.x += (targetCamX - camera.position.x) * 6 * delta;
      camera.position.y += (targetCamY - camera.position.y) * 6 * delta;
      camera.lookAt(lookAtX, lookAtY, lookAtZ);
    }

    // Render
    // 轮36: 阴影图每3帧重烘一次(20Hz), 其余帧复用上一张shadow map纹理
    if ((shadowTick++ % 3) === 0) renderer.shadowMap.needsUpdate = true;
    const t0 = performance.now();
    renderer.render(scene, camera);
    const renderMs = Math.max(0.1, Number((performance.now() - t0).toFixed(2)));
    const calls = renderer.info.render.calls;

    // Telemetry sampling for Recharts waveform (~1 Hz, 壳做波形/读数)
    const nowTime = performance.now();
    if (nowTime - lastPerfSample >= 1000) {
      lastPerfSample = nowTime;
      emit({ perf: { fps: currentFps, drawCalls: calls, renderMs } });

      // 体检数字 1Hz 推入外部 store：不走 React state，整树零重渲染
      if (nowTime - lastMetricsPush >= 1000) {
        lastMetricsPush = nowTime;
        metricsStore.set({
          score: g.state === 'finished' ? Math.round(g.score * g.finalMultiplier) : g.score,
          planksCarried: g.carriedPlanks,
          planksPlaced: g.bridgePlanks.length,
          multiplier: g.finalMultiplier,
          state: g.state,
          drawCalls: calls,
          fps: currentFps,
          renderMs: renderMs,
        });
      }
    }

    // 帧末事件 flush(合并去重): 壳每帧最多收一次
    if (g.state !== prevState) {
      prevState = g.state;
      pendingEvent.state = g.state;
    }
    if (Object.keys(pendingEvent).length > 0) {
      const ev = pendingEvent;
      pendingEvent = {};
      listeners.forEach((l) => l(ev));
    }
  };

  // 轮22 首帧编译风暴治理: 场景建完后一次性预编译全部材质,
  // 否则前几帧边跑边编译(遥测峰值曾见2537ms), 小游戏首局体验受损
  renderer.compile(scene, camera);

  const start = () => {
    if (running || disposed) return;
    running = true;
    clock.getDelta(); // 丢弃停止期间累积的时间, 防恢复后首帧瞬移
    animate();
  };
  const stop = () => {
    running = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    listeners.clear();
    if (hasWindow) {
      canvasDom.removeEventListener('mousedown', onPointerDown as EventListener);
      window.removeEventListener('mousemove', onPointerMove as EventListener);
      window.removeEventListener('mouseup', onPointerUp);
      canvasDom.removeEventListener('touchstart', onPointerDown as EventListener);
      window.removeEventListener('touchmove', onPointerMove as EventListener);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('keydown', onKeyDown as EventListener);
      window.removeEventListener('keyup', onKeyUp as EventListener);
      window.removeEventListener('blur', onWindowBlur);
    }
    resizeObserver?.disconnect();
    renderer.dispose();
  };

  const setSettings = (patch: Partial<VisualSettings>) => {
    liveSettings = { ...liveSettings, ...patch };
    if (patch.soundEnabled !== undefined) sound.enabled = patch.soundEnabled;
    // 与 React 版 effect 对齐: autoPilot 开关变化即交还操控权
    if (patch.autoPilot !== undefined) {
      g.manualOverride = false;
      g.steerVelocityX = 0;
    }
  };

  const setCameraView = (mode: CameraViewMode) => {
    g.cameraViewMode = mode;
    emit({ cameraView: mode });
  };

  return {
    start,
    stop,
    dispose,
    resize: (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.fov = fovForAspect(w / h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },
    reset: resetGame,
    setSettings,
    setCameraView,
    togglePaused,
    onEvent: (cb: Listener) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    input,
    debug: () => ({
      playerX: g.playerX,
      playerY: g.playerY,
      playerZ: g.playerZ,
      steerOffset: g.steerOffset,
      steerVelocityX: g.steerVelocityX,
      isPaused: g.isPaused,
      isOverWater: g.isOverWater,
      carriedPlanks: g.carriedPlanks,
      state: g.state,
      score: g.score,
      finalMultiplier: g.finalMultiplier,
      bridgePlanks: g.bridgePlanks.length,
      drawCalls: renderer.info.render.calls,
      cameraViewMode: g.cameraViewMode,
    }),
  };
}
