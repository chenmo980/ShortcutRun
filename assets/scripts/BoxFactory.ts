// 程序化灰盒工厂：不依赖任何 prefab/mesh 资源，实现零装配
// 用法依据引擎源码实锤（Material.initDefault）：
//   initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } }) + setProperty('mainColor', Color)
// builtin-unlit 不受光影响，场景里不需要放灯
const { ccclass } = _decorator;
import { _decorator, Node, Vec3, Mesh, MeshRenderer, Material, utils, primitives, Color } from 'cc';
import { currentTheme, colorOf } from './Theme';

export type BoxKind = 'road' | 'ground' | 'brick' | 'bridge' | 'player' | 'limb' | 'skin' | 'gate' | 'pillar';

let sharedMesh: Mesh | null = null;
let colors: Record<BoxKind, Color> = buildColors();
const matCache = new Map<BoxKind, Material>();

function buildColors(): Record<BoxKind, Color> {
  const t = currentTheme();
  return {
    road: colorOf(t.road), ground: colorOf(t.ground), brick: colorOf(t.brick),
    bridge: colorOf(t.bridge), player: colorOf(t.player), limb: colorOf(t.limb),
    skin: colorOf(t.skin), gate: colorOf(t.gate), pillar: colorOf(t.pillar),
  };
}

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
    m.setProperty('mainColor', colors[kind]);
    matCache.set(kind, m);
  }
  return m;
}

// 换主题：重建色表 + 清材质缓存（材质按色缓存，不清不换色）
export function applyTheme(): void {
  colors = buildColors();
  matCache.clear();
}

// 造一个盒子：共享一份网格，按颜色共享材质，几百个盒子也不卡
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
