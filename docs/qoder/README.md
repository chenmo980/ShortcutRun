# 桥版规则母本包（Qoder → step-5）

> AI-HANDOFF v2 §5 任务 Q2/Q4 的交付物。本目录是 Qoder 投递区：step-5 只读取、移植，不修改。
> 运行验证：`node docs/qoder/sim.mjs`（无 cc、无 DOM、无安装依赖，Node ≥ 22.6）

## 文件

| 文件 | 内容 |
|---|---|
| `bridge-rules.mjs` | 规则母本：关卡生成 + 运行时规则镜像 + bot 模拟器 + v2 修复 |
| `sim.mjs` | headless 断言套件（parity / 不变量 / 缺陷率 / 通关率 / 难度曲线） |

## 接口签名（bridge-rules.mjs）

```
DEFAULT_CFG: Cfg 数值表           // 与 assets/scripts/config.ts 镜像，唯一差异以本文件为准后回写
mulberry32(seed) -> rnd()         // 同种子同序列
genLevel(seed, cfg) -> LevelDef   // 与 LevelGen.ts 逐 seed 位级一致（sim.mjs 断言 1）
levelStats(level, cfg) -> { obtainable, need, ok }
zonesOf(level) -> [[z0,z1], ...]  // 可跑区间（断崖之间 + 首尾段）
prefixBalance(level, cfg) -> { perZone, surplus, feasible, minSurplus, minAt }
genLevelV2(seed, cfg) -> LevelDef // 修复版（见下），签名与 genLevel 一致，可直接替换
botRun(level, cfg, opts?) -> { outcome:'win'|'fall'|'short'|'timeout', bricks, t, ... }
```

`LevelDef = { length, gaps:[{zStart,zEnd,cost}], pickups:[{x,z}], gateZ, gateCost }`——与 §4 契约一致。

## sim.mjs 实测结论（2000 seeds，v1 = 现网 LevelGen.ts）

1. **parity 通过**：JS 母本与 TS 实现 200 seeds 逐字节一致 → 移植基线可靠。
2. **发现缺陷 D1（严重）**：`while (z < length-14)` 允许最后一个断崖尾 `zEnd` 越过 `gateZ-8`，末段可跑区间 <6m 时兜底补砖循环直接 `break` → **2.75%（55/2000）的关卡全局砖不足，数学上不可能通关**。玩家表现为"莫名其妙到门就输"。
3. **发现缺陷 D2（严重）**：全局 `obtainable>=need` 是必要非充分。玩家顺序前进，走到第 i 崖只花得起前 i 段的砖；v1 有 **16.4%（328/2000）关卡存在前缀死局**（某崖累计余砖 <0）。贪心 bot 实测 v1 通关率仅 **82%**（246/300），即近 1/5 的关卡对"会玩"的玩家也不公平。
4. **genLevelV2 修复**：兜底补砖改为"补进最早缺砖的可跑区间"（独立子种子保持确定性）。修复后：前缀死局 0/2000、全局缺砖 0/2000、bot 通关率 **300/300 = 100%**。
5. **难度曲线基线**（v2，60 seeds/关）：L1→L8 平均断崖 5.7→14.7，bot 用时 21.2s→38.9s，见 `docs/drafts/balance-v1.md`。

## 移植要求（给 step-5）

- `LevelGen.ts` 的 `genLevel` 替换为 `genLevelV2` 等价实现（或先 `genLevel` 后 `repairPrefix(level, cfg, seed)`），**保留 D1/D2 断言进 tools/smoke**，防止回归。
- 移植后 parity 方向反转：TS 版必须与 `bridge-rules.mjs` 的 `genLevelV2` 逐 seed 一致。
- `botRun` 是 QA 工具不进游戏包体，留在 `tools/` 层。
