# Q6 · G1 数据回调方案（真人试玩 → 数值怎么动）

> Qoder 投递，AI-HANDOFF §5 Q6。配套：采集挂点在 step-5 地盘（GameApp/web-preview），
> 回调动作全部落在 `docs/qoder/levels.mjs` 母本（我先改、锁复验、你们同步拷贝）。
> 原则：**一次只动一个旋钮，动了必须跑 sim 复验**——多旋钮同动 = 归因灾难（v1→v3 阶段学费）。

## 1. 采集指标（每局一条事件，零个人信息）

```
{ level, seed, outcome: 'win'|'fall'|'short'|'timeout',
  t,                 // 局内计时（预览口径 elapsed-runT0，与 PAR/bot t 同单位）
  bricksLeft,        // 到门/失败瞬间存量（win=门前余量，与 botRun 语义一致，不扣 gateCost）
  failZ, failGapIdx, // 失败位置 + 第几个断崖（win 时 null）
  pickupsTotal }     // 图上拾取物总数（=level.pickups.length 全量含鞋，双端实况一致；不进 §2 触发器，仅图密度参考）
```

-  web-preview：`__game` 已暴露 `progress()`；建议 win()/lose() 各加一行 push 进
  `localStorage['sr_telemetry_v1']` 环形数组（封顶 500 条），我出汇总脚本读它。
- Cocos/真机：同一 schema 走 `wx.reportEvent`（键名一致），别自建字段。
- 样本门槛：**每关 ≥50 局**才允许进回调判断；不足就只看趋势不动数值。
- 症状判定（§2 触发）用**点胜率**对带且 n≥50；Wilson 95% 下界仅作报告里的置信参考——一律用下界对带会双重扣噪声，n=60 时 87% 对 95% 带也常亮红灯（telemetry-report 自测实证）。
- 汇总脚本**已交付**：`docs/qoder/telemetry-report.mjs`（cc-free）。导出 `sr_telemetry_v1` 的 JSON 数组 → `node docs/qoder/telemetry-report.mjs events.json`，出每关 n/胜率/下界/t中位/余砖中位/short数/断崖命中榜 + §2 触发器点名（低胜率三亚型互斥：short主导→行2，集中断崖→行4，散布→行1）。failGapIdx/死因分类离线推导，采集侧零改动。

## 2. 回调公式（症状 → 单旋钮，全部改 levels.mjs，不改生成器结构）

| 症状（真人 vs HUMAN_AVG 代理） | 动作 | 幅度 | 复验 |
|---|---|---|---|
| 胜率低于带 ≥10pt，失败点散布全程，short 占比高 | `ratioFor` 该带 +0.1 | 扫参实测 k 每 +0.1 真人胜率约 +20pt | §11 带 + §19 全绿 |
| 失败集中在最后 20% 路程且 outcome=short 为主 | 该带 `gateCost` ×0.9（**先动门不动 k**） | 一档一验 | §11 + §13 |
| 中位 bricksLeft >8 且真人胜率 >95%（太松） | 该带 `gateCost` ×1.15；仍 >95% 再 `ratioFor` -0.1 | 两步之间隔一次实测 | §11 |
| 失败集中在**特定某几个 gap**（同 gapIdx 复发率高） | 该带 `gapIntervalMin` +2（给反应时间，不是给砖） | 一档 | §11 + 人形 replay |
| timeout 占比 >10% | `levelLength` -10 或 `runSpeed` +0.5（二选一） | 一档 | §13 平台带 |
| 前 3 关流失高（真人胜率 <70% L1-3） | 只加 `marginFor` L1-3（4→6），**不动 k**（新手漏吃靠余砖不靠密度） | 一档 | §11 |

铁律：**真人数据永远对照 HUMAN_AVG 代理读数**——两者同向偏 = 数值真有问题（改表）；
只有真人偏 = 失误模型不像这批人（改 HUMAN_AVG 参数并重校带，改前先邮箱知会）。

## 3. 验收带更新流程（谁改什么，按序）

1. step-5 贴每关样本数 + 实测胜率表（邮箱，格式随意，给数就行）。
2. 我按 §2 公式出改表 PR：`levels.mjs`（CURVE/ratioFor/marginFor）→ 本地跑
   `node docs/qoder/sim.mjs` 全套必须 **除 §20 外全绿**（§20 是 Theme.ts 体检，与本流程无关）。
3. 若动了 PAR/星级线：`progression.mjs` 与预览内联、LevelCurve 拷贝三处同步
   （§15/§16/§17 三把锁自动点名没同步的那份，红了找没动的人）。
4. 带本身要改（如上线后大盘留存变了）：改 `WIN_BANDS`/§11 阈值必须附真人依据，
   写进 README 结论编号，禁止"看着调"。

## 4. 已知坑（别踩）

- 预览 `restart(lv)` 是 QA 后门，会伪造连胜刷 best——统计侧按 `seed` 反推
  （seed=level*1000+attempt 合法区间外的一律剔除），telemetry 加 `qa:true` 标更好，你们选一种。
- 同关重开换图（attempt++）会让失败聚集在第 1 张图（新手墙）——**分母用局不用关**，
  别把 attempt2+ 的"熟练重开"胜率混进 L 胜率。
- 星级计时是 `elapsed-runT0`，场景加载/暂停不计时，Cocos 侧接线务必同口径，
  否则跨端时间分布不可比。

## 5. v4 基准带（HUMAN_AVG 代理实读，2026-09-21，60 seeds/关，脚本 scratch/g1-baseline.mjs）

真机数据回来后**对照这张表**判断"真人比代理难/易多少"，再走 §2 公式。
口径：seed=lv*1000+1..60；人形=HUMAN_AVG+seed(s*7919+3)；on=`items: itemsFor(lv)`；贪心双态均 60/60 全程（可达性未破坏，§19 同源）。

| 带 | 人形胜率 off→on | 平均 T(s) off→on | 余砖中位 off→on |
|---|---|---|---|
| L1-3（L1-2 无道具） | 87% → 87% | 16.9/20.5 | 24/36→41 |
| L4-7 | 82% → 85% | ~21 → ~20 | 34-42 → 50-68 |
| L8-10 | 57% → 60% | ~23 → ~21.8 | 38-42 → 59-63 |
| L11-20（loop1） | 74% → 75% | ~24 → ~22 | 28-49 → 30-130 |
| L21-30（loop2） | 66% → 69% | ~26.6 → ~23.7 | 28-49 → 66-130 |

要点：
1. **道具是纯增益但不是白给**：on 态胜率 +0~8pt（均值 +1.9），**最低点 29/60=48%（L10/L29 off 态），全程无 <25% 墙**（§13 口径继续成立）。
2. **×2 门使余砖中位数在 loop2 膨胀到 99-130**——这是显示数字膨胀不是难度下降；真机"中位 bricksLeft>8 太松"判断（§2 第 3 行）**on 态必须用 off 基线或先扣 gate 增益**，否则会误收紧。
3. **鞋让 T 变快**（on 平均 -1.5~-3s，loop 越深越明显，因鞋数量随 loop 微增）：PAR 时间星线若按 off 版校准，on 版上线后三星率会漂高——动 PAR 前先确认三处同步（§3 第 3 步）。
4. L4/L5/L6 各有一处 ±(1-4) 噪声级差异（60 局 Wilson 下界 ±12pt 内），勿据此动旋钮。

## 6. PAR time-star recalibration proposal (items-on prerequisite, 2026-09-22 measured 120 seeds/level)

Design invariant unchanged: PAR ~ P25 of human-form winning runs ("about top 1/3").
Measured with items ON (the config stars will ship under):

Symptom 1, item drift: x2 gates plus shoes push the on-state hit rate of the current table from 23-36% off to 57-73% (L4-7) -- the time star becomes a dealt award instead of a skill award.

Symptom 2, modulo-10 stale bug (item-independent, more severe): each loop adds +20m level length but PAR reuses the L1-L10 lookup table, so the L11+ hit rate is 0-4% and L21+ is always 0 -- three stars are mathematically almost unreachable from loop1 onward, the retention hook fails for the whole segment.

Proposal (apply in the same wave as items wiring lands, three-way sync per section 3 step 3):

```
PAR = [16.5, 19.0, 19.5, 18.5, 19.5, 18.5, 19.5, 20.5, 20.5, 21.5]   // ~ on-state P25 per idx
par(level) = PAR[(level-1)%10] + Math.floor((level-1)/10) * 2.5       // loop shift compensation (measured +2.5~2.6s/loop)
```

Expected: all-band hit rate returns to ~20-28% (on distribution), off-state transitional period drops to 5-20% because levels run ~2s slower without items, converges once items ship. Full P25/P50/P75 table reproducible via scratch/par-recal.mjs (seed=lv*1000+1..120, HUMAN_AVG seed=s*7919+3).

Why NOT editing progression.mjs master right now: preview is still items-off and the three PAR copies are currently consistent -- an early change would turn section 17 red for no reason and mislead attribution. Once step-5 finishes items wiring, reply in the mailbox; I then patch the master, you copy to the two on-disk sites, full suite re-green in one shot.
