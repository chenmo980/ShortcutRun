# 桥版规则母本包（Qoder → step-5）

> AI-HANDOFF v2 §5 任务 Q2/Q3/Q4 的交付物。本目录是 Qoder 投递区：step-5 只读取、移植，不修改。
> 运行验证：`node docs/qoder/sim.mjs`（无 cc、无 DOM、无安装依赖，Node ≥ 22.6）

## 文件

| 文件 | 内容 |
|---|---|
| `bridge-rules.mjs` | 规则母本：关卡生成 + 运行时规则镜像 + bot 模拟器 + v2/v2.1/v3 修复 |
| `levels.mjs` | 关卡进阶：`cfgForLevel(level)` L1-L10 曲线 + 循环加深 + 三套验收带（bandFor/marginFor/ratioFor） |
| `progression.mjs` | 关卡推进元规则：局内循环（进关/重试换图/星级/持久化），存储适配器注入 |
| `sim.mjs` | headless 断言套件（20 项：parity / 不变量 / 缺陷率 / 通关率 / v3 根治 / 失误人形胜率曲线 / 循环互操作 / 高段平台回归锁） |

## 接口签名（bridge-rules.mjs）

```
DEFAULT_CFG: Cfg 数值表           // 与 assets/scripts/config.ts 镜像，唯一差异以本文件为准后回写
mulberry32(seed) -> rnd()         // 同种子同序列
genLevel(seed, cfg, opts?) -> LevelDef // opts.tailSafe（默认 false）把末崖钳回 length-14 前；默认行为与 LevelGen.ts 位级一致（sim.mjs §1）
levelStats(level, cfg) -> { obtainable, need, ok }
zonesOf(level) -> [[z0,z1], ...]  // 可跑区间（断崖之间 + 首尾段）
prefixBalance(level, cfg) -> { perZone, surplus, feasible, minSurplus, minAt }
genLevelV2(seed, cfg) -> LevelDef // 可行版（D2 修复 + v2.1 间距），签名与 genLevel 一致
genLevelV3(seed, cfg, opts?) -> LevelDef // ★ 推荐移植目标：tailSafe（D1 根治）+ 双重供给修复：每前缀点 余量>=cfg.supplyMargin 且 累计供给>=cfg.supplyRatio×累计需求
spaceOutPickups(level, zones, minGap?) // v2.1：V2/V3 内部已调用，导出的仅为测试可见
HUMAN_AVG = { pMiss:.25, reactSec:.18, jitter:.35, lateralMax:6.5 } // 「平均玩家」QA 标准参数
botRun(level, cfg, opts?) -> { outcome:'win'|'fall'|'short'|'timeout', bricks, t, ... }
                                // opts 缺省=零失误贪心（可达性上限）；传 HUMAN_AVG+seed=失误人形（真实难度口径）
```

## 接口签名（levels.mjs）

```
cfgForLevel(level, base=DEFAULT_CFG) -> Cfg // level 从 1 起；L1-L10 查表，第 11 关起按 f=1+loop*0.1 循环加深；返回值含 supplyMargin/supplyRatio 字段，直接喂 genLevelV3
bandFor(level) -> 0.95|0.90|0.80            // 分段贪心 bot 胜率验收带（L1-3 / L4-7 / L8-10）——只是可达性上限
marginFor(level) -> 4|2|1                   // 分段前缀余量带（块）：绝对容错
ratioFor(level) -> 2.0|1.8|1.55             // 分段供给倍率：每前缀点累计供给 >= k×累计需求（真人胜率曲线的实际调节旋钮）
                                            // 注意人形有效拾取率≈0.62，k 实际下限≈1/0.62≈1.6，cfgForLevel 内已夹到 1.5 地板
```

## 接口签名（progression.mjs）

```
STORAGE_KEY = 'shortcut_run_progress_v1'
createProgress(store) -> prog   // store: {getItem(k), setItem(k,v)}——web 传 localStorage，Cocos 用 sys.localStorage 包同名适配
prog.current(cfgForLevel) -> { level, seed, cfg }  // 每次进场调一次；seed=level*1000+attempt（失败换图，每图可复现）
prog.win(timeSec, bricksLeft) -> { nextLevel, stars, best } // 记成绩→进关→attempt 归 1
prog.lose() -> { level, seed }  // 同关 attempt++（换图）
prog.starsFor(level, timeSec, bricksLeft) -> 1|2|3 // 时间星=低于 PAR 线；余砖星=bricks>=3
prog.state() / prog.reset()
```

`LevelDef = { length, gaps:[{zStart,zEnd,cost}], pickups:[{x,z}], gateZ, gateCost }`——与 §4 契约一致。

## sim.mjs 实测结论（2000 seeds / 60 seeds 每关，v1 = 现网 LevelGen.ts）

1. **parity 通过**：JS 母本与 TS 实现 200 seeds 逐字节一致 → 移植基线可靠（genLevel 默认行为从未改过，此断言永久有效）。
2. **发现缺陷 D1（严重）**：`while (z < length-14)` 允许最后一个断崖尾 `zEnd` 越过 `gateZ-8`，末段可跑区间 <6m 时兜底补砖循环直接 `break` → **2.75%（55/2000）的关卡全局砖不足，数学上不可能通关**。玩家表现为"莫名其妙到门就输"。
3. **发现缺陷 D2（严重）**：全局 `obtainable>=need` 是必要非充分。玩家顺序前进，走到第 i 崖只花得起前 i 段的砖；v1 有 **16.4%（328/2000）关卡存在前缀死局**（某崖累计余砖 <0）。贪心 bot 实测 v1 通关率仅 **82%**（246/300），即近 1/5 的关卡对"会玩"的玩家也不公平。
4. **genLevelV2 修复**：兜底补砖改为"补进最早缺砖的可跑区间"（独立子种子保持确定性）。修复后：前缀死局 0/2000、全局缺砖 0/2000、bot 通关率 **300/300 = 100%**。
5. **难度曲线基线**（v2，60 seeds/关）：L1→L8 平均断崖 5.7→14.7，bot 用时 21.2s→38.9s，见 `docs/drafts/balance-v1.md`。
6. **v2.1 拾取间距修复**（balance-v1 已知风险 1 的根治）：同一区间两个拾取 z 间距强制 >=4m（窄区间均匀摊兜底），消除"同 z 分居两侧、只能二选一"的贪心死角。纯几何挪位，不改供需。实测：7685 对同区间拾取全部达标；L1 bot 胜率 59/60 → **60/60**。
7. **L1-L10 分段验收**（levels.mjs + v2.1，60 seeds/关）：bot 胜率 **全档 60/60**，带内全绿；avgT L1=17.1s → L10=23.6s（逐关非严格单调，各级提速会抵消长度增长，属预期，故只断言 L1<L10）。
8. **v3：D1 几何根治**。v2 仍存 D1 几何残留（末崖压门，进阶 cfg 下 8~30%）。v3 的 tailSafe 把末崖恒钳在 `length-14` 前：degen 337/2000 → **0/2000**。
9. **失误人形 bot（本轮最重要发现）**：给 botRun 加 HUMAN_AVG 模型（漏吃25%/反应180ms/瞄准±35cm/横移6.5），归因实测：反应+横移、瞄准单独跑全部 100%，**唯漏吃骰 25% 单开就把 L7 打到 0%**——此前所有"margin 加法容错"假设错误，供给必须按需求倍率溢出。genLevelV3 修复目标升级为双条件（余量>=margin 且 累计供给>=k×累计需求），k 带经扫参定为 2.0/1.8/1.55。最终真人曲线：**L1-7 = 89/88/83/80/81/81/77%，L8-10 = 52/61/47%**，short/timeout 型死法 ≤3%（供给失效归零，失败收敛到"砖不够掉崖"单一可读机制）。贪心 60/60 + 人形带内 = 双口径同时过线。
10. **L11+ 循环加深重做（防终局死亡墙）**：旧加深规则（f=1+loop*0.1 线性收紧 k）实测 L28+ 人形胜率崩至 3~13%、每循环开头骤降 30pt。新规则：加深 2 个 loop 即饱和（f 封顶 1.1）+ `gateCost×f²` + k 夹 **1.5 地板**（人形有效拾取率≈0.62，k<1/0.62≈1.6 后密度越高越饿死）+ 长度每 loop +20m（换图不更脸维持新鲜）。实测 L11-30 = 83→53 心跳锯齿平台、无非缺砖崩墙，§13 回归锁禁 <25% 墙。
11. **step-5 TS 移植已被机验**：`sim.mjs §14` 对 LevelGen.ts 的 genLevelV3 做 1000 seeds×L1-L10 逐字节 parity，当前 **全绿**。注意 opts 键名口径：母本是 `opts.supplyRatio`，你们 TS 用了 `opts.ratio`——cfg.supplyRatio 主路径一致，但请对齐命名防显式传参错位。

12. **预览内联生成器 parity 机验 + §16 永久锁**：verify-web dump 中曾见 6 个修复补点 x 完全相同（-0.8409）疑似子种子复用缺陷；复核时 step-5 已改为每 guard 重生成 `mulberry32(seed*7919+guard)`，现内联 genLevelV3 与母本 **100/100 逐字节一致**。该比对固化为 `sim.mjs §16`（抽取 index.html `function mulberry32` → "关卡进阶曲线"标记整段 vm 执行），与 §15b 曲线锁分层：曲线漂了 §15b 报警，几何漂了 §16 报警。

## 移植要求（给 step-5）

- **移植目标 = `genLevelV3`**（一次到位，含 v2 前缀修复 + v2.1 间距 + tailSafe + margin）。你们已移植的 TS 版 genLevelV2 与母本 v2.1/v3 输出已有逐 seed 差异，替换后按 §1 口径重跑 parity（v1 基线永不变，可作为移植正确性的锚）。
- 接入方式：`cfg = cfgForLevel(level, CFG)`（levels.mjs，含 supplyMargin 字段）→ `genLevelV3(seed, cfg)`；种子建议 `seed = level*1000 + attempt`（同关重开同图，换关换图）。
- **保留 D1/D2/间距/margin 断言进 tools/smoke**，防止回归。
- `botRun` 是 QA 工具不进游戏包体，留在 `tools/` 层。
- **关卡循环已接入（本条关闭）**：GameApp `genLevelV3(levelNum*1000+attempt)` 与 web-preview `buildLevel(lv,att)` 均已按母本 seed 口径落地。剩余跨重启项：按 `progression.mjs` 接持久化（web: localStorage 适配器 `createProgress({getItem,setItem})`；Cocos: sys.localStorage 包同名方法），当前预览刷新页面回到 L1。
