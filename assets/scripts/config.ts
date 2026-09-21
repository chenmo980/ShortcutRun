// ============================================================
// Shortcut Run 复刻 · 灰模原型 v0.1
// 全局手感/关卡参数 —— 原型阶段 90% 的调参都在这个文件里
// ============================================================

export interface Cfg {
  // ---- 角色手感 ----
  runSpeed: number;        // 初始前进速度 (m/s)
  speedPerBrick: number;   // 每携带 1 块砖的加速度（砖越多跑得越快）
  maxSpeed: number;        // 速度上限
  steerSpeed: number;      // 横向移动插值系数（越大越跟手，典型 8~15）
  steerPerPixel: number;   // 滑动灵敏度：每像素对应的横向位移
  keySteerSpeed: number;   // 键盘按住时横向移动速度 (m/s)
  trackHalfWidth: number;  // 跑道半宽（米）

  // ---- 关卡 ----
  levelLength: number;     // 关卡总长（米）
  gapWidthMin: number;     // 断崖最小宽度
  gapWidthMax: number;     // 断崖最大宽度
  gapIntervalMin: number;  // 两个断崖之间的最小间隔
  gapIntervalMax: number;  // 两个断崖之间的最大间隔
  brickCluster: number;    // 每组拾取 = 几块砖
  gateCost: number;        // 终点门需要的砖数

  // ---- 视觉（灰模） ----
  brickUnit: number;       // 砖块立方体边长

  // ---- 相机 ----
  camOffsetY: number;      // 相机高度
  camOffsetZ: number;      // 相机在角色身后多远（负数）
  camLerp: number;         // 相机跟随平滑系数
  camXFactor: number;      // 相机横向跟随比例 0~1（0.6 左右最有跟随感）
}

export const CFG: Cfg = {
  runSpeed: 6,
  speedPerBrick: 0.08,
  maxSpeed: 10,
  steerSpeed: 10,
  steerPerPixel: 0.022,
  keySteerSpeed: 4,
  trackHalfWidth: 2.6,

  levelLength: 150,
  gapWidthMin: 2.5,
  gapWidthMax: 4.5,
  gapIntervalMin: 16,
  gapIntervalMax: 26,
  brickCluster: 4,
  gateCost: 14,

  brickUnit: 0.3,

  camOffsetY: 5.2,
  camOffsetZ: -7.5,
  camLerp: 6,
  camXFactor: 0.6,
};
