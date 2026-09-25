import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import confetti from 'canvas-confetti';
import { ColorPalette, VisualSettings } from '../types';
import { metricsStore } from '../utils/metricsStore';
import { sound } from '../utils/audio';
import { buildArticulatedCharacter, animateCharacter, ArticulatedCharacter } from './characterBuilder';
import { PerformanceMonitor, PerfMetricPoint } from './PerformanceMonitor';

const PICKUP_BASE_Y = 1.0;

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

interface GameCanvasProps {
  palette: ColorPalette;
  settings: VisualSettings;
  onUpdateSettings?: (settings: Partial<VisualSettings>) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  palette,
  settings,
  onUpdateSettings,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<VisualSettings>(settings);
  settingsRef.current = settings;

  const [gameState, setGameState] = useState<'idle' | 'running' | 'bridging' | 'drowned' | 'finished'>('idle');
  const [plankCount, setPlankCount] = useState<number>(10);
  const [finalMultiplier, setFinalMultiplier] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [progressZ, setProgressZ] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Performance telemetry state for Recharts waveform
  const [perfHistory, setPerfHistory] = useState<PerfMetricPoint[]>(() => {
    const initial: PerfMetricPoint[] = [];
    for (let i = 12; i >= 0; i--) {
      initial.push({
        time: `${i}s`,
        fps: 60,
        drawCalls: 38,
        renderMs: 1.2,
      });
    }
    return initial;
  });
  const [liveFps, setLiveFps] = useState<number>(60);
  const [liveDrawCalls, setLiveDrawCalls] = useState<number>(38);
  const [liveRenderMs, setLiveRenderMs] = useState<number>(1.2);
  const [cameraViewMode, setCameraViewMode] = useState<'chase' | 'front' | 'side'>('chase');
  const lastPerfSampleRef = useRef<{ time: number }>({ time: 0 });
  const lastProgressPushRef = useRef<number>(0);
  const lastMetricsPushRef = useRef<number>(0);
  const lastTestPickupTriggerRef = useRef<number>(0);

  // References for game loop access
  const gameRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    playerChar: ArticulatedCharacter | null;
    aiChar: ArticulatedCharacter | null;
    waterMesh: THREE.Mesh | null;
    trackMeshes: THREE.Mesh[];
    pickupItems: { mesh: THREE.InstancedMesh; idx: number; collected: boolean; z: number; x: number; y: number; phase: number }[];
    bridgePlanks: {
      mesh: THREE.Mesh;
      velY: number;
      initialWavePhase: number;
      spawnTime: number;
    }[];
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
    state: 'idle' | 'running' | 'bridging' | 'drowned' | 'finished';
    lastBridgeDropZ: number;
    runCycle: number;
    pickupPulse: number;
    stepTimer: number;
    cameraViewMode: 'chase' | 'front' | 'side';
    materials: { [key: string]: THREE.Material };
    trackBounds: { minZ: number; maxZ: number; minX: number; maxX: number }[];
    score: number;
    finalMultiplier: number;
    manualOverride: boolean;
    updatePlankStackVisual?: (count: number) => void;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    playerChar: null,
    aiChar: null,
    waterMesh: null,
    trackMeshes: [],
    pickupItems: [],
    bridgePlanks: [],
    particles: [],
    speed: 18,
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
    carriedPlanks: 16,
    state: 'idle',
    lastBridgeDropZ: 0,
    runCycle: 0,
    pickupPulse: 0,
    stepTimer: 0,
    cameraViewMode: 'chase',
    materials: {},
    trackBounds: [],
    score: 0,
    finalMultiplier: 1,
    manualOverride: false,
  });

  // Reset or jump to specific section
  const resetGame = useCallback((targetZ: number = 0) => {
    const g = gameRef.current;
    if (!g.scene || !g.playerChar) return;

    const startX = getTrackCenterX(targetZ);
    const startY = getGroundHeight(startX, targetZ, false) + 0.05;
    g.playerX = startX;
    g.playerY = startY;
    g.playerZ = targetZ;
    g.targetPlayerX = startX;
    g.steerOffset = 0;
    g.steerVelocityX = 0;
    g.manualOverride = false;
    g.carriedPlanks = settingsRef.current.infinitePlanks ? 30 : 16;
    g.state = 'running';
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
        if (item.mesh) {
          const m = item.mesh.instanceMatrix.array as Float32Array;
          const o = item.idx * 16;
          m.fill(0, o, o + 16);
          m[o + 15] = 1;
          item.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    });

    // Remove existing bridge planks ahead of targetZ
    const keptPlanks: {
      mesh: THREE.Mesh;
      velY: number;
      initialWavePhase: number;
      spawnTime: number;
    }[] = [];
    g.bridgePlanks.forEach((plank) => {
      if (targetZ === 0 || plank.mesh.position.z >= targetZ - 2) {
        g.scene?.remove(plank.mesh);
      } else {
        keptPlanks.push(plank);
      }
    });
    g.bridgePlanks = keptPlanks;

    // Remove existing particles
    g.particles.forEach((p) => g.scene?.remove(p.mesh));
    g.particles = [];

    g.updatePlankStackVisual?.(g.carriedPlanks);
    setGameState('running');
    setPlankCount(g.carriedPlanks);
    setProgressZ(targetZ);
    if (targetZ === 0) {
      setScore(0);
      setFinalMultiplier(1);
    }
  }, []);

  // Sync sound settings
  useEffect(() => {
    sound.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Three.js initialization and animation
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene setup
    const scene = new THREE.Scene();
    // 天空: skyTop→skyBottom 垂直渐变; 地平线色=雾色, 与远处水面无缝衔接
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 2;
    skyCanvas.height = 256;
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
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 8, -11);
    camera.lookAt(0, 1.5, 8);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = settings.planarShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 轮36 阴影图20Hz: 光轴随跑者平滑移动, 60fps逐帧重刷阴影pass(全castShadow再画一遍)无感知增益,
    // 改每3帧needsUpdate重烘一次; 首帧先烘, 避免开场1帧无影
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(15, 30, -10);
    dirLight.castShadow = settings.planarShadows;
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
          settings.plankStyle === 'bamboo_raft'
            ? new THREE.Color('#22C55E')
            : settings.plankStyle === 'jade_slab'
            ? new THREE.Color('#10B981')
            : settings.plankStyle === 'gold_bar'
            ? new THREE.Color('#F59E0B')
            : settings.plankStyle === 'neon_crystal'
            ? new THREE.Color('#00F5D4')
            : new THREE.Color(palette.plankColor),
        roughness:
          settings.plankStyle === 'jade_slab'
            ? 0.15
            : settings.plankStyle === 'bamboo_raft'
            ? 0.28
            : settings.plankStyle === 'neon_crystal'
            ? 0.1
            : 0.35,
        metalness:
          settings.plankStyle === 'gold_bar'
            ? 0.85
            : settings.plankStyle === 'jade_slab'
            ? 0.15
            : 0.0,
        emissive:
          settings.plankStyle === 'neon_crystal'
            ? new THREE.Color('#00A896')
            : new THREE.Color(0x000000),
        emissiveIntensity: settings.plankStyle === 'neon_crystal' ? 0.45 : 0.0,
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
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      paint(cv.getContext('2d')!);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      // DoubleSide: 合并后甲板各面为独立平面(非闭合盒), 保证双向投影不丢桥影
      return new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness, side: THREE.DoubleSide });
    };
    const deckTopMat = deckTexMat((ctx) => {
      const base = trackTopColor.clone();
      ctx.fillStyle = base.getStyle();
      ctx.fillRect(0, 0, 32, 128);
      // 交替板面: 半格提亮 3%, 制造同色系微差
      const hsl = { h: 0, s: 0, l: 0 };
      base.getHSL(hsl, THREE.SRGBColorSpace);
      ctx.fillStyle = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + 0.03), THREE.SRGBColorSpace).getStyle();
      ctx.fillRect(0, 0, 32, 60);
      // 接缝: 压暗 12% 的细线
      ctx.fillStyle = base.clone().multiplyScalar(0.88).getStyle();
      ctx.fillRect(0, 60, 32, 5);
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
      const bannerCanvas = document.createElement('canvas');
      bannerCanvas.width = 512;
      bannerCanvas.height = 72;
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

    // 4. Build Player Character (Lively articulated low-poly runner)
    const playerChar = buildArticulatedCharacter(settings.characterType || 'runner_boy', palette, false);
    playerChar.root.position.set(0, 0.85, 0);
    scene.add(playerChar.root);

    // 5. Optional AI Competitor Runner (Only created if enabled, default is single player)
    let aiChar: ArticulatedCharacter | null = null;
    if (settings.showOpponent) {
      aiChar = buildArticulatedCharacter(
        settings.characterType === 'chibi_ninja' ? 'runner_boy' : 'chibi_ninja',
        palette,
        true
      );
      aiChar.root.position.set(2.2, 0.85, 0);
      scene.add(aiChar.root);
    }

    // Save game refs
    gameRef.current = {
      renderer,
      scene,
      camera,
      playerChar,
      aiChar,
      waterMesh,
      trackMeshes,
      pickupItems,
      bridgePlanks: [],
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
      cameraViewMode,
      materials,
      trackBounds,
      score: 0,
      finalMultiplier: 1,
      manualOverride: false,
    };

    setGameState('running');

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
          const g = stackPlankGeo.clone();
          g.rotateY(i % 2 === 0 ? 0.04 : -0.04);
          g.translate((i % 2 === 0 ? 0.05 : -0.05), i * 0.155, (i % 3 === 1 ? 0.04 : 0));
          parts.push(g);
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
    gameRef.current.updatePlankStackVisual = updatePlankStackVisual;
    updatePlankStackVisual(12);

    // 6. Controls (Touch, Mouse drag, Keyboard A/D)
    let isDragging = false;
    let lastClientX = 0;
    const keysPressed = {
      left: false,
      right: false,
    };
    const keyHoldTime = {
      left: 0,
      right: 0,
    };

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
      gameRef.current.manualOverride = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      lastClientX = clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      gameRef.current.manualOverride = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - lastClientX;
      lastClientX = clientX;

      // Adjust steer offset relative to track centerline (subtracted to align screen drag right -> character moves right)
      const moveDist = -deltaX * 0.042;
      gameRef.current.steerOffset += moveDist;
      gameRef.current.steerOffset = Math.max(-14, Math.min(14, gameRef.current.steerOffset));

      // 同步鼠标滑动瞬时速度矢量到 steerVelocityX，释放鼠标时与键盘享受一致的速度矢量阻尼插值
      const instantMouseVel = moveDist / 0.016;
      gameRef.current.steerVelocityX = THREE.MathUtils.lerp(
        gameRef.current.steerVelocityX,
        Math.max(-28, Math.min(28, instantMouseVel)),
        0.5
      );
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isLeftKey(e)) {
        gameRef.current.manualOverride = true;
        if (!keysPressed.left) {
          keyHoldTime.left = 0;
          // 初速度矢量响应（不瞬移位置，由速度矢量插值驱动位移，与鼠标轻推手感一致）
          gameRef.current.steerVelocityX = Math.max(gameRef.current.steerVelocityX, 5.0);
        }
        keysPressed.left = true;
      } else if (isRightKey(e)) {
        gameRef.current.manualOverride = true;
        if (!keysPressed.right) {
          keyHoldTime.right = 0;
          // D 键专属初速度矢量强化：增加对 D 键按下的灵敏度响应，瞬时赋予向右初速度 (-6.5)，消除触键迟滞
          gameRef.current.steerVelocityX = Math.min(gameRef.current.steerVelocityX, -6.5);
        }
        keysPressed.right = true;
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => {
          gameRef.current.isPaused = !p;
          return !p;
        });
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
        keysPressed.left = false;
        keyHoldTime.left = 0;
      } else if (isRightKey(e)) {
        keysPressed.right = false;
        keyHoldTime.right = 0;
      }
    };

    const onWindowBlur = () => {
      keysPressed.left = false;
      keysPressed.right = false;
      keyHoldTime.left = 0;
      keyHoldTime.right = 0;
      isDragging = false;
    };

    const canvasDom = renderer.domElement;
    canvasDom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvasDom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nw = entry.contentRect.width;
        const nh = entry.contentRect.height;
        if (nw > 0 && nh > 0 && camera && renderer) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      }
    });
    resizeObserver.observe(container);

    // Particle puff helper for bridge & plank pickup
    const footDustColor = trackTopColor.clone().multiplyScalar(0.78).getStyle();
    // 轮35: 粒子几何全场共享(原每次spawn新建+每次死亡dispose=GL缓冲churn, 步频~2Hz), 材质仍逐粒(独立opacity淡出)
    const puffGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const spawnPuff = (pos: THREE.Vector3, color: string) => {
      if (!settings.pickupVFX) return;
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true });
      for (let i = 0; i < 4; i++) {
        const pMesh = new THREE.Mesh(puffGeo, pMat);
        pMesh.position.copy(pos);
        scene.add(pMesh);
        gameRef.current.particles.push({
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
    let frameId: number;
    let fpsCounter = 0;
    let lastFpsTime = performance.now();
    let currentFps = 60;

    let shadowTick = 0;
    const animate = () => {
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

      const g = gameRef.current;
      if (!g.playerChar || !g.scene) return;
      const curSettings = settingsRef.current;

      // Keep the shadow frustum riding along with the runner
      dirLight.position.set(g.playerX + 15, 30, g.playerZ - 10);
      dirLight.target.position.set(g.playerX, 0, g.playerZ);

      // 触发拾取动画预览测试 (Preview Pickup Action on Demand)
      if (
        curSettings.testPickupTrigger &&
        curSettings.testPickupTrigger !== lastTestPickupTriggerRef.current
      ) {
        lastTestPickupTriggerRef.current = curSettings.testPickupTrigger;
        g.pickupPulse = 1.0;
        sound.playPlankPickup(g.carriedPlanks);
        if (g.playerChar) {
          spawnPuff(
            new THREE.Vector3(g.playerX + 0.4, 0.9, g.playerZ + 0.2),
            palette.plankColor
          );
        }
      }

      // Handle pause state
      if (g.isPaused) {
        renderer.render(scene, camera);
        return;
      }

      // Animate water waves
      if (curSettings.waterWaves && g.waterMesh) {
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
        if (item.collected || Math.abs(item.z - g.playerZ) > 80) continue;
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
      if (g.state === 'running' || g.state === 'bridging') {
        // --- 键盘 A/D 速度矢量插值 (Velocity Interpolation) 与 D 键灵敏度曲线微调 ---
        const baseSteerSpeed = 17.0;
        let targetVelocityX = 0;

        if (keysPressed.left) {
          keyHoldTime.left += delta;
          // A 键（向左 +X）响应曲线：平滑非线性缓入到满速
          const t = Math.min(1.0, keyHoldTime.left / 0.26);
          const curveA = 1.0 - Math.pow(1.0 - t, 2.2);
          const sensitivityA = 0.92 + 0.18 * curveA;
          targetVelocityX += baseSteerSpeed * sensitivityA;
        }

        if (keysPressed.right) {
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
          const hasKeyInput = keysPressed.left || keysPressed.right;
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

        // Update progress meter — 5Hz 时间节流：15Hz 的 setProgressZ 会拖着整棵
        // GameCanvas 树（含 Recharts 面板）每帧重渲染，是稳态掉帧主因
        const nowProgress = performance.now();
        if (nowProgress - lastProgressPushRef.current >= 200) {
          lastProgressPushRef.current = nowProgress;
          setProgressZ(Math.min(350, Math.max(0, Math.round(g.playerZ))));
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
              if (g.playerX > b.maxX - curbMargin && g.playerVelX > 2.0 && !keysPressed.left) {
                g.playerVelX = -g.playerVelX * restitution * 0.3;
              } else if (g.playerX < b.minX + curbMargin && g.playerVelX < -2.0 && !keysPressed.right) {
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
            setPlankCount(30);
            updatePlankStackVisual(30);
          }

          // Check if distance since last plank placed >= 1.2 units
          if (g.playerZ - g.lastBridgeDropZ >= 1.3) {
            if (g.carriedPlanks > 0 || curSettings.infinitePlanks) {
              if (!curSettings.infinitePlanks) {
                g.carriedPlanks -= 1;
              }
              g.lastBridgeDropZ = g.playerZ;
              setPlankCount(g.carriedPlanks);
              updatePlankStackVisual(g.carriedPlanks);

              sound.playBridgePlace();

              // 轮19: 桥板共享几何+顶点色分面(原每板 new BoxGeometry + 六材数组 6 DC)
              const bPlank = new THREE.Mesh(bPlankGeo, materials.plank);
              const dampingVal = curSettings.waterDamping ?? 0.75;
              const impactSinkY = 0.45 - 0.12 * (1.2 - dampingVal * 0.5);
              bPlank.position.set(g.playerX, impactSinkY, g.playerZ);
              bPlank.receiveShadow = true;
              bPlank.castShadow = true;
              scene.add(bPlank);
              g.bridgePlanks.push({
                mesh: bPlank,
                velY: -0.65 * (1.15 - dampingVal * 0.5),
                initialWavePhase: Math.random() * Math.PI * 2,
                spawnTime: time,
              });

              spawnPuff(bPlank.position, palette.plankColor);

              if (g.state !== 'bridging') {
                g.state = 'bridging';
                setGameState('bridging');
              }
            } else {
              // Out of planks over water! DROWN!
              g.state = 'drowned';
              setGameState('drowned');
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
            }
          }
        } else {
          g.isOverWater = false;
          if (g.state === 'bridging') {
            g.state = 'running';
            setGameState('running');
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
              g.carriedPlanks += 2;
              g.pickupPulse = 1.0;
              g.score += 20;
              setScore(g.score);
              setPlankCount(g.carriedPlanks);
              updatePlankStackVisual(g.carriedPlanks);
              sound.playPlankPickup(g.carriedPlanks);
              spawnPuff(new THREE.Vector3(item.x, item.y, item.z), palette.plankColor);
            }
          }
        }

        // Check Finish Line (Z >= 288)
        if (g.playerZ >= 288) {
          // Rush up bonus multiplier steps!
          const stepsClimbed = Math.min(
            Math.floor((g.playerZ - 288) / 6),
            10
          );
          const currentMult = 1 + stepsClimbed * 0.5;
          g.finalMultiplier = currentMult;
          setFinalMultiplier(currentMult);

          if (g.playerZ >= 350 || (g.carriedPlanks <= 0 && !curSettings.infinitePlanks)) {
            g.state = 'finished';
            setGameState('finished');
            sound.playWin();
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });

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
          const aiGroundY = getGroundHeight(aiTrackX + 1.2, aiZ, false);
          const aiForwardGroundY = getGroundHeight(aiTrackX + 1.2, aiZ + 0.5, false);
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
      for (let i = g.particles.length - 1; i >= 0; i--) {
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

      for (let i = 0; i < g.bridgePlanks.length; i++) {
        const bp = g.bridgePlanks[i];
        // 轮24核查结论: 0.45静止高度与getGroundHeight水上0.56(板顶=跑者站高)联动,
        // 改贴水会脚悬空+上下桥0.58m台阶, 悬浮踏石为自洽设计, 维持原值
        let surfaceLevel = 0.45;
        if (curSettings.waterWaves) {
          const wave =
            Math.sin(bp.mesh.position.x * 0.12 + time * 1.8 + bp.initialWavePhase) *
            0.07 *
            (1.0 - waterDamp * 0.45);
          surfaceLevel += wave;
        }
        const displacement = surfaceLevel - bp.mesh.position.y;
        const springForce = displacement * springK;
        const dragForce = -bp.velY * dampingCoeff;
        bp.velY += (springForce + dragForce) * delta;
        bp.mesh.position.y += bp.velY * delta;

        // 水面波浪轻微俯仰颠簸 (微动)
        if (curSettings.waterWaves) {
          bp.mesh.rotation.z =
            Math.sin(time * 2.2 + bp.initialWavePhase) * 0.02 * (1.0 - waterDamp * 0.65);
        }
      }

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
          targetCamX = g.playerX;
          targetCamY = g.playerY + 1.15;
          targetCamZ = g.playerZ + 4.6;
          lookAtX = g.playerX;
          lookAtY = g.playerY + 0.8;
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

      // Telemetry sampling for Recharts waveform (~4-5 Hz)
      const nowTime = performance.now();
      if (nowTime - lastPerfSampleRef.current.time >= 1000) {
        lastPerfSampleRef.current.time = nowTime;
        const now = new Date();
        const timeLabel = `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;
        setLiveFps(currentFps);
        setLiveDrawCalls(calls);
        setLiveRenderMs(renderMs);
        setPerfHistory((prev) => {
          const next = [...prev, { time: timeLabel, fps: currentFps, drawCalls: calls, renderMs }];
          return next.length > 25 ? next.slice(next.length - 25) : next;
        });

        // 体检数字 1Hz 推入外部 store：不走 React state，整树零重渲染
        if (nowTime - lastMetricsPushRef.current >= 1000) {
          lastMetricsPushRef.current = nowTime;
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
    };

    // 轮22 首帧编译风暴治理: 场景建完后一次性预编译全部材质,
    // 否则前几帧边跑边编译(遥测峰值曾见2537ms), 小游戏首局体验受损
    renderer.compile(scene, camera);

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvasDom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvasDom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      renderer.dispose();
    };
  }, [
    palette.id,
    settings.characterType,
    settings.plankStyle,
    settings.showOpponent,
    settings.planarShadows,
  ]);

  // When autoPilot toggle changes in settings, reset manualOverride
  useEffect(() => {
    gameRef.current.manualOverride = false;
    gameRef.current.steerVelocityX = 0;
  }, [settings.autoPilot]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-900">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating HUD: Telemetry & Testing Quick Toggles */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Left Side: Planks, State, Progress */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Carried Planks Badge */}
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg">
            <div
              className="w-3.5 h-3.5 rounded-sm shadow-sm"
              style={{ backgroundColor: palette.plankColor }}
            />
            <span className="text-[11px] font-semibold tracking-wider text-slate-400">木板</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {settings.infinitePlanks ? '∞' : plankCount}
            </span>
          </div>

          {/* Running State Badge */}
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                gameState === 'bridging'
                  ? 'bg-amber-400'
                  : gameState === 'drowned'
                  ? 'bg-rose-500'
                  : gameState === 'finished'
                  ? 'bg-emerald-400'
                  : 'bg-cyan-400'
              }`}
            />
            <span className="text-[11px] font-medium text-slate-200">
              {gameState === 'bridging'
                ? '水面铺桥'
                : gameState === 'drowned'
                ? '落水'
                : gameState === 'finished'
                ? `冲线登顶 (x${finalMultiplier.toFixed(1)})`
                : '奔跑中'}
            </span>
          </div>

          {/* Distance Progress Badge */}
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium">关卡进度</span>
            <span className="text-[12px] font-bold font-mono text-cyan-300">
              {progressZ}m / 350m
            </span>
            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200"
                style={{ width: `${Math.min(100, Math.round((progressZ / 350) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Toggles (Auto-Pilot, Infinite Planks, Auto-Loop, Pause) */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
          {/* Auto-Pilot Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ autoPilot: !settings.autoPilot })}
            title="开启/关闭全关卡自动寻路巡航，解决过弯落水重复卡死问题"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.autoPilot
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🤖</span>
            <span>自动巡航</span>
            <span className={`text-[9px] px-1 rounded ${settings.autoPilot ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-500'}`}>
              {settings.autoPilot ? '开' : '关'}
            </span>
          </button>

          {/* Infinite Planks Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ infinitePlanks: !settings.infinitePlanks })}
            title="无限木板开发不死模式，水面任意自由跨海测试"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.infinitePlanks
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🛡️</span>
            <span>无限木板</span>
            <span className={`text-[9px] px-1 rounded ${settings.infinitePlanks ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-500'}`}>
              {settings.infinitePlanks ? '开' : '关'}
            </span>
          </button>

          {/* Auto Loop Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ autoLoop: !settings.autoLoop })}
            title="冲线或重试时自动开启下一轮，实现全天候无阻断巡跑"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.autoLoop
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🔁</span>
            <span>自动循环</span>
          </button>

          {/* Sound Toggle（用户令 2026-09-24：默认关闭，工具条可开） */}
          <button
            onClick={() => onUpdateSettings?.({ soundEnabled: !settings.soundEnabled })}
            title="游戏音效开关（默认关闭）"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              settings.soundEnabled
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>{settings.soundEnabled ? '🔊' : '🔇'}</span>
            <span>音效</span>
            <span className={`text-[9px] px-1 rounded ${settings.soundEnabled ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-800 text-slate-500'}`}>
              {settings.soundEnabled ? '开' : '关'}
            </span>
          </button>

          {/* Pause / Play Toggle */}
          <button
            onClick={() => {
              setIsPaused((p) => {
                gameRef.current.isPaused = !p;
                return !p;
              });
            }}
            title="暂停/继续（按空格键），方便停格细致观察模型与姿态"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              isPaused
                ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>{isPaused ? '▶️ 继续' : '⏸️ 暂停'}</span>
          </button>

          {/* Camera View Mode Selector (Chase / Front / Side) */}
          <div className="flex items-center gap-0.5 bg-slate-950/60 p-0.5 rounded-lg border border-slate-700/50">
            <button
              onClick={() => {
                setCameraViewMode('chase');
                gameRef.current.cameraViewMode = 'chase';
              }}
              title="默认跑酷后置跟踪视角"
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                cameraViewMode === 'chase'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              后视
            </button>
            <button
              onClick={() => {
                setCameraViewMode('front');
                gameRef.current.cameraViewMode = 'front';
              }}
              title="正前特写走查视角：细看五官、浓眉大眼双高光、如意卷云紧箍儿与交领战袍"
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                cameraViewMode === 'front'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              正前特写
            </button>
            <button
              onClick={() => {
                setCameraViewMode('side');
                gameRef.current.cameraViewMode = 'side';
              }}
              title="45° 黄金侧视走查：查看虎纹战裙、护腕双金箍、斜插如意金箍棒与飞扬大红披巾飘带"
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                cameraViewMode === 'side'
                  ? 'bg-orange-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3/4侧颜
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Real-Time Performance Waveform Floating Panel */}
      <PerformanceMonitor
        data={perfHistory}
        currentFps={liveFps}
        currentDrawCalls={liveDrawCalls}
        currentRenderMs={liveRenderMs}
      />

      {/* Bottom Section Quick Jump Bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-2xl z-10 max-w-[95vw] overflow-x-auto">
        <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
          <span>📍</span>
          <span>路段秒传:</span>
        </span>
        {SECTION_SHORTCUTS.map((sec, idx) => (
          <button
            key={sec.z}
            onClick={() => resetGame(sec.z)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 active:bg-amber-500/30 text-slate-200 hover:text-amber-300 text-[11px] font-medium border border-slate-700/60 hover:border-amber-500/40 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            title={`传送至 ${sec.name} (${sec.tag})，快捷键 ${idx + 1}`}
          >
            <span className="text-amber-400/80 font-mono text-[10px]">{idx + 1}.</span>
            <span>{sec.name}</span>
            <span className="text-[9px] text-slate-400 font-mono">[{sec.tag}]</span>
          </button>
        ))}
        <button
          onClick={() => resetGame(0)}
          className="ml-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 transition-all cursor-pointer whitespace-nowrap"
          title="按 R 键重置关卡"
        >
          🔄 从头跑 (R)
        </button>
      </div>

      {/* Non-intrusive Toast Banner when Auto-Loop is Active */}
      {settings.autoLoop && (gameState === 'drowned' || gameState === 'finished') && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700/90 text-slate-100 text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 z-30 animate-bounce">
          <span>{gameState === 'finished' ? '🎉 冲线登顶！正在准备下一轮全景测试...' : '🌊 踩空落水！正在准备重新出发...'}</span>
          <button
            onClick={() => resetGame(0)}
            className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 cursor-pointer"
          >
            立即重试
          </button>
        </div>
      )}

      {/* Manual Full Modal when Auto-Loop is Disabled */}
      {!settings.autoLoop && (gameState === 'drowned' || gameState === 'finished') && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 text-2xl font-black ${
                gameState === 'finished'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {gameState === 'finished' ? '🏆' : '🌊'}
            </div>

            <h3 className="text-xl font-bold text-slate-100 mb-1">
              {gameState === 'finished' ? '成功通关冲线！' : '木板耗尽，踩空落水'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              {gameState === 'finished'
                ? `冲刺获得 ${finalMultiplier.toFixed(1)}x 结算倍率，得分结算加成！`
                : '开启上方【自动巡航】与【无限木板】可畅通测试全程，无需担心操作失误。'}
            </p>

            <button
              onClick={() => resetGame(0)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-transform cursor-pointer"
            >
              再次出发 (按 R 键重试)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
