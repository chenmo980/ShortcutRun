// ============================================================
// Shortcut Run 复刻 · 灰模原型 v0.1
// 全局手感/关卡参数 —— 原型阶段 90% 的调参都在这个文件里
// ============================================================

export interface Cfg {
  // ---- 角色手感 ----
  runSpeed: number;        // 初始前进速度 (m/s)
  speedPerBrick: number;   // 每携带 1 块砖的加速度(砖越多跑得越快)
  maxSpeed: number;        // 速度上限
  steerSpeed: number;      // 横向移动插值系数(越大越跟手,典型 8~15)
  steerPerPixel: number;   // 滑动灵敏度:每像素对应的横向位移
  keySteerSpeed: number;   // 键盘按住时横向移动速度 (m/s)
  trackHalfWidth: number;  // 跑道半宽(米)

  // ---- 关卡 ----
  levelLength: number;     // 关卡总长(米)
  gapWidthMin: number;     // 断崖最小宽度
  gapWidthMax: number;     // 断崖最大宽度
  gapIntervalMin: number;  // 两个断崖之间的最小间隔
  gapIntervalMax: number;  // 两个断崖之间的最大间隔
  brickCluster: number;    // 每组拾取 = 几块砖
  gateCost: number;        // 终点门需要的砖数

  // ---- v3 供给修复参数(由 LevelCurve 按关卡设定,见 docs/qoder/levels.mjs) ----
  supplyMargin?: number;   // 每个前缀点至少剩余砖数(真人容错余量)
  supplyRatio?: number;    // 累计供给 >= k × 累计需求(漏吃 25% 时的溢出倍率)

  // ---- 弯道(我方表现层扩展,见 CurvePath.ts;amp=0 为直道) ----
  curveAmp?: number;       // 弯曲幅度(米)
  curveFreq?: number;      // 弯曲频率(每米弧度)
  curvePhase?: number;     // 相位(每关不同,弯形不重样)

  // ---- 自由铺板捷径(原版核心机制,离开主路持续耗板铺路) ----
  plankCostPerMeter?: number; // 离开主路后每米消耗板子
  plankStride?: number;       // 每多少米留一块板(视觉)
  offRoadBoost?: number;      // 铺捷径加速倍率(赌板子换速度)
  plankPoolMax?: number;      // 板子视觉池上限
  pickupRespawnSec?: number;  // M6: 砖堆被吃几秒后原地刷新(秒,0/缺省=不刷新)

  // ---- v4 道具(加砖门/倍数门/加速鞋,母本 bridge-rules v4) ----
  enableItems?: boolean;   // true 时由 GameApp 走 LevelCurve.itemsFor 分带;缺省关闭=输出与 v3 逐字节一致

  // ---- 视觉(灰模) ----
  brickUnit: number;       // 砖块立方体边长

  // ---- 相机 ----
  camOffsetY: number;      // 相机高度
  camOffsetZ: number;      // 相机在角色身后多远(负数)
  camLerp: number;         // 相机跟随平滑系数
  camXFactor: number;      // 相机横向跟随比例 0~1(0.6 左右最有跟随感)
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

  supplyMargin: 2,
  supplyRatio: 1,

  enableItems: false,

  brickUnit: 0.3,

  camOffsetY: 6.8,
  camOffsetZ: -8.8,
  camLerp: 6,
  camXFactor: 0.6,
};
