// 程序化灰盒工厂：不依赖任何 prefab/mesh 资源，实现零装配
// 用法依据引擎源码实锤（Material.initDefault）：
//   initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } }) + setProperty('mainColor', Color)
// builtin-unlit 不受光影响，场景里不需要放灯
const { ccclass } = _decorator;
import { _decorator, Node, Vec3, Mesh, MeshRenderer, Material, utils, primitives, Color } from 'cc';

export type BoxKind = 'road' | 'ground' | 'brick' | 'bridge' | 'player' | 'limb' | 'skin' | 'gate' | 'pillar';

export const COLORS: Record<BoxKind, Color> = {
  road: new Color(154, 162, 171, 255),
  ground: new Color(91, 122, 94, 255),
  brick: new Color(255, 213, 79, 255),
  bridge: new Color(176, 137, 104, 255),
  player: new Color(79, 195, 247, 255),
  limb: new Color(33, 150, 243, 255),
  skin: new Color(255, 224, 178, 255),
  gate: new Color(239, 83, 80, 255),
  pillar: new Color(84, 110, 122, 255),
};

let sharedMesh: Mesh | null = null;
const matCache = new Map<BoxKind, Material>();

function getMesh(): Mesh {
  if (!sharedMesh) {
    sharedMesh = utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
  }
  return sharedMesh;
}

function getMaterial(kind: BoxKind): Material {
  let m = matCache.get(kind);
  if (!m) {
    m = new Material();
    m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true }, technique: 0 });
    m.setProperty('mainColor', COLORS[kind]);
    matCache.set(kind, m);
  }
  return m;
}

// 造一个彩色盒子：共享一份网格，按颜色共享材质，几百个盒子也不卡
export function spawnBox(parent: Node, kind: BoxKind, sx: number, sy: number, sz: number, x: number, y: number, z: number): Node {
  const n = new Node('Box');
  n.parent = parent;
  const mr = n.addComponent(MeshRenderer);
  mr.mesh = getMesh();
  mr.material = getMaterial(kind);
  n.setScale(new Vec3(sx, sy, sz));
  n.setPosition(new Vec3(x, y, z));
  return n;
}
