import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { ColorPalette, VisualSettings, GameMetrics } from '../types';
import { sound } from '../utils/audio';
import { buildArticulatedCharacter, animateCharacter, ArticulatedCharacter } from './characterBuilder';
import { PerformanceMonitor, PerfMetricPoint } from './PerformanceMonitor';

interface GameCanvasProps {
  palette: ColorPalette;
  settings: VisualSettings;
  onMetricsUpdate: (metrics: GameMetrics) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  palette,
  settings,
  onMetricsUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'running' | 'bridging' | 'drowned' | 'finished'>('idle');
  const [plankCount, setPlankCount] = useState<number>(10);
  const [finalMultiplier, setFinalMultiplier] = useState<number>(1);
  const [score, setScore] = useState<number>(0);

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
  const lastPerfSampleRef = useRef<{ time: number }>({ time: 0 });

  // References for game loop access
  const gameRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    playerChar: ArticulatedCharacter | null;
    aiChar: ArticulatedCharacter | null;
    waterMesh: THREE.Mesh | null;
    trackMeshes: THREE.Mesh[];
    pickupItems: { mesh: THREE.Mesh; collected: boolean; z: number; x: number }[];
    bridgePlanks: THREE.Mesh[];
    particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[];
    speed: number;
    playerX: number;
    playerZ: number;
    targetPlayerX: number;
    isOverWater: boolean;
    carriedPlanks: number;
    state: 'idle' | 'running' | 'bridging' | 'drowned' | 'finished';
    lastBridgeDropZ: number;
    runCycle: number;
    pickupPulse: number;
    stepTimer: number;
    materials: { [key: string]: THREE.Material };
    trackBounds: { minZ: number; maxZ: number; minX: number; maxX: number }[];
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
    playerZ: 0,
    targetPlayerX: 0,
    isOverWater: false,
    carriedPlanks: 12,
    state: 'idle',
    lastBridgeDropZ: 0,
    runCycle: 0,
    pickupPulse: 0,
    stepTimer: 0,
    materials: {},
    trackBounds: [],
  });

  // Reset or restart game
  const resetGame = useCallback(() => {
    const g = gameRef.current;
    if (!g.scene || !g.playerChar) return;

    g.playerX = 0;
    g.playerZ = 0;
    g.targetPlayerX = 0;
    g.carriedPlanks = 12;
    g.state = 'running';
    g.lastBridgeDropZ = 0;
    g.isOverWater = false;
    g.runCycle = 0;

    // Reset player position & limbs
    g.playerChar.root.position.set(0, 0.85, 0);
    g.playerChar.root.rotation.set(0, 0, 0);
    g.playerChar.torso.rotation.set(0, 0, 0);
    g.playerChar.torso.position.set(0, 0.72, 0);

    // Reset AI position
    if (g.aiChar) {
      g.aiChar.root.position.set(2.2, 0.85, 0);
      g.aiChar.root.rotation.set(0, 0, 0);
    }

    // Reset pickup items
    g.pickupItems.forEach((item) => {
      item.collected = false;
      item.mesh.visible = true;
    });

    // Remove existing bridge planks
    g.bridgePlanks.forEach((plank) => {
      g.scene?.remove(plank);
    });
    g.bridgePlanks = [];

    // Remove existing particles
    g.particles.forEach((p) => g.scene?.remove(p.mesh));
    g.particles = [];

    setGameState('running');
    setPlankCount(12);
    setScore(0);
    setFinalMultiplier(1);
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
    scene.background = new THREE.Color(palette.skyBottom);
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
        color: new THREE.Color(palette.waterShallow),
        roughness: 0.1,
        metalness: 0.2,
      }),
      track: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.trackColor),
        roughness: 0.4,
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
    const waterGeo = new THREE.PlaneGeometry(350, 450, 40, 40);
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
      { minZ: 290, maxZ: 360, minX: -2.5, maxX: 2.5 },
    ];

    const trackMeshes: THREE.Mesh[] = [];

    // Helper to build a track segment with raised edges/curbs
    const createTrackSegment = (x: number, z: number, w: number, l: number) => {
      const segGeo = new THREE.BoxGeometry(w, 0.8, l);
      const segMesh = new THREE.Mesh(segGeo, materials.track);
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
    };

    createTrackSegment(0, 25, 7, 70); // Seg 1
    createTrackSegment(6.5, 62.5, 20, 7); // Seg 2
    createTrackSegment(14, 107.5, 7, 65); // Seg 3
    createTrackSegment(4.5, 147.5, 26, 7); // Seg 4
    createTrackSegment(-5, 190, 7, 60); // Seg 5
    createTrackSegment(-2.5, 227.5, 12, 7); // Seg 6
    createTrackSegment(0, 265, 7, 50); // Seg 7

    // Multiplier finish stairway
    const stepCount = 10;
    for (let i = 0; i < stepCount; i++) {
      const stepZ = 290 + i * 6;
      const stepH = 0.8 + i * 0.4;
      const stepGeo = new THREE.BoxGeometry(5, stepH, 5.5);
      const stepMat = i === stepCount - 1 ? materials.finish : materials.goldStep;
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(0, stepH / 2, stepZ);
      step.receiveShadow = true;
      step.castShadow = true;
      scene.add(step);
    }

    // Finish Arch at Z: 288
    const archMat = materials.finish;
    const archPost1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), archMat);
    archPost1.position.set(-3.5, 3, 288);
    scene.add(archPost1);
    const archPost2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), archMat);
    archPost2.position.set(3.5, 3, 288);
    scene.add(archPost2);
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 1), archMat);
    archTop.position.set(0, 6, 288);
    scene.add(archTop);

    // 3. Scatter collectible wooden planks along the track
    const pickupItems: { mesh: THREE.Mesh; collected: boolean; z: number; x: number }[] = [];
    const plankGeo = new THREE.BoxGeometry(2.4, 0.28, 0.85);

    const spawnPlankCluster = (centerZ: number, centerX: number, count: number = 3) => {
      for (let i = 0; i < count; i++) {
        const offsetZ = (i - (count - 1) / 2) * 1.6;
        const offsetX = (Math.random() - 0.5) * 2.2;
        const pMesh = new THREE.Mesh(plankGeo, materials.plank);
        const pz = centerZ + offsetZ;
        const px = centerX + offsetX;
        pMesh.position.set(px, 1.0, pz);
        pMesh.castShadow = true;
        scene.add(pMesh);
        pickupItems.push({ mesh: pMesh, collected: false, z: pz, x: px });
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
      playerZ: 0,
      targetPlayerX: 0,
      isOverWater: false,
      carriedPlanks: 12,
      state: 'running',
      lastBridgeDropZ: 0,
      runCycle: 0,
      pickupPulse: 0,
      stepTimer: 0,
      materials,
      trackBounds,
    };

    setGameState('running');

    // Update stack visual helper (Held proudly in front of runner, supported by arms)
    const updatePlankStackVisual = (count: number) => {
      playerChar.plankMount.clear();
      const displayCount = Math.min(count, 32);
      const stackPlankGeo = new THREE.BoxGeometry(1.45, 0.15, 0.55);
      for (let i = 0; i < displayCount; i++) {
        const p = new THREE.Mesh(stackPlankGeo, materials.plank);
        p.position.set(0, i * 0.155, 0);
        p.rotation.y = (i % 2 === 0 ? 0.04 : -0.04);
        p.castShadow = true;
        playerChar.plankMount.add(p);
      }
    };
    updatePlankStackVisual(12);

    // 6. Controls (Touch, Mouse drag, Keyboard A/D)
    let isDragging = false;
    let lastClientX = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      lastClientX = clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - lastClientX;
      lastClientX = clientX;

      // Adjust target X proportionally
      gameRef.current.targetPlayerX += deltaX * 0.045;
      // Clamp player within broad sea boundary
      gameRef.current.targetPlayerX = Math.max(-25, Math.min(25, gameRef.current.targetPlayerX));
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        gameRef.current.targetPlayerX -= 1.4;
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        gameRef.current.targetPlayerX += 1.4;
      } else if (e.key === 'r' || e.key === 'R') {
        resetGame();
      }
    };

    const canvasDom = renderer.domElement;
    canvasDom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvasDom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('keydown', onKeyDown);

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
    const spawnPuff = (pos: THREE.Vector3, color: string) => {
      if (!settings.pickupVFX) return;
      const pGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
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

      // Animate water waves
      if (settings.waterWaves && g.waterMesh) {
        const posAttr = waterGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vz = posAttr.getZ(i);
          const wave =
            Math.sin(vx * 0.12 + time * 1.8) * 0.35 +
            Math.cos(vz * 0.15 + time * 1.4) * 0.25;
          posAttr.setY(i, initialWaterY[i] + wave);
        }
        posAttr.needsUpdate = true;
      }

      // Game state machine
      if (g.state === 'running' || g.state === 'bridging') {
        // Forward progression
        g.playerZ += g.speed * delta;
        // Smooth lateral steering
        g.playerX += (g.targetPlayerX - g.playerX) * 12 * delta;

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

        // Bridge building over water!
        if (!onSolidGround) {
          // Player is venturing into water shortcut!
          g.isOverWater = true;

          // Check if distance since last plank placed >= 1.2 units
          if (g.playerZ - g.lastBridgeDropZ >= 1.3) {
            if (g.carriedPlanks > 0) {
              // Consume 1 plank & lay bridge tile
              g.carriedPlanks -= 1;
              g.lastBridgeDropZ = g.playerZ;
              setPlankCount(g.carriedPlanks);
              updatePlankStackVisual(g.carriedPlanks);

              sound.playBridgePlace();

              // Spawn physical bridge plank at current water coordinate
              const bPlank = new THREE.Mesh(
                new THREE.BoxGeometry(2.6, 0.22, 1.4),
                materials.plank
              );
              bPlank.position.set(g.playerX, 0.45, g.playerZ);
              bPlank.receiveShadow = true;
              scene.add(bPlank);
              g.bridgePlanks.push(bPlank);

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
              setPlankCount(g.carriedPlanks);
              updatePlankStackVisual(g.carriedPlanks);
              setScore((s) => s + 20);
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
          setFinalMultiplier(currentMult);

          if (g.playerZ >= 350 || g.carriedPlanks <= 0) {
            g.state = 'finished';
            setGameState('finished');
            sound.playWin();
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
          }
        }

        // Steer velocity for dynamic character banking
        const steerVelocity = g.targetPlayerX - g.playerX;
        g.runCycle += delta * 15;
        g.pickupPulse = Math.max(0, g.pickupPulse - delta * 2.2); // ~0.45s 显著动作时长，避免一闪而过

        // Footstep ground contact particles (dust puffs on runway, water drops on bridge)
        g.stepTimer += delta * 15;
        if (g.stepTimer >= Math.PI) {
          g.stepTimer -= Math.PI;
          if (settings.pickupVFX && (g.state === 'running' || g.state === 'bridging')) {
            const isLeftFoot = Math.sin(g.runCycle) > 0;
            const footX = g.playerX + (isLeftFoot ? -0.22 : 0.22);
            const footZ = g.playerZ - 0.05;
            const footY = g.isOverWater ? 0.48 : 0.82;
            const stepColor = g.isOverWater ? palette.waterShallow : '#E2E8F0';
            spawnPuff(new THREE.Vector3(footX, footY, footZ), stepColor);
          }
        }

        // Animate Player Character
        if (g.playerChar) {
          animateCharacter(
            g.playerChar,
            g.runCycle,
            steerVelocity,
            g.carriedPlanks,
            g.state,
            delta,
            g.pickupPulse
          );
          g.playerChar.root.position.set(g.playerX, 0.85, g.playerZ);
        }

        // AI competitor runner behavior & animation
        if (g.aiChar) {
          const aiZ = g.playerZ * 0.94 + 5;
          let aiTargetX = 0;
          if (aiZ > 70 && aiZ < 140) aiTargetX = 14;
          else if (aiZ >= 140 && aiZ < 220) aiTargetX = -5;
          g.aiChar.root.position.set(aiTargetX + 1.2, 0.85, aiZ);

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
          g.particles.splice(i, 1);
        }
      }

      // Smooth Camera follow: elevated perspective that keeps runner fully visible and in clear view
      if (camera && g.playerChar) {
        const tiltFactor = (settings.cameraTilt || 55) / 55;
        const camHeight = 9.4 * tiltFactor;
        const camDistZ = 12.8 * tiltFactor;

        const targetCamZ = g.playerZ - camDistZ;
        const targetCamX = g.playerX * 0.55;
        camera.position.z += (targetCamZ - camera.position.z) * 6 * delta;
        camera.position.x += (targetCamX - camera.position.x) * 6 * delta;
        camera.position.y += (camHeight - camera.position.y) * 6 * delta;
        camera.lookAt(
          g.playerX * 0.65,
          1.8,
          g.playerZ + 6.5
        );
      }

      // Render
      const t0 = performance.now();
      renderer.render(scene, camera);
      const renderMs = Math.max(0.1, Number((performance.now() - t0).toFixed(2)));
      const calls = renderer.info.render.calls;

      // Telemetry sampling for Recharts waveform (~4-5 Hz)
      const nowTime = performance.now();
      if (nowTime - lastPerfSampleRef.current.time >= 220) {
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
      }

      // Report metrics
      onMetricsUpdate({
        score: score,
        planksCarried: g.carriedPlanks,
        planksPlaced: g.bridgePlanks.length,
        multiplier: finalMultiplier,
        state: g.state,
        drawCalls: calls,
        fps: currentFps,
        renderMs: renderMs,
      });
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
      renderer.dispose();
    };
  }, [
    palette,
    settings.characterType,
    settings.cameraTilt,
    settings.showOpponent,
    settings.planarShadows,
    settings.waterWaves,
    settings.pickupVFX,
    resetGame,
    onMetricsUpdate,
    score,
    finalMultiplier,
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-900">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating HUD over Game Canvas */}
      <div className="absolute top-4 left-4 flex flex-wrap items-center gap-3 pointer-events-none">
        {/* Carried Planks Badge */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 px-3.5 py-1.5 rounded-xl shadow-lg">
          <div
            className="w-3.5 h-3.5 rounded-sm shadow-sm"
            style={{ backgroundColor: palette.plankColor }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">木板存量</span>
          <span className="text-lg font-extrabold text-amber-400 font-mono">{plankCount}</span>
        </div>

        {/* State Badge */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg">
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
          <span className="text-xs font-semibold text-slate-200">
            {gameState === 'bridging'
              ? '铺桥抄近道中...'
              : gameState === 'drowned'
              ? '踩空落水！'
              : gameState === 'finished'
              ? `冲刺冲线 (x${finalMultiplier.toFixed(1)})`
              : '直道奔跑中'}
          </span>
        </div>
      </div>

      {/* Recharts Real-Time Performance Waveform Floating Panel */}
      <PerformanceMonitor
        data={perfHistory}
        currentFps={liveFps}
        currentDrawCalls={liveDrawCalls}
        currentRenderMs={liveRenderMs}
      />

      {/* Touch/Mouse Instructions Hint */}
      {gameState === 'running' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2 bg-slate-900/75 backdrop-blur-sm border border-slate-700/70 text-slate-300 text-xs px-4 py-1.5 rounded-full shadow-md">
          <span>拖拽鼠标 / 触屏左右滑动转向 / 键盘 A/D</span>
          <span className="text-amber-400 font-bold">• 冲入水域直接铺桥抄近道</span>
        </div>
      )}

      {/* Game Over / Reset Overlay */}
      {(gameState === 'drowned' || gameState === 'finished') && (
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
                : '在水面抄近道时需时刻注意木板剩余数量，提前储备木板方可超车。'}
            </p>

            <button
              onClick={resetGame}
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
