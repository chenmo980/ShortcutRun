// 角色系统：AI Studio 关节角色移植版（母本 art-studio 分支 characterBuilder.ts）
// 按用户分工：AI Studio 解决美工和动作，我们负责游戏主线——这里是它在 Cocos 侧的落点。
// 零外部素材：球/圆柱/圆锥图元 + 关节节点层级；颜色走 Theme 表（applyCharTheme 换色不重建）。
const { ccclass } = _decorator;
import { _decorator, Node, Vec3, Mesh, MeshRenderer, Material, utils, primitives, Color } from 'cc';
import { currentTheme, colorOf } from './Theme';
import { spawnBox } from './BoxFactory';

export type CharState = 'idle' | 'running' | 'drowned' | 'finished';

export interface CharRig {
  root: Node;
  torso: Node;
  head: Node;
  ribbon: Node; // 头带飘带枢轴
  leftArm: { shoulder: Node; elbow: Node };
  rightArm: { shoulder: Node; elbow: Node };
  leftLeg: { hip: Node; knee: Node };
  rightLeg: { hip: Node; knee: Node };
  plankMount: Node;
}

// ---------- 网格缓存（同形状全局共享一份） ----------
const geoCache = new Map<string, Mesh>();
function mesh(key: string, make: () => Mesh): Mesh {
  let m = geoCache.get(key);
  if (!m) { m = make(); geoCache.set(key, m); }
  return m;
}
const GEO = {
  head: () => mesh('head', () => utils.createMesh(primitives.sphere(0.32, { segments: 12 }))),
  eye: () => mesh('eye', () => utils.createMesh(primitives.sphere(0.065, { segments: 8 }))),
  pelvis: () => mesh('pelvis', () => utils.createMesh(primitives.cylinder(0.32, 0.3, 0.32, { radialSegments: 8 }))),
  chest: () => mesh('chest', () => utils.createMesh(primitives.cylinder(0.38, 0.31, 0.55, { radialSegments: 8 }))),
  neck: () => mesh('neck', () => utils.createMesh(primitives.cylinder(0.13, 0.14, 0.18, { radialSegments: 6 }))),
  band: () => mesh('band', () => utils.createMesh(primitives.cylinder(0.335, 0.335, 0.1, { radialSegments: 12 }))),
  thigh: () => mesh('thigh', () => utils.createMesh(primitives.cylinder(0.11, 0.09, 0.38, { radialSegments: 6 }))),
  calf: () => mesh('calf', () => utils.createMesh(primitives.cylinder(0.09, 0.075, 0.38, { radialSegments: 6 }))),
  upper: () => mesh('upper', () => utils.createMesh(primitives.cylinder(0.09, 0.08, 0.34, { radialSegments: 6 }))),
  fore: () => mesh('fore', () => utils.createMesh(primitives.cylinder(0.08, 0.07, 0.34, { radialSegments: 6 }))),
  hair: () => mesh('hair', () => utils.createMesh(primitives.cone(0.36, 0.35, { radialSegments: 7 }))),
};

// ---------- 材质（主题色四件 + 固定色四件） ----------
const mats: Record<string, Material> = {
  clothTop: new Material(), clothBottom: new Material(), skin: new Material(), accent: new Material(),
  hair: new Material(), shoes: new Material(), eyes: new Material(), white: new Material(),
};
function initMat(m: Material, hex: number): void {
  m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true }, technique: 0 });
  m.setProperty('mainColor', colorOf(hex));
}
initMat(mats.hair, 0x452a18);
initMat(mats.shoes, 0xffffff);
initMat(mats.eyes, 0x0f172a);
initMat(mats.white, 0xffffff);

// 换主题：只改色，不重建（材质是共享引用）
export function applyCharTheme(): void {
  const t = currentTheme();
  initMat(mats.clothTop, t.player);
  initMat(mats.clothBottom, t.limb);
  initMat(mats.skin, t.skin);
  initMat(mats.accent, t.gate);
}

function prime(parent: Node, geo: () => Mesh, mat: Material, x: number, y: number, z: number, name = 'P'): Node {
  const n = new Node(name);
  n.parent = parent;
  const mr = n.addComponent(MeshRenderer);
  mr.mesh = geo();
  mr.material = mat;
  n.setPosition(new Vec3(x, y, z));
  return n;
}
function joint(parent: Node, x: number, y: number, z: number, name: string): Node {
  const n = new Node(name);
  n.parent = parent;
  n.setPosition(new Vec3(x, y, z));
  return n;
}

// ---------- 建角色 ----------
export function buildCharacter(root: Node): CharRig {
  applyCharTheme();
  const torso = joint(root, 0, 0.72, 0, 'Torso');

  prime(torso, GEO.pelvis, mats.clothBottom, 0, 0.16, 0, 'Pelvis');
  prime(torso, GEO.chest, mats.clothTop, 0, 0.55, 0, 'Chest');
  prime(torso, GEO.neck, mats.skin, 0, 0.88, 0, 'Neck');

  // 头
  const head = joint(torso, 0, 1.15, 0, 'Head');
  prime(head, GEO.head, mats.skin, 0, 0, 0, 'HeadMesh');
  const eyeL = prime(head, GEO.eye, mats.eyes, -0.12, 0.04, 0.28, 'EyeL');
  eyeL.setScale(new Vec3(1, 1.3, 0.5));
  eyeL.eulerAngles = new Vec3(0, 0.15, 0);
  const eyeR = prime(head, GEO.eye, mats.eyes, 0.12, 0.04, 0.28, 'EyeR');
  eyeR.setScale(new Vec3(1, 1.3, 0.5));
  eyeR.eulerAngles = new Vec3(0, -0.15, 0);
  prime(head, GEO.band, mats.accent, 0, 0.1, 0, 'Band');
  const hair = prime(head, GEO.hair, mats.hair, 0, 0.2, -0.04, 'Hair');
  hair.eulerAngles = new Vec3(-0.2, 0, 0);
  const fringe = spawnBox(head, 'limb', 0.34, 0.12, 0.22, 0, 0.24, 0.15, 'Fringe'); // 借盒型，色随后处理
  fringe.getComponent(MeshRenderer)!.material = mats.hair;
  fringe.eulerAngles = new Vec3(0.25, 0, 0);
  // 头带飘带：枢轴在脑后，盒体后挂（转枢轴=飘）
  const ribbon = joint(head, 0, 0.12, -0.32, 'Ribbon');
  const ribbonMesh = spawnBox(ribbon, 'limb', 0.14, 0.04, 0.55, 0, 0, -0.27, 'RibbonMesh');
  ribbonMesh.getComponent(MeshRenderer)!.material = mats.accent;

  // 腿：髋 → 大腿 → 膝 → 小腿 → 鞋
  const createLeg = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;
    const hip = joint(torso, side * 0.2, 0.08, 0, isLeft ? 'HipL' : 'HipR');
    prime(hip, GEO.thigh, mats.clothBottom, 0, -0.19, 0, 'Thigh');
    const knee = joint(hip, 0, -0.38, 0, isLeft ? 'KneeL' : 'KneeR');
    prime(knee, GEO.calf, mats.skin, 0, -0.19, 0, 'Calf');
    const shoe = spawnBox(knee, 'limb', 0.18, 0.14, 0.34, 0, -0.43, 0.06, 'Shoe');
    shoe.getComponent(MeshRenderer)!.material = mats.shoes;
    const sole = spawnBox(knee, 'limb', 0.19, 0.05, 0.36, 0, -0.49, 0.06, 'Sole');
    sole.getComponent(MeshRenderer)!.material = mats.white;
    return { hip, knee };
  };
  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);

  // 臂：肩 → 上臂 → 肘 → 前臂 → 手（前抱姿势）
  const createArm = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;
    const shoulder = joint(torso, side * 0.42, 0.72, 0, isLeft ? 'ShoulderL' : 'ShoulderR');
    prime(shoulder, GEO.upper, mats.skin, 0, -0.17, 0, 'UpperArm');
    const elbow = joint(shoulder, 0, -0.32, 0, isLeft ? 'ElbowL' : 'ElbowR');
    const fore = prime(elbow, GEO.fore, mats.skin, 0, 0, 0.17, 'Forearm');
    fore.eulerAngles = new Vec3(Math.PI / 2, 0, 0); // 前臂朝前
    const hand = spawnBox(elbow, 'limb', 0.12, 0.09, 0.15, side * -0.05, -0.02, 0.35, 'Hand');
    hand.getComponent(MeshRenderer)!.material = mats.skin;
    return { shoulder, elbow };
  };
  const leftArm = createArm(true);
  const rightArm = createArm(false);

  // 砖垛挂点：头顶（追尾相机可见）
  const plankMount = joint(torso, 0, 1.45, 0.02, 'PlankMount');

  return { root, torso, head, ribbon, leftArm, rightArm, leftLeg, rightLeg, plankMount };
}

// ---------- 动画（移植自母本 animateCharacter） ----------
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}
function rot(n: Node, x: number, y = 0, z = 0): void {
  n.eulerAngles = new Vec3(x, y, z);
}

export function animateCharacter(r: CharRig, runCycle: number, steerVel: number, planks: number, state: CharState, dt: number): void {
  if (state === 'drowned') {
    r.root.eulerAngles = new Vec3(lerp(r.root.eulerAngles.x, Math.PI / 2, dt * 5), 0, lerp(r.root.eulerAngles.z, 0.6, dt * 4));
    r.torso.setPosition(new Vec3(r.torso.position.x, lerp(r.torso.position.y, -0.8, dt * 3), r.torso.position.z));
    return;
  }
  if (state === 'finished') {
    r.torso.eulerAngles = new Vec3(lerp(r.torso.eulerAngles.x, -0.15, dt * 5), 0, 0);
    r.torso.setPosition(new Vec3(r.torso.position.x, 0.72 + Math.abs(Math.sin(runCycle * 4)) * 0.25, r.torso.position.z));
    r.leftArm.shoulder.eulerAngles = new Vec3(lerp(r.leftArm.shoulder.eulerAngles.x, -2.8, dt * 6), 0, lerp(r.leftArm.shoulder.eulerAngles.z, -0.4, dt * 6));
    r.rightArm.shoulder.eulerAngles = new Vec3(lerp(r.rightArm.shoulder.eulerAngles.x, -2.8, dt * 6), 0, lerp(r.rightArm.shoulder.eulerAngles.z, 0.4, dt * 6));
    rot(r.leftLeg.hip, 0); rot(r.rightLeg.hip, 0);
    rot(r.leftLeg.knee, 0.1); rot(r.rightLeg.knee, 0.1);
    return;
  }
  const stride = Math.sin(runCycle);
  // 躯干：前倾 + 扭腰 + 转弯侧倾 + 上下颠
  r.torso.eulerAngles = new Vec3(
    0.16 + (planks > 15 ? 0.06 : 0),
    Math.sin(runCycle) * 0.08,
    lerp(r.torso.eulerAngles.z, -steerVel * 0.32, dt * 12),
  );
  r.torso.setPosition(new Vec3(r.torso.position.x, 0.72 + Math.abs(stride) * 0.12, r.torso.position.z));
  // 头：反向稳定
  rot(r.head, -r.torso.eulerAngles.x * 0.8, -r.torso.eulerAngles.y * 0.5);
  // 头带飘动
  rot(r.ribbon, -0.35 + Math.sin(runCycle * 2.5) * 0.22, Math.cos(runCycle * 2) * 0.15);
  // 腿：髋摆 + 膝屈
  rot(r.leftLeg.hip, stride * 0.82);
  rot(r.leftLeg.knee, stride > 0 ? 0.1 : Math.max(0, -stride * 1.35));
  rot(r.rightLeg.hip, -stride * 0.82);
  rot(r.rightLeg.knee, -stride > 0 ? 0.1 : Math.max(0, stride * 1.35));
  // 臂：搬砖前抱 / 空手摆臂
  if (planks > 0) {
    r.leftArm.shoulder.eulerAngles = new Vec3(0.58 + Math.sin(runCycle) * 0.08, -0.28, 0.22);
    r.leftArm.elbow.eulerAngles = new Vec3(-1.25, 0, 0);
    r.rightArm.shoulder.eulerAngles = new Vec3(0.58 - Math.sin(runCycle) * 0.08, 0.28, -0.22);
    r.rightArm.elbow.eulerAngles = new Vec3(-1.25, 0, 0);
  } else {
    rot(r.leftArm.shoulder, -stride * 0.8, 0, 0.15);
    rot(r.leftArm.elbow, -0.6);
    rot(r.rightArm.shoulder, stride * 0.8, 0, -0.15);
    rot(r.rightArm.elbow, -0.6);
  }
  // 砖垛惯性
  r.plankMount.eulerAngles = new Vec3(0.04 + Math.sin(runCycle * 2) * 0.04, 0, lerp(r.plankMount.eulerAngles.z, -steerVel * 0.42, dt * 10));
}
