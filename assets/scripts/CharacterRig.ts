// 角色系统：AI Studio 关节角色移植版（母本 art-studio 分支 characterBuilder.ts v2 增强）
// 按用户分工：AI Studio 解决美工和动作，我们负责游戏主线——这里是它在 Cocos 侧的落点。
// v2 增强内容（母本 c6431f4）：立体碎发组 / 腮红微笑表情 / 脚踝滚动步态 /
// 负重反作用平衡 / 铺桥推掷动作 / 后跟反光提环 / 砖垛重惯性。
// 零外部素材：球/圆柱/圆锥/圆环/平面图元 + 关节节点层级；颜色走 Theme 表。
const { ccclass } = _decorator;
import { _decorator, Node, Vec3, Mesh, MeshRenderer, Material, utils, primitives } from 'cc';
import { currentTheme, colorOf } from './Theme';
import { spawnBox } from './BoxFactory';

export type CharState = 'idle' | 'running' | 'bridging' | 'drowned' | 'finished';

export interface CharRig {
  root: Node;
  torso: Node;
  head: Node;
  ribbon: Node; // 头带飘带枢轴
  leftArm: { shoulder: Node; elbow: Node };
  rightArm: { shoulder: Node; elbow: Node };
  leftLeg: { hip: Node; knee: Node; foot: Node };
  rightLeg: { hip: Node; knee: Node; foot: Node };
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
  hairCrown: () => mesh('hairCrown', () => utils.createMesh(primitives.cone(0.36, 0.42, { radialSegments: 7 }))),
  hairSpike: () => mesh('hairSpike', () => utils.createMesh(primitives.cone(0.14, 0.35, { radialSegments: 5 }))),
  hairTuft: () => mesh('hairTuft', () => utils.createMesh(primitives.cone(0.12, 0.28, { radialSegments: 5 }))),
  smile: () => mesh('smile', () => utils.createMesh(primitives.torus(0.065, 0.016, { arc: Math.PI }))),
  circlet: () => mesh('circlet', () => utils.createMesh(primitives.torus(0.335, 0.025, { radialSegments: 8, tubularSegments: 20 }))),
  bun: () => mesh('bun', () => utils.createMesh(primitives.sphere(0.12, { segments: 8 }))),
  qiankun: () => mesh('qiankun', () => utils.createMesh(primitives.torus(0.24, 0.028, { radialSegments: 8, tubularSegments: 20 }))),
  pony: () => mesh('pony', () => utils.createMesh(primitives.cone(0.14, 0.55, { radialSegments: 6 }))),
  sash: () => mesh('sash', () => utils.createMesh(primitives.cylinder(0.35, 0.33, 0.12, { radialSegments: 8 }))),
};

// ---------- 材质（主题色四件 + 固定色四件 + 国风专属三件） ----------
const mats: Record<string, Material> = {
  clothTop: new Material(), clothBottom: new Material(), skin: new Material(), accent: new Material(),
  hair: new Material(), shoes: new Material(), eyes: new Material(), white: new Material(),
  blush: new Material(), smile: new Material(),
  gold: new Material(), red: new Material(), dark: new Material(),
};
function initMat(m: Material, hex: number, alpha = 255): void {
  m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true }, technique: 0 });
  m.setProperty('mainColor', colorOf(hex));
  if (alpha < 255) {
    const c = colorOf(hex);
    c.a = alpha;
    m.setProperty('mainColor', c);
  }
}
initMat(mats.hair, 0x452a18);
initMat(mats.shoes, 0xffffff);
initMat(mats.eyes, 0x0f172a);
initMat(mats.white, 0xffffff);
initMat(mats.blush, 0xff8a80, 220);
initMat(mats.smile, 0x991b1b);
initMat(mats.gold, 0xf59e0b);
initMat(mats.red, 0xdc2626);
initMat(mats.dark, 0x0f172a);

// ---------- 国风与经典角色预设（AI Studio 优势移植） ----------
export type CharSkinType = 'runner' | 'wukong' | 'nezha' | 'guofeng' | 'panda' | 'ninja';

export interface SkinDef {
  id: CharSkinType;
  name: string;
  clothTop: number;
  clothBottom: number;
  skin: number;
  accent: number;
  hair: number;
}

export const CHAR_SKINS: Record<CharSkinType, SkinDef> = {
  wukong: {
    id: 'wukong',
    name: '齐天大圣·孙悟空',
    clothTop: 0xdc2626,
    clothBottom: 0xf59e0b,
    skin: 0xfbd0a2,
    accent: 0xf59e0b,
    hair: 0x78350f,
  },
  nezha: {
    id: 'nezha',
    name: '三坛海会·莲花哪吒',
    clothTop: 0xdc2626,
    clothBottom: 0x10b981,
    skin: 0xffedd5,
    accent: 0xf59e0b,
    hair: 0x0f172a,
  },
  guofeng: {
    id: 'guofeng',
    name: '青莲剑客·少年侠客',
    clothTop: 0xf8fafc,
    clothBottom: 0x1e293b,
    skin: 0xffedd5,
    accent: 0xdc2626,
    hair: 0x0f172a,
  },
  panda: {
    id: 'panda',
    name: '神州大侠·功夫熊猫',
    clothTop: 0xdc2626,
    clothBottom: 0x0f172a,
    skin: 0xffffff,
    accent: 0xfbbf24,
    hair: 0x0f172a,
  },
  ninja: {
    id: 'ninja',
    name: '暗影行者·国潮刺客',
    clothTop: 0x1e293b,
    clothBottom: 0x0f172a,
    skin: 0xfbd0a2,
    accent: 0xe11d48,
    hair: 0x0f172a,
  },
  runner: {
    id: 'runner',
    name: '热血飞人·经典主角',
    clothTop: 0x0288d1,
    clothBottom: 0x1e293b,
    skin: 0xfbd0a2,
    accent: 0xef4444,
    hair: 0x452a18,
  },
};

let activeSkin: CharSkinType = 'wukong'; // 默认国风之光：齐天大圣 孙悟空

export function setCharacterSkin(skin: CharSkinType): void {
  activeSkin = skin;
  applyCharTheme();
}

export function getCharacterSkin(): CharSkinType {
  return activeSkin;
}

// 配饰装配与换装（支持无缝切换国风造型）
export function applyRigSkin(r: CharRig, skin: CharSkinType = activeSkin): void {
  activeSkin = skin;
  applyCharTheme();

  const head = r.head;
  const torso = r.torso;
  const band = head.getChildByName('Band');
  const ribbon = head.getChildByName('Ribbon');
  const hairGroup = head.getChildByName('HairGroup');
  const skinAccHead = head.getChildByName('SkinAccHead');
  const skinAccTorso = torso.getChildByName('SkinAccTorso');

  if (skinAccHead) skinAccHead.removeAllChildren();
  if (skinAccTorso) skinAccTorso.removeAllChildren();

  if (skin === 'wukong') {
    if (band) band.active = false;
    if (ribbon) ribbon.active = false;
    if (hairGroup) hairGroup.active = true;
    if (skinAccHead && skinAccTorso) {
      // 纯金紧箍环
      const circlet = prime(skinAccHead, GEO.circlet, mats.gold, 0, 0.12, 0.02, 'Circlet');
      circlet.eulerAngles = new Vec3(90 + 5.7, 0, 0);
      // 凤翅紫金冠双雉翎飘带
      for (const sx of [-1, 1]) {
        const plume = spawnBox(skinAccHead, 'limb', 0.035, 0.018, 0.75, sx * 0.12, 0.35, -0.15, sx < 0 ? 'PlumeL' : 'PlumeR');
        plume.getComponent(MeshRenderer)!.material = mats.red;
        plume.eulerAngles = new Vec3(-37, sx * 10, sx * 7);
      }
      // 锁子黄金甲护心镜
      const plate = spawnBox(skinAccTorso, 'limb', 0.24, 0.24, 0.06, 0, 0.55, 0.34, 'Breastplate');
      plate.getComponent(MeshRenderer)!.material = mats.gold;
      // 凤翅金甲双护肩 (Pauldrons)
      for (const sx of [-1, 1]) {
        const pauldron = spawnBox(skinAccTorso, 'limb', 0.2, 0.12, 0.18, sx * 0.38, 0.72, 0, sx < 0 ? 'PauldronL' : 'PauldronR');
        pauldron.getComponent(MeshRenderer)!.material = mats.gold;
        pauldron.eulerAngles = new Vec3(0, 0, sx * -15);
      }
      // 战袍下摆战裙 (WarSkirt)
      const skirt = spawnBox(skinAccTorso, 'limb', 0.28, 0.26, 0.05, 0, 0.2, 0.18, 'WarSkirt');
      skirt.getComponent(MeshRenderer)!.material = mats.red;
      skirt.eulerAngles = new Vec3(12, 0, 0);
      // 金色祥云腰扣
      const beltBuckle = spawnBox(skinAccTorso, 'limb', 0.12, 0.08, 0.04, 0, 0.32, 0.32, 'BeltBuckle');
      beltBuckle.getComponent(MeshRenderer)!.material = mats.gold;
    }
  } else if (skin === 'nezha') {
    if (band) band.active = false;
    if (ribbon) ribbon.active = false;
    if (hairGroup) hairGroup.active = false;
    if (skinAccHead && skinAccTorso) {
      // 双冲天抓髻
      for (const sx of [-1, 1]) {
        prime(skinAccHead, GEO.bun, mats.dark, sx * 0.22, 0.38, 0, sx < 0 ? 'BunL' : 'BunR');
        const ring = prime(skinAccHead, GEO.circlet, mats.red, sx * 0.22, 0.34, 0, sx < 0 ? 'RingL' : 'RingR');
        ring.setScale(new Vec3(0.4, 0.4, 0.4));
        ring.eulerAngles = new Vec3(90, 0, 0);
      }
      // 纯金乾坤圈
      const qiankun = prime(skinAccTorso, GEO.qiankun, mats.gold, 0, 0.55, 0.12, 'Qiankun');
      qiankun.eulerAngles = new Vec3(20, 26, 12);
      // 仙家混天绫长飘带
      for (const sx of [-1, 1]) {
        const silk = spawnBox(skinAccTorso, 'limb', 0.06, 0.02, 0.8, sx * 0.28, 0.65, -0.15, sx < 0 ? 'SilkL' : 'SilkR');
        silk.getComponent(MeshRenderer)!.material = mats.red;
        silk.eulerAngles = new Vec3(-23, sx * 9, sx * 6);
      }
    }
  } else if (skin === 'guofeng') {
    if (band) band.active = false;
    if (ribbon) ribbon.active = false;
    if (hairGroup) hairGroup.active = false;
    if (skinAccHead && skinAccTorso) {
      // 高马尾发髻
      const pony = prime(skinAccHead, GEO.pony, mats.dark, 0, 0.42, -0.22, 'Pony');
      pony.eulerAngles = new Vec3(-63, 0, 0);
      const redRibbon = spawnBox(skinAccHead, 'limb', 0.08, 0.02, 0.45, 0, 0.28, -0.32, 'PonyRibbon');
      redRibbon.getComponent(MeshRenderer)!.material = mats.red;
      redRibbon.eulerAngles = new Vec3(-40, 0, 0);
      // 汉服朱砂腰封
      prime(skinAccTorso, GEO.sash, mats.red, 0, 0.24, 0, 'Sash');
    }
  } else if (skin === 'panda') {
    if (band) band.active = false;
    if (ribbon) ribbon.active = false;
    if (hairGroup) hairGroup.active = true;
    if (skinAccHead) {
      for (const sx of [-1, 1]) {
        prime(skinAccHead, GEO.bun, mats.dark, sx * 0.25, 0.32, -0.05, sx < 0 ? 'EarL' : 'EarR');
      }
    }
  } else if (skin === 'ninja') {
    if (band) band.active = false;
    if (ribbon) ribbon.active = false;
    if (hairGroup) hairGroup.active = true;
    if (skinAccHead) {
      const mask = spawnBox(skinAccHead, 'limb', 0.34, 0.16, 0.22, 0, -0.08, 0.2, 'NinjaMask');
      mask.getComponent(MeshRenderer)!.material = mats.dark;
      const plate = spawnBox(skinAccHead, 'limb', 0.18, 0.08, 0.02, 0, 0.12, 0.335, 'NinjaPlate');
      plate.getComponent(MeshRenderer)!.material = mats.white;
    }
  } else {
    // 经典跑者
    if (band) band.active = true;
    if (ribbon) ribbon.active = true;
    if (hairGroup) hairGroup.active = true;
  }
}

// 换主题/换皮肤：只改色，不重建（材质是共享引用）
export function applyCharTheme(): void {
  if (activeSkin !== 'runner' && CHAR_SKINS[activeSkin]) {
    const s = CHAR_SKINS[activeSkin];
    initMat(mats.clothTop, s.clothTop);
    initMat(mats.clothBottom, s.clothBottom);
    initMat(mats.skin, s.skin);
    initMat(mats.accent, s.accent);
    initMat(mats.hair, s.hair);
    return;
  }
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
export function buildCharacter(root: Node, skin: CharSkinType = activeSkin): CharRig {
  activeSkin = skin;
  applyCharTheme();
  const torso = joint(root, 0, 0.72, 0, 'Torso');
  const skinAccTorso = joint(torso, 0, 0, 0, 'SkinAccTorso');

  prime(torso, GEO.pelvis, mats.clothBottom, 0, 0.16, 0, 'Pelvis');
  prime(torso, GEO.chest, mats.clothTop, 0, 0.55, 0, 'Chest');
  prime(torso, GEO.neck, mats.skin, 0, 0.88, 0, 'Neck');

  // 头 + 表情（v2：腮红/微笑）
  const head = joint(torso, 0, 1.15, 0, 'Head');
  prime(head, GEO.head, mats.skin, 0, 0, 0, 'HeadMesh');
  const eyeL = prime(head, GEO.eye, mats.eyes, -0.12, 0.04, 0.28, 'EyeL');
  eyeL.setScale(new Vec3(1, 1.3, 0.5));
  eyeL.eulerAngles = new Vec3(0, 0.15, 0);
  const eyeR = prime(head, GEO.eye, mats.eyes, 0.12, 0.04, 0.28, 'EyeR');
  eyeR.setScale(new Vec3(1, 1.3, 0.5));
  eyeR.eulerAngles = new Vec3(0, -0.15, 0);
  // 表情：腮红（薄盒贴片，法线朝前）+ 微笑（半圆环）
  const blushL = spawnBox(head, 'limb', 0.11, 0.06, 0.02, -0.19, -0.06, 0.25, 'BlushL');
  blushL.getComponent(MeshRenderer)!.material = mats.blush;
  blushL.eulerAngles = new Vec3(0, 0.55, 0);
  const blushR = spawnBox(head, 'limb', 0.11, 0.06, 0.02, 0.19, -0.06, 0.25, 'BlushR');
  blushR.getComponent(MeshRenderer)!.material = mats.blush;
  blushR.eulerAngles = new Vec3(0, -0.55, 0);
  const smile = prime(head, GEO.smile, mats.smile, 0, -0.12, 0.29, 'Smile');
  smile.eulerAngles = new Vec3(Math.PI - 0.2, 0, 0);
  prime(head, GEO.band, mats.accent, 0, 0.1, 0, 'Band');
  const ribbon = joint(head, 0, 0.12, -0.32, 'Ribbon');
  const ribbonMesh = spawnBox(ribbon, 'limb', 0.14, 0.04, 0.55, 0, 0, -0.27, 'RibbonMesh');
  ribbonMesh.getComponent(MeshRenderer)!.material = mats.accent;

  // 立体碎发组（v2）：主发团 + 三缕风刺 + 层叠刘海 + 双鬓发簇
  const hairGroup = joint(head, 0, 0, 0, 'HairGroup');
  const crown = prime(hairGroup, GEO.hairCrown, mats.hair, 0, 0.22, -0.05, 'Crown');
  crown.eulerAngles = new Vec3(-0.32, 0, 0);
  const spike1 = prime(hairGroup, GEO.hairSpike, mats.hair, -0.1, 0.32, -0.02, 'Spike1');
  spike1.eulerAngles = new Vec3(-0.5, 0, 0);
  const spike2 = prime(hairGroup, GEO.hairSpike, mats.hair, 0.1, 0.33, -0.04, 'Spike2');
  spike2.eulerAngles = new Vec3(0, 0, -0.2);
  const spike3 = prime(hairGroup, GEO.hairSpike, mats.hair, 0, 0.36, -0.12, 'Spike3');
  spike3.eulerAngles = new Vec3(-0.9, 0, 0);
  const bang = spawnBox(hairGroup, 'limb', 0.34, 0.14, 0.2, 0, 0.25, 0.16, 'Bang');
  bang.getComponent(MeshRenderer)!.material = mats.hair;
  bang.eulerAngles = new Vec3(0.32, 0, 0);
  const tuftGeoRotZ = 0.6;
  const tuftL = prime(hairGroup, GEO.hairTuft, mats.hair, -0.25, 0.12, 0.05, 'TuftL');
  tuftL.eulerAngles = new Vec3(0, 0, tuftGeoRotZ);
  const tuftR = prime(hairGroup, GEO.hairTuft, mats.hair, 0.25, 0.12, 0.05, 'TuftR');
  tuftR.eulerAngles = new Vec3(0, 0, -tuftGeoRotZ);
  const skinAccHead = joint(head, 0, 0, 0, 'SkinAccHead');

  // 腿：髋 → 大腿 → 膝 → 小腿 → 踝(脚步滚动) → 鞋 + 鞋底 + 后跟提环
  const createLeg = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;
    const hip = joint(torso, side * 0.2, 0.08, 0, isLeft ? 'HipL' : 'HipR');
    prime(hip, GEO.thigh, mats.clothBottom, 0, -0.19, 0, 'Thigh');
    const knee = joint(hip, 0, -0.38, 0, isLeft ? 'KneeL' : 'KneeR');
    prime(knee, GEO.calf, mats.skin, 0, -0.19, 0, 'Calf');
    const foot = joint(knee, 0, -0.36, 0, isLeft ? 'FootL' : 'FootR');
    const shoe = spawnBox(foot, 'limb', 0.18, 0.14, 0.34, 0, -0.07, 0.06, 'Shoe');
    shoe.getComponent(MeshRenderer)!.material = mats.shoes;
    const sole = spawnBox(foot, 'limb', 0.19, 0.05, 0.36, 0, -0.135, 0.06, 'Sole');
    sole.getComponent(MeshRenderer)!.material = mats.white;
    const heel = spawnBox(foot, 'limb', 0.14, 0.06, 0.03, 0, -0.07, -0.135, 'Heel');
    heel.getComponent(MeshRenderer)!.material = mats.accent;
    return { hip, knee, foot };
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

  // 砖垛挂点：胸前手抱位（AI Studio 母本方案；相机已调高成俯视追尾使其可见）
  const plankMount = joint(torso, 0, 0.58, 0.62, 'PlankMount');

  return { root, torso, head, ribbon, leftArm, rightArm, leftLeg, rightLeg, plankMount };
}

// ---------- 动画（移植自母本 animateCharacter v2，含负重平衡/脚步滚动/铺桥推掷） ----------
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}
function rot(n: Node, x: number, y = 0, z = 0): void {
  n.eulerAngles = new Vec3(x, y, z);
}

export function animateCharacter(r: CharRig, runCycle: number, steerVel: number, planks: number, state: CharState, dt: number, pickupPulse = 0): void {
  if (state === 'drowned') {
    r.root.eulerAngles = new Vec3(lerp(r.root.eulerAngles.x, Math.PI / 2, dt * 5), r.root.eulerAngles.y, lerp(r.root.eulerAngles.z, 0.6, dt * 4));
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
  // 负重反作用平衡（v2）：搬得越多躯干抗压后仰
  const loadFactor = Math.min(planks / 25, 1.0);
  r.torso.eulerAngles = new Vec3(
    0.18 - loadFactor * 0.08,
    Math.sin(runCycle) * 0.08,
    lerp(r.torso.eulerAngles.z, -steerVel * 0.32, dt * 12),
  );
  r.torso.setPosition(new Vec3(r.torso.position.x, 0.72 + Math.abs(stride) * 0.12, r.torso.position.z));
  rot(r.head, -r.torso.eulerAngles.x * 0.8, -r.torso.eulerAngles.y * 0.5);
  rot(r.ribbon, -0.35 + Math.sin(runCycle * 2.5) * 0.22, Math.cos(runCycle * 2) * 0.15);
  // 国风飘带/雉翎动力学模拟
  const accH = r.head.getChildByName('SkinAccHead');
  if (accH) {
    const plumeL = accH.getChildByName('PlumeL');
    const plumeR = accH.getChildByName('PlumeR');
    if (plumeL && plumeR) {
      const pw = Math.sin(runCycle * 2.8) * 8.5;
      plumeL.eulerAngles = new Vec3(-37 + pw, -10, -7);
      plumeR.eulerAngles = new Vec3(-37 + pw, 10, 7);
    }
  }
  const accT = r.torso.getChildByName('SkinAccTorso');
  if (accT) {
    const silkL = accT.getChildByName('SilkL');
    const silkR = accT.getChildByName('SilkR');
    if (silkL && silkR) {
      const sw = Math.sin(runCycle * 2.6) * 14;
      silkL.eulerAngles = new Vec3(-23 + sw, -9, -6);
      silkR.eulerAngles = new Vec3(-23 + sw, 9, 6);
    }
  }
  // 腿：髋摆 + 膝屈
  rot(r.leftLeg.hip, stride * 0.82);
  rot(r.leftLeg.knee, stride > 0 ? 0.1 : Math.max(0, -stride * 1.35));
  rot(r.rightLeg.hip, -stride * 0.82);
  rot(r.rightLeg.knee, -stride > 0 ? 0.1 : Math.max(0, stride * 1.35));
  // 脚踝滚动（v2）：前摆脚跟触地 +0.28，后摆脚尖蹬地 -0.45
  const rollL = stride > 0 ? (stride > 0.4 ? 0.28 : -0.1) : -stride * 0.45;
  const rollR = -stride > 0 ? (-stride > 0.4 ? 0.28 : -0.1) : stride * 0.45;
  r.leftLeg.foot.eulerAngles = new Vec3(lerp(r.leftLeg.foot.eulerAngles.x, rollL, dt * 16), 0, 0);
  r.rightLeg.foot.eulerAngles = new Vec3(lerp(r.rightLeg.foot.eulerAngles.x, rollR, dt * 16), 0, 0);
  // 铺桥推掷（v2）：bridging 时双臂高频下推
  const thrust = state === 'bridging' ? Math.sin(runCycle * 3.5) * 0.22 : 0;
  const pickupPhase = Math.sin(Math.min(1.0, pickupPulse) * Math.PI);
  const pulseSquash = pickupPulse * 0.08;

  if (planks > 0 || pickupPulse > 0.04) {
    // 左手：始终环抱、紧扣胸前砖垛（单手抱住物品）
    r.leftArm.shoulder.eulerAngles = new Vec3(0.65 + Math.sin(runCycle) * 0.04 + thrust, -0.32, 0.38 + loadFactor * 0.1);
    r.leftArm.elbow.eulerAngles = new Vec3(-1.48 + thrust * 0.4, 0, 0);

    // 右手：拾取时触发下探捞拾动作，平常辅助扶持
    if (pickupPulse > 0.02) {
      r.rightArm.shoulder.eulerAngles = new Vec3(
        lerp(0.48, 1.35, pickupPhase),
        lerp(0.22, -0.22, pickupPhase),
        lerp(-0.22, -0.42, pickupPhase),
      );
      r.rightArm.elbow.eulerAngles = new Vec3(lerp(-1.22, -0.32, pickupPhase), 0, 0);
    } else if (planks > 0) {
      r.rightArm.shoulder.eulerAngles = new Vec3(0.48 - Math.sin(runCycle) * 0.06 + thrust, 0.22, -0.22 - loadFactor * 0.08);
      r.rightArm.elbow.eulerAngles = new Vec3(-1.22 + thrust * 0.5, 0, 0);
    } else {
      rot(r.rightArm.shoulder, stride * 0.8, 0, -0.15);
      rot(r.rightArm.elbow, -0.6);
    }
  } else {
    rot(r.leftArm.shoulder, -stride * 0.8, 0, 0.15);
    rot(r.leftArm.elbow, -0.6);
    rot(r.rightArm.shoulder, stride * 0.8, 0, -0.15);
    rot(r.rightArm.elbow, -0.6);
  }
  // 砖垛惯性：越重甩尾越猛（v2）
  const inertia = 0.4 + loadFactor * 0.4;
  r.plankMount.eulerAngles = new Vec3(0.04 + Math.sin(runCycle * 2) * 0.04, 0, lerp(r.plankMount.eulerAngles.z, -steerVel * inertia, dt * 10));
}
