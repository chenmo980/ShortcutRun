import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
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
  { name: '右侧海域直道', z: 105, tag: '105m' },
  { name: '碧波回转近道', z: 145, tag: '145m' },
  { name: '终前直道', z: 220, tag: '220m' },
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
    pickupItems: { mesh: THREE.Mesh; collected: boolean; z: number; x: number; phase: number }[];
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
        item.mesh.visible = true;
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

    // Materials dictionary
    const materials = {
      water: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
        roughness: 0.1,
        metalness: 0.2,
      }),
      track: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.trackColor),
        roughness: 0.4,
      }),
      trackSide: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.trackColor).multiplyScalar(0.68),
        roughness: 0.55,
      }),
      trackBottom: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.trackColor).multiplyScalar(0.45),
        roughness: 0.7,
      }),
      trackBorder: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.trackBorder),
        roughness: 0.5,
      }),
      plank: new THREE.MeshStandardMaterial({
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
    // Section 3: Z: 80 to 140, X: 11.5 to 18.5 (Right Straight)
    // Section 4: Z: 140 to 160, X: -8.5 to 18.5 (Turn Left Across)
    // Section 5: Z: 160 to 220, X: -8.5 to -1.5 (Left Straight)
    // Section 6: Z: 220 to 240, X: -8.5 to 3.5 (Turn Center)
    // Section 7: Z: 240 to 290, X: -3.5 to 3.5 (Straight to Finish)
    // Section 8: Z: 290 to 360, X: -2.5 to 2.5 (Multiplier Staircase)
    const trackBounds = [
      { minZ: -10, maxZ: 60, minX: -3.5, maxX: 3.5 },
      { minZ: 50, maxZ: 75, minX: -3.5, maxX: 16.5 },
      { minZ: 75, maxZ: 140, minX: 10.5, maxX: 17.5 },
      { minZ: 135, maxZ: 160, minX: -8.5, maxX: 17.5 },
      { minZ: 160, maxZ: 220, minX: -8.5, maxX: -1.5 },
      { minZ: 215, maxZ: 240, minX: -8.5, maxX: 3.5 },
      { minZ: 240, maxZ: 290, minX: -3.5, maxX: 3.5 },
      { minZ: 287, maxZ: 360, minX: -2.8, maxX: 2.8 },
    ];

    const trackMeshes: THREE.Mesh[] = [];

    // 桥柱水线: 吃水线处的湿润深色带（比桥体底色更暗）+ 水面泡沫环
    const waterlineMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.trackColor).multiplyScalar(0.35),
      roughness: 0.85,
    });
    const waterlineGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.6, 6);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const foamGeo = new THREE.RingGeometry(0.42, 0.85, 12);

    // Helper to build a track segment with raised edges/curbs
    const createTrackSegment = (x: number, z: number, w: number, l: number) => {
      const segGeo = new THREE.BoxGeometry(w, 0.8, l);
      // 六面分材: 顶面原色, 侧面压暗, 底面最暗——桥体立刻有厚度感
      const segMesh = new THREE.Mesh(segGeo, [
        materials.trackSide,
        materials.trackSide,
        materials.track,
        materials.trackBottom,
        materials.trackSide,
        materials.trackSide,
      ]);
      segMesh.position.set(x, 0.4, z);
      segMesh.receiveShadow = true;
      segMesh.castShadow = true;
      scene.add(segMesh);
      trackMeshes.push(segMesh);

      // Support pillars in the water
      const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 3.5, 6);
      const pillar1 = new THREE.Mesh(pillarGeo, materials.trackBorder);
      pillar1.position.set(x - w / 2 + 0.3, -1, z - l / 3);
      scene.add(pillar1);
      const pillar2 = new THREE.Mesh(pillarGeo, materials.trackBorder);
      pillar2.position.set(x + w / 2 - 0.3, -1, z + l / 3);
      scene.add(pillar2);
      const ring1 = new THREE.Mesh(waterlineGeo, waterlineMat);
      ring1.position.y = 0.95;
      pillar1.add(ring1);
      const ring2 = new THREE.Mesh(waterlineGeo, waterlineMat);
      ring2.position.y = 0.95;
      pillar2.add(ring2);
      const foam1 = new THREE.Mesh(foamGeo, foamMat);
      foam1.rotation.x = -Math.PI / 2;
      foam1.position.y = 1.04;
      pillar1.add(foam1);
      const foam2 = new THREE.Mesh(foamGeo, foamMat);
      foam2.rotation.x = -Math.PI / 2;
      foam2.position.y = 1.04;
      pillar2.add(foam2);
    };

    createTrackSegment(0, 25, 7, 70); // Seg 1
    createTrackSegment(6.5, 62.5, 20, 7); // Seg 2
    createTrackSegment(14, 107.5, 7, 65); // Seg 3
    createTrackSegment(4.5, 147.5, 26, 7); // Seg 4
    createTrackSegment(-5, 190, 7, 60); // Seg 5
    createTrackSegment(-2.5, 227.5, 12, 7); // Seg 6
    createTrackSegment(0, 265, 7, 50); // Seg 7

    // Multiplier finish stairway: 无缝阶梯坡道与胜利领奖台
    const stepCount = 10;
    for (let i = 0; i < stepCount; i++) {
      const stepZ = 290 + i * 6;
      const stepH = 0.8 + i * 0.4;
      const isTop = i === stepCount - 1;
      const stepLength = isTop ? 14 : 6.05;
      const stepGeo = new THREE.BoxGeometry(5.2, stepH, stepLength);
      const stepMat = isTop ? materials.finish : materials.goldStep;
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(0, stepH / 2, isTop ? stepZ + 3.5 : stepZ);
      step.receiveShadow = true;
      step.castShadow = true;
      scene.add(step);
    }

    // Finish Arch at Z: 288
    const archMat = materials.finish;
    // 龙门: 糖果条纹柱+顶梁+白横幅(原为三块同色板, 远景识别度差)
    const archWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    {
      const bands = 4;
      const bandH = 6 / bands;
      for (let side = -1; side <= 1; side += 2) {
        for (let b = 0; b < bands; b++) {
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, bandH, 0.85),
            b % 2 === 0 ? archMat : archWhite
          );
          band.position.set(side * 3.5, bandH / 2 + b * bandH, 288);
          band.castShadow = true;
          scene.add(band);
        }
      }
      const archTop = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 1), archMat);
      archTop.position.set(0, 6.7, 288);
      archTop.castShadow = true;
      scene.add(archTop);
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
      const banner = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 0.2), [
        archWhite, archWhite, archWhite, archWhite, archWhite, bannerFace,
      ]);
      banner.position.set(0, 6.7, 287.39);
      scene.add(banner);
    }

    // 3. Scatter collectible wooden planks along the track
    const pickupItems: { mesh: THREE.Mesh; collected: boolean; z: number; x: number; phase: number }[] = [];
    const plankGeo = new THREE.BoxGeometry(2.4, 0.28, 0.85);

    const spawnPlankCluster = (centerZ: number, centerX: number, count: number = 3) => {
      for (let i = 0; i < count; i++) {
        const offsetZ = (i - (count - 1) / 2) * 1.6;
        const offsetX = (Math.random() - 0.5) * 2.2;
        const pMesh = new THREE.Mesh(plankGeo, materials.plank);
        const pz = centerZ + offsetZ;
        const px = centerX + offsetX;
        pMesh.position.set(px, PICKUP_BASE_Y, pz);
        pMesh.castShadow = true;
        scene.add(pMesh);
        pickupItems.push({
          mesh: pMesh,
          collected: false,
          z: pz,
          x: px,
          phase: (pz * 0.9 + px * 2.3) % (Math.PI * 2),
        });
      }
    };

    // Scatter on track segments
    [15, 30, 45, 80, 95, 110, 125, 165, 180, 195, 210, 245, 255, 270].forEach((z) => {
      let trackX = 0;
      if (z >= 75 && z <= 135) trackX = 14;
      else if (z >= 160 && z <= 215) trackX = -5;
      spawnPlankCluster(z, trackX, 3);
    });

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
    const updatePlankStackVisual = (count: number) => {
      playerChar.plankMount.clear();
      // 视觉封顶 8 块：再多只加高绿塔遮脸（真实数量看 HUD 木板计数）；交错叠放模拟手托柴捆
      const displayCount = Math.min(count, 8);
      const stackPlankGeo = new THREE.BoxGeometry(1.45, 0.15, 0.55);
      for (let i = 0; i < displayCount; i++) {
        const p = new THREE.Mesh(stackPlankGeo, materials.plank);
        p.position.set((i % 2 === 0 ? 0.05 : -0.05), i * 0.155, (i % 3 === 1 ? 0.04 : 0));
        p.rotation.y = (i % 2 === 0 ? 0.04 : -0.04);
        p.castShadow = true;
        playerChar.plankMount.add(p);
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
    const footDustColor = new THREE.Color(palette.trackColor).multiplyScalar(0.78).getStyle();
    const spawnPuff = (pos: THREE.Vector3, color: string) => {
      if (!settings.pickupVFX) return;
      const pGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true });
      for (let i = 0; i < 4; i++) {
        const pMesh = new THREE.Mesh(pGeo, pMat);
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

      // Animate collectible planks: hover bob + slow spin (only near the runner)
      for (const item of g.pickupItems) {
        if (item.collected || Math.abs(item.z - g.playerZ) > 80) continue;
        item.mesh.position.y =
          PICKUP_BASE_Y + Math.sin(time * 2.4 + item.phase) * 0.16;
        item.mesh.rotation.y = time * 1.1 + item.phase;
      }

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

              // Spawn physical bridge plank at current water coordinate with initial impact sink
              const bPlank = new THREE.Mesh(
                new THREE.BoxGeometry(2.6, 0.22, 1.4),
                materials.plank
              );
              const dampingVal = curSettings.waterDamping ?? 0.75;
              const impactSinkY = 0.45 - 0.12 * (1.2 - dampingVal * 0.5);
              bPlank.position.set(g.playerX, impactSinkY, g.playerZ);
              bPlank.receiveShadow = true;
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
              item.mesh.visible = false;
              g.carriedPlanks += 2;
              g.pickupPulse = 1.0;
              g.score += 20;
              setScore(g.score);
              setPlankCount(g.carriedPlanks);
              updatePlankStackVisual(g.carriedPlanks);
              sound.playPlankPickup(g.carriedPlanks);
              spawnPuff(item.mesh.position, palette.plankColor);
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
          p.mesh.geometry.dispose();
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
