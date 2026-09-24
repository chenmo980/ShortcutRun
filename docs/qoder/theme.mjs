// ============================================================
// Q5 主题规范（art bible 数据版）—— Qoder 投递，AI-HANDOFF §5 Q5
// step-5 的 Theme.ts 十键契约照抄（sky/ground/road/brick/bridge/
// player/limb/skin/gate/pillar），另推荐 shoe 键（v4 加速鞋）。
// 这里不拍审美拍底线：可读性约束全部可机验（sim.mjs §20 同时验
// 本文件色板与你们 assets/Theme.ts 的 THEMES——今后加主题漂了红）。
// cc-free：纯数学，无 DOM 无 cc。
// ============================================================

// ---------- 颜色数学 ----------
export function rgbOf(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const toLinear = ([r, g, b]) => [lin(r), lin(g), lin(b)];
const sfrom = (c) => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
export function relLum(hex) {
  const [r, g, b] = toLinear(rgbOf(hex));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [relLum(a), relLum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
// HSL S/L（0..1）
function hsl(hex) {
  const [r, g, b] = rgbOf(hex).map((c) => c / 255);
  const [mx, mn] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const s = (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h;
  if (mx === r) h = ((g - b) / (mx - mn) + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / (mx - mn) + 2) / 6;
  else h = ((r - g) / (mx - mn) + 4) / 6;
  return { h, s: Math.min(1, s), l };
}
export const satOf = (hex) => hsl(hex).s;
export const hueOf = (hex) => hsl(hex).h * 360;
function hueGap(a, b) {
  const d = Math.abs(hueOf(a) - hueOf(b));
  return d > 180 ? 360 - d : d;
}
// 红/绿/蓝色盲模拟（Viénot–Brettel–Mollon 1999 经典矩阵，作用于线性 RGB，
// 近似保亮度；取三型最坏值=保守门禁）
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178771], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303985]],
};
function simulate(hex, kind) {
  const m = CVD[kind];
  const [r, g, b] = toLinear(rgbOf(hex));
  const [R, G, B] = m.map((row) => row[0] * r + row[1] * g + row[2] * b);
  return (sfrom(R) << 16) | (sfrom(G) << 8) | sfrom(B);
}
export function cvdWorst(a, b) {
  return Math.min(...Object.keys(CVD).map((k) => contrast(simulate(a, k), simulate(b, k))));
}

// ---------- 可读性约束 ----------
// 关键对判据 = 明度分离（WCAG 场景折减版）**或** 高饱和色相分离（蓝/橙这类
// 色盲安全对靠色相就够），再过一道三色盲残余下限。数值依据：
//   · 3D 场景有轮廓/阴影/动画加成，平面 WCAG 3:1 会误杀所有中间调地板盘，
//     故核心对取 2.2~2.4，配合 |ΔL| 或 hueGap 双通道。
//   · 砖 vs 路是最严对（收集物 2s 拾取窗口）；桥/角色次之；门看天不看路（拱门
//     立在天空背景里）。天空必须亮（休闲盘通法），路面不许抢戏（S<=0.55）。
const PAIRS = [
  // [a, b, 明度对比≥, 色相通道(hueGap≥°,minS≥), cvd残余≥]
  ['brick', 'road', 2.4, null, 1.55],
  ['bridge', 'road', 1.6, null, 1.25],
  ['player', 'road', 1.7, [70, 0.35], 1.35],
  ['player', 'brick', 1.35, [70, 0.35], 1.2],
  ['gate', 'road', 1.8, [90, 0.4], 1.35],
  ['gate', 'sky', 1.9, null, null],
  ['ground', 'sky', 1.3, null, null],
];

export const ROLE_KEYS = ['sky', 'ground', 'road', 'brick', 'bridge', 'player', 'limb', 'skin', 'gate', 'pillar'];

export function verifyTheme(t, opts = {}) {
  const night = opts.night === true || t.night === true;
  const bad = [];
  for (const k of ROLE_KEYS) {
    if (!(typeof t[k] === 'number' && t[k] >= 0 && t[k] <= 0xffffff)) bad.push(`缺键/坏值 ${k}`);
  }
  if (bad.length) return bad;
  for (const [a, b, cMin, hueAlt, cvdMin] of PAIRS) {
    if (night && a === 'gate' && b === 'sky') continue; // 夜盘门对暗天不要求明度序
    const x = t[a], y = t[b];
    let ok = contrast(x, y) >= cMin;
    if (!ok && hueAlt) ok = hueGap(x, y) >= hueAlt[0] && Math.min(satOf(x), satOf(y)) >= hueAlt[1];
    if (ok && cvdMin !== null) ok = cvdWorst(x, y) >= cvdMin;
    if (!ok) bad.push(`${a}vs${b}(c=${contrast(x, y).toFixed(2)} cvd=${cvdWorst(x, y).toFixed(2)} hue=${hueGap(x, y).toFixed(0)})`);
  }
  const L = relLum;
  if (!night) {
    if (!(L(t.sky) >= 0.38)) bad.push(`天空亮度${L(t.sky).toFixed(2)}<0.38`);
    if (!(Math.abs(L(t.sky) - L(t.road)) >= 0.15)) bad.push('天路明暗序');
  }
  if (!(satOf(t.brick) >= 0.5 && L(t.brick) >= 0.1 && L(t.brick) <= 0.9)) bad.push('砖饱和/明度带');
  if (!(satOf(t.gate) >= 0.5 && L(t.gate) <= 0.65)) bad.push('门饱和/明度带');
  if (!(satOf(t.road) <= 0.55)) bad.push('路面高饱和抢戏');
  if ('shoe' in t && !(contrast(t.shoe, t.road) >= 2.0)) bad.push('鞋不可见');
  return bad;
}

// ---------- 色板 ----------
// day 为规范盘（verifyTheme 实跑全过）；city/candy 是 step-5 现表的镜像，
// 仅作 §20 对照基准，不承诺过验——体检结论与修复表见下方 PROPOSALS。
export const PALETTES = {
  day: {
    // 回应"照抄原版+太丑"的首选盘——Voodoo 配方：中性深底跑道（原版棕土道）
    // 当底板，前景物全走高饱和且互为色盲安全轴（天蓝砖堆、奶白小人、大红门、
    // 柠檬鞋），明度双通道分离，任何单色觉缺陷下都数得清砖。
    name: '白天（原版）',
    sky: 0xaee6ff, ground: 0x43a047, road: 0x6d4c41, brick: 0x4dd0ff,
    bridge: 0xc98d4f, player: 0xffffff, limb: 0x90a4ae, skin: 0xffe0b2,
    gate: 0xff3b30, pillar: 0x263238, shoe: 0xffee58,
  },
  // 镜像 step-5 现表（city/candy），供 §20 与 assets/Theme.ts 双向核对（漂移=红）
  city: {
    name: '城市',
    sky: 0x8fb3d9, ground: 0x7d8a99, road: 0x3d444d, brick: 0xffc107,
    bridge: 0x8d6e63, player: 0x4fc3f7, limb: 0x2196f3, skin: 0xffe0b2,
    gate: 0xe53935, pillar: 0x455a64,
  },
  candy: {
    name: '糖果',
    sky: 0xffd9e8, ground: 0xb8e6c1, road: 0xff8fab, brick: 0xfff176,
    bridge: 0xce93d8, player: 0x64b5f6, limb: 0x42a5f5, skin: 0xffe0b2,
    gate: 0xff7043, pillar: 0xab47bc,
  },
};

// ---------- 对你们现表的体检结论 + 最小改动修复表（全部实跑过验） ----------
// city：仅 1 项不过——淡蓝角色 vs 琥珀砖明度同为 ~0.5，绿色盲模拟下对比塌到
//   1.00（同亮度异色相在 deutan 里=同色）。改 player 一个键即全过，城市 ident 不变。
// candy：7 项不过——粉路/黄砖/粉紫桥全是中间调浅色系互叠，拾取物在路面
//   上几乎消失（砖路常视对比 1.85）。修复表保留糖果身份（粉天/紫砖/薄荷地），
//   只把"浅底放深物"的配方摆正。若想保留 candy 作换肤链路 QA 专测盘，
//   在 Theme.ts 里给它 name 加「(QA)」前缀即可，§20 跳过 QA 盘。
export const PROPOSALS = {
  city: {
    name: '城市',
    sky: 0x8fb3d9, ground: 0x7d8a99, road: 0x3d444d, brick: 0xffc107,
    bridge: 0x8d6e63, player: 0x0288d1, limb: 0x2196f3, skin: 0xffe0b2,
    gate: 0xe53935, pillar: 0x455a64,
  },
  candy: {
    name: '糖果',
    sky: 0xffe4ef, ground: 0x66bb6a, road: 0xd8b8ca, brick: 0xab27d3,
    bridge: 0x4e342e, player: 0xffffff, limb: 0xbdbdbd, skin: 0xffe0b2,
    gate: 0xc51162, pillar: 0x6a1b9a, shoe: 0x006064,
  },
};

export function verifyAll() {
  const out = {};
  out['day'] = verifyTheme(PALETTES.day);
  for (const [k, t] of Object.entries(PROPOSALS)) out[`proposal-${k}`] = verifyTheme(t);
  for (const [k, t] of Object.entries(ARTSTUDIO)) out[`artstudio-${k}`] = verifyTheme(t);
  return out;
}

// ---------- art-studio 四盘（用户 2026-09-22 重制版调色板，保身份最小修复，全部实跑过验） ----------
// 来源 origin/main(=art-studio 分支) src/data/themes.ts；night 盘走夜/昏豁免通道。
// 每盘注释 = 相对原盘的改动键。详见 docs/qoder/art-pack.md。
export const ARTSTUDIO = {
  voodoo: {
    // 原盘砖#FFB703/桥#E2E8F0 在白道上不可见，player 由品红改青蓝（品红vs棕砖色盲塌陷）
    name: 'VOODOO 经典马卡龙',
    sky: 0xbee1e6, ground: 0x48cae4, road: 0xffffff, brick: 0xb45309,
    bridge: 0x94a3b8, player: 0x06b6d4, limb: 0x3a86ff, skin: 0xffe0b2,
    gate: 0x8338ec, pillar: 0x1098f7,
  },
  tropical: {
    // 沙滩跑道去饱和提亮为白沙（原#E9D8A6 抢戏+天路明暗序违规），砖深一档
    name: '热带海岛微风',
    sky: 0xc8e7f5, ground: 0x00b4d8, road: 0xf5f5f4, brick: 0xd97706,
    bridge: 0x8b5e34, player: 0x005f73, limb: 0x94d2bd, skin: 0xffe0b2,
    gate: 0xae2012, pillar: 0x0077b6,
  },
  sunset: {
    name: '落日金辉余晖', night: true,
    sky: 0x6d28d9, ground: 0x0e7490, road: 0xe8dcc4, brick: 0xb91c1c,
    bridge: 0x7c2d12, player: 0x1e40af, limb: 0xfde047, skin: 0xffe0b2,
    gate: 0xdc2626, pillar: 0x581845,
  },
  cyberpunk: {
    // 海平线加发光青（原水色与夜空在暗端糊成一团，groundvssky 1.11）
    name: '赛博霓虹夜跑', night: true,
    sky: 0x0d0826, ground: 0x0e7490, road: 0x1a1e29, brick: 0x00f5d4,
    bridge: 0x7000ff, player: 0xff007f, limb: 0xfee440, skin: 0xffe0b2,
    gate: 0x9b5de5, pillar: 0x050517,
  },
};

// CLI：node theme.mjs → 打印规范盘+修复盘+ARTSTUDIO 全表验光结果，有不过者 exit 1
if (process.argv[1] && process.argv[1].split('\\').join('/').endsWith('theme.mjs')) {
  const r = verifyAll();
  let bad = 0;
  for (const [k, v] of Object.entries(r)) {
    console.log(v.length ? `FAIL ${k}: ${v.join(' ; ')}` : `PASS ${k}`);
    bad += v.length ? 1 : 0;
  }
  process.exit(bad ? 1 : 0);
}
