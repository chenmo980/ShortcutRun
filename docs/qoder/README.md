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
                                          // v4 道具：opts.items={addGates,mulGates,shoes,addValue?,mulValue?}（itemsFor(lv) 给分带）；缺省/cfg.enableItems=false 时输出与 v3 逐字节一致（§19 sha 锚）
spaceOutPickups(level, zones, minGap?) // v2.1：V2/V3 内部已调用，导出的仅为测试可见
HUMAN_AVG = { pMiss:.25, reactSec:.18, jitter:.35, lateralMax:6.5 } // 「平均玩家」QA 标准参数
botRun(level, cfg, opts?) -> { outcome:'win'|'fall'|'short'|'timeout', bricks, t, ... }
                                // opts 缺省=零失误贪心（可达性上限）；传 HUMAN_AVG+seed=失误人形（真实难度口径）
                                // v4 道具镜像：过 gates 触发 add:+v / mul:×v；吃 kind:'shoe' 后 speed×shoeMul(1.35) 持续 shoeDur(3.5s)；chaseShoes=false 时 bot 不为鞋绕路
```

## 接口签名（levels.mjs）

```
cfgForLevel(level, base=DEFAULT_CFG) -> Cfg // level 从 1 起；L1-L10 查表，第 11 关起按 f=1+loop*0.1 循环加深；返回值含 supplyMargin/supplyRatio 字段，直接喂 genLevelV3
bandFor(level) -> 0.95|0.90|0.80            // 分段贪心 bot 胜率验收带（L1-3 / L4-7 / L8-10）——只是可达性上限
marginFor(level) -> 4|2|1                   // 分段前缀余量带（块）：绝对容错
ratioFor(level) -> 2.0|1.8|1.55             // 分段供给倍率：每前缀点累计供给 >= k×累计需求（真人胜率曲线的实际调节旋钮）
                                            // 注意人形有效拾取率≈0.62，k 实际下限≈1/0.62≈1.6，cfgForLevel 内已夹到 1.5 地板
itemsFor(level) -> null|{addGates,mulGates,shoes,addValue:5,mulValue:2} // v4 道具分带：L1-2（含每 loop 前两关）null 教学不带；L3 +1 扇 +N 门；L4 起 +×2 门；L6 起 +加速鞋；loop 微增（门/鞋随循环加，封顶 +1 门/+2 鞋）。cfgForLevel 不含道具 key（§15 曲线锁不红），接入只此一处
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

## 接口签名（theme.mjs，Q5）

```
ROLE_KEYS = 十键契约（照抄 assets/Theme.ts）+ 可选 shoe
verifyTheme(theme) -> violations[]   // 纯函数：关键对 WCAG 对比（2.2~2.4 场景折减带）
                                     // ∨ 高饱和色相通道(≥70°/90°)、Viénot-Brettel 三色盲
                                     // 模拟残余、天空亮度/天路明暗序、砖门饱和带
PALETTES.day                         // 规范盘（原版配方：深土道+天蓝砖+奶白角色+大红门），全过验
PALETTES.city/candy                  // step-5 现表镜像，仅对照用（现表未过验，见 PROPOSALS）
PROPOSALS.city/candy                 // 最小改动修复表（city 只改 player 一键），全部实跑过验
contrast / cvdWorst / relLum / satOf / hueOf   // 单件工具，step-5 想在 CI 自检可直接 import
```

`LevelDef = { length, gaps:[{zStart,zEnd,cost}], pickups:[{x,z}], gateZ, gateCost }`——与 §4 契约一致。
v4 开启道具时追加：`gates:[{z,type:'add'|'mul',v}]`（按 z 升序），鞋以 `pickups` 内 `{x,z,kind:'shoe'}` 混放（无 kind 字段 = 砖簇）。**关闭时这两个形状变化完全不存在**（键都不会加），消费端只需 `'gates' in level` 判断。

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

13. **推进元规则也上了漂移锁（§17）**：预览内联 prog 与 `progression.mjs` 母本行为全等机验——同一胜/败操作序列（含 150 连败封顶）逐步比对 state() 与返回值、starsFor 全边界扫描（L1-12 × 时间/余砖临界）、四类脏档自愈、跨重启续档、键名一致。真机（playwright 持久化 profile）复验：两胜进 L3、关浏览器重开续档 L3、败局同关换图 attempt=2 落盘，7/7 全过。星级计时口径：预览按 `elapsed - runT0`（startRun 置表），与 bot 的 t 同单位。注（2026-09-21 晚事故后定稿）：页内保留的是 step-5 那份 SR_KEY 块（Qoder 重复块已删，§17 锚点=「关卡推进（移植自」→「关卡生成」分节标记）；同轮新增 §18 整页编译锁，专抓跨块重复声明这类区域锁盲区。

14. **v4 道具落地（复刻原版道具集：+N 门 / ×2 门 / 加速鞋）**：genLevelV3 加 `opts.items`（levels.mjs `itemsFor` 分带，L1-2 教学无、L3 起 +N、L4 起 ×2、L6 起鞋、loop 微增），布置在修复之后、用独立子种子 `mulberry32(seed*104729+7)`，确定性；供需数学按 `!kind` 过滤 → **道具纯增益，永不可能引入新死局**（§19 用"加道具前后 prefixBalance 全等"锁死）。关闭态输出逐字节 = v3（6 个 sha256 快照锚 + 形状锁"不得出现 gates 键"，防"永远加空数组"这类静默破坏 §14/§16 parity 的写法）。实测：道具开 600 局贪心 100% 胜、门 0 压崖 0 越界、布置逐 seed 可复现。渲染与手感归 step-5（V2/V3 视觉轮可一并做：门拱 +N/×2 大字、鞋形拾取、吃鞋 3.5s 提速尾迹）。

15. **Q5 主题规范（theme.mjs）**：step-5 明言"我不自己拍颜色，避免审美争议"，所以这里定的不是审美而是**可读性下限**——关键对（砖/路、角色/路、门/天…）用"明度对比 ∨ 高饱和色相分离"双通道判定 + Viénot-Brettel 三色盲模拟残余下限 + 天空亮度/路面饱和带。阈值是 3D 场景折减版（平面 WCAG 3:1 会误杀所有中性地板，实测把 city 都错杀）。体检结论：**city 仅 1 项不过**（淡蓝角色 vs 琥珀砖在绿色盲下残余 1.00=同色，改 `player: 0x0288d1` 一键即全过）；**candy 7 项不过**（浅粉路上放黄砖/粉紫桥，拾取物直接隐身，PROPOSALS 给了保糖果身份的修复表）。§20 双锁：规范盘常绿 + Theme.ts 现表逐张跑（**当前红=故意报警**，同 §15a 先例；测试专测盘 name 加「(QA)」可豁免）。

16. **Q6 G1 数据回调方案（g1-tuning.md）**：事件 schema（level/seed/outcome/t/bricksLeft/failZ）+ 六条"症状→单旋钮"回调公式（含实测斜率 k±0.1≈胜率±20pt）+ 验收带更新流程（真人数据 vs HUMAN_AVG 同向性判定：同偏改数值、唯真人偏改失误模型）。统计坑已列：restart 后门数据按 seed 合法区间剔除、分母用局不用关（attempt 墙）、计时口径 runT0 跨端对齐。**v4 基准带已实测入 §5**：items-on vs off 人形代理 L1-L30（60 seeds/关）——道具纯增益（胜率均值 +1.9pt、无 <25% 墙、双态贪心 60/60），但 ×2 门使 loop2 余砖中位膨胀至 99-130、鞋使平均 T 降 1.5~3s，故真机"太松"判断须扣 gate 增益、PAR 星线须按 on 态校准。**§6 PAR 已换表并三处同步完成**（母本新表+parFor loop 补偿 +2.5s/loop，step-5 提交 1b18e88 同步两处拷贝，§17 复绿）。

17. **美术规格包（art-pack.md，2026-09-22）**：用户 force-push 了 React+three 美工工作台到 origin/main（零共同历史，主工程远端 15 提交暂不可见，本地完好+bundle 备份）。工作台产出四调色板全部过 Q5 规范（theme.mjs 新增 `ARTSTUDIO` 入 verifyAll 常绿锁 + **verifyTheme 新增 night 豁免通道**：夜/昏盘跳过天空亮度与天路明暗序，配对检查不减免）；角色=程序化五皮肤+抱板姿遮挡修复+跑步公式；渲染=FogExp2 0.007/PCFSoft 1024/55° 跟拍；附 Cocos 卡通水 shader 完整 effect 代码与 Mixamo 选型表。移植参数全在 art-pack.md，等 step-5 认领。

18. **G1 汇总脚本已交付（telemetry-report.mjs，2026-09-22）**：读 `sr_telemetry_v1` 导出的事件数组，离线推导 failGapIdx/死因细分（seed 确定性重建关卡，采集侧零改动），输出每关 n/胜率/t中位/余砖中位/short数/断崖命中榜 + §2 触发器点名。三份合成集自测通过（609 局主集含 QA 后门与 short 注入：剔除 1/1、判级 8/8；全 short 集出行2、全高余砖集出行3）。自测纠偏一处：**症状判定用点胜率（n≥50），Wilson 下界仅作报告置信参考**——下界对带会双重扣噪声（n=60 时 87% 对 95% 带也常亮红灯），g1-tuning §1 同步改准；低胜率三亚型互斥（short主导→动门 / 集中断崖→动间距 / 散布→动 k），符合"一次一旋钮"铁律。**浏览器端到端补遗（同日晚）**：真链路实测通过（自动走位真玩→dumpTelemetry→报告），并暴露 restart/刷新/双 tab 会产生同键(关,seed)复读合法种子——脚本已加全文件同键去重（首条保留）+ ev.qa 直剔双保险；多设备各导各跑勿合并文件。

19. **弯道参数母本化 + 纯表现层审计（2026-09-22）**：step-5 的 S 弯系统（8f30c51）机验为真纯表现层——拾取碰撞/桥/门全走平空间逻辑坐标，bendX 只进渲染变换，z 按逻辑速度推进故 T/PAR/§5 基准带语义不失效；phase=level*1.7 与 seed 无关（弯形=关卡身份证，换图不变形，可接受）。curveFor 双副本已升格母本（levels.mjs 导出 + sim §22 双端漂移锁，L1-L60 三键 1e-9），复制 theme/PAR 的"母本先行、红=点名"模式。遗留一行建议给 step-5：pickup mesh 落位缺 x*cos(h) 切线系因子（与玩家/路面不一致，最大 0.11m，纯视觉，采纳随心）。

## 移植要求（给 step-5）

- **移植目标 = `genLevelV3`**（一次到位，含 v2 前缀修复 + v2.1 间距 + tailSafe + margin）。你们已移植的 TS 版 genLevelV2 与母本 v2.1/v3 输出已有逐 seed 差异，替换后按 §1 口径重跑 parity（v1 基线永不变，可作为移植正确性的锚）。
- 接入方式：`cfg = cfgForLevel(level, CFG)`（levels.mjs，含 supplyMargin 字段）→ `genLevelV3(seed, cfg)`；种子建议 `seed = level*1000 + attempt`（同关重开同图，换关换图）。
- **保留 D1/D2/间距/margin 断言进 tools/smoke**，防止回归。
- `botRun` 是 QA 工具不进游戏包体，留在 `tools/` 层。
- **v4 道具接入（增量，随时可接不阻塞）**：进场处 `genLevelV3(seed, cfg, { items: itemsFor(level) ?? undefined })`；渲染 `level.gates`（拱门 +5/×2）与 `pickups` 里 `kind:'shoe'`；运行时吃鞋 `speed×1.35 持续 3.5s`、过门 `+v / ×v`。不接则一切如旧（默认关闭=逐字节 v3）。内联移植后 §19 字节锚自动守护未开启路径，开启路径 parity 我下轮加锁。
- **跨重启存档：web-preview 已落地（2026-09-21，Qoder 按用户指令接线）**，内联 prog 块由 `sim.mjs §17` 行为锁看守（操作序列逐步全等 + starsFor 边界扫描 + 脏档自愈 + 键名一致），真机复验胜/败/续档 7/7。**Cocos 侧仍待接**：`sys.localStorage` 包 `{getItem,setItem}` 喂 `createProgress` 即可，规则口径照 §17 内联版或 TS 直译。注：母本 STORAGE_KEY 曾混入一个 U+2026 坏字符，已修正为文档口径 `shortcut_run_progress_v1`；旧键下的本地脏档因键名变更会被视为「无存档→全新开局」自愈，无需迁移。
