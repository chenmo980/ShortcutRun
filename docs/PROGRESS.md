# 项目进度报告

> 更新时间：2026-09-22 · 版本：v0.3 进行中 · 仓库：chenmo980/ShortcutRun（main）

## 一句话

复刻 VOODOO《Shortcut Run》（铺路过断崖跑酷）→ 微信小游戏 → IAA 广告变现。多 AI 协作开发，玩法闭环、角色、弯道、关卡进阶、道具、遥测、发行规格已就位。

## 现在就能玩（2 分钟）

| 方式 | 操作 |
|---|---|
| **浏览器版（推荐先试）** | 双击仓库里 `web-preview/index.html`，零安装 |
| Cocos 版 | Cocos Creator 3.8 打开仓库 → 双击 `assets/scenes/game.scene` → 按 ▶ |

操作：点击开始 → 鼠标拖动 / `A` `D` 转向 → 吃砖块 → 断崖处砖够自动拍桥、砖不够掉落 → 终点门验砖 → **赢了进下一关，输了同关重试**。

## 已完成（全部有自动化测试证据）

| 模块 | 状态 | 验证 |
|---|---|---|
| 玩法闭环（前进/吃砖/铺桥/掉落/终点门） | ✅ | 浏览器端到端 13 项断言全绿 |
| 关卡生成器 V3（母本对齐） | ✅ | 与规则母本 30 种子位级一致（parity）；Qoder 侧 1000 种子×L1-L10 机验全绿 |
| 关卡公平性 | ✅ | 2000 种子：0 全局缺砖 / 0 前缀死局 / 末段恒 ≥8m / 拾取间距 ≥4m |
| L1-L10 难度曲线 + L11+ 饱和加深 | ✅ | 曲线漂移锁 L1-L60 逐值对母本；L28+ 死亡墙已消除 |
| 关卡推进系统（进度存档/星级/最佳成绩/同关换图） | ✅ | progression 单元断言 + 脏数据自愈 |
| 程序化角色（零素材，跑步/掉落/举手动画） | ✅ | 像素级渲染检测通过 |
| 主题换肤系统（白天原版/城市/糖果，T 键切换） | ✅ | 全部色板过 Q5 可读性规范（色盲安全/对比度机验）+ 换肤断言 |
| 道具系统（+N 门 / ×2 门 / 加速鞋，L3 起分带解锁） | ✅ | 双端 parity 位级一致 + 道具不改供需（纯增益数学锁）+ 端到端断言 |
| UI 流程（开始界面/结算面板/星级/进度条） | ✅ | 浏览器版面板上线；Cocos 版文本 HUD |
| 音效（浏览器版 WebAudio 合成：吃砖/铺桥/胜/负，M 静音） | ✅ | 无页面错误 + 事件钩子全覆盖 |
| G1 遥测采集（胜/败事件落 sr_telemetry_v1，Q6 schema） | ✅ | 双端挂点；dumpTelemetry 一键导出；汇总对照表 Qoder 侧 telemetry-report.mjs |
| 怀里搬木板 + 俯视相机 | ✅ | AI Studio 方案移植，四门回归全绿 |
| 弯道系统（表现层 S 弯，LevelGen 零改动） | ✅ | 纯表现层审计通过；curveFor 母本 + sim §22 双端锁 L1-L60 |
| 发行规格包（广告位/包体预算/真机矩阵） | ✅ | K2 投递 docs/k2/ 已收货（K4-K8 待 K2 补实存） |
| Cocos 零装配（内置场景+程序化灰盒） | ✅ | 双击场景即玩，无需任何手动装配 |
| 关卡进度 HUD（砖数/进度%/关卡号/最佳成绩/星级） | ✅ | 双版本上线 |
| 多 AI 协作机制（邮箱+门禁+母本制+漂移锁） | ✅ | 见 `docs/AI-HANDOFF.md` |

## 质量数据（QA 口径）

- **贪心 bot**（零失误）：L1-L10 全部 60/60 通关
- **人形 bot**（漏 25% 砖 + 180ms 反应 + 瞄准偏差）：L1 89% → L10 47%，L11+ 饱和平台 83%→53%，全部落在设计目标带（新手关 ≥80%、中期 ≥70%、后期 ≥40%）
- 单局时长：L1 ≈16s → L10 ≈22s（休闲游戏黄金区间）
- 双 AI 交叉验证：Qoder 侧 sim.mjs 21 项断言（含对我方 TS 移植的 1000 种子 parity 永久锁），我方 smoke 断言生成器/曲线/progression 三层

## 分工（详见 `docs/AI-HANDOFF.md`）

| 成员 | 地盘 | 本轮任务 |
|---|---|---|
| **step-5（opencode）** | Cocos/微信侧全部代码、集成、构建、上架、git main | 弯道/怀里搬/遥测 → K2 规格落地（AdMgr/构建）→ V5 微信构建 |
| **Qoder agent** | cc-free 规则母本 + 数值 + headless 验证（投递 `docs/qoder/`） | curveFor 母本化 + telemetry-report 去重/qa 剔除已交付 |
| **K2（DeepSeek）** | 发行链路规格 `docs/k2/` | K1 广告规格 / K2 包体预算 / K3 真机矩阵已交付 |
| 工具线（非 AI 同事） | Meshy/Tripo、淘宝素材、Suno、微信开发者工具 | 按需调用，全部经 step-5 之手进包 |
| 人类（项目负责人） | 手感裁决、门禁签批、合规决策、审美 | G1 试玩反馈；Mixamo/素材采购决策 |

## 下一步（两周成“能看的 Demo” → 能上架）

1. **V5 微信小游戏构建** + 真机预览（按 wechat-build.md；出包后 K2 跑 check-bundle + k3 矩阵）
2. **广告 SDK 接入**（按 docs/k2/ad-spec.md → assets/scripts/AdMgr.ts）
3. 音效素材采购（audio-assets.md 清单）
4. G1 真人遥测 → telemetry-report.mjs 对照 g1-tuning §5 基准带调参
5. 并行（周期长越早越好）：软著申请、企业主体（见 `docs/compliance.md`）

## 风险与阻塞

| 风险 | 状态 | 对策 |
|---|---|---|
| 版号 3-6 个月 | 最大外部依赖 | 开发版先做数据，资质并行推进 |
| Mixamo 被墙（角色动画原方案） | 已解除 | 改程序化动画，升级路径=淘宝/爱给网 fbx（¥10 内） |
| 玩法红海（国内同类多） | 关注中 | G1 后加差异化微创新再上量 |

## 给新成员（3 分钟上手）

```bash
# 跑全部测试（Node ≥ 22.6，零依赖；tsc 用本地 devDependencies）
node tools/smoke.ts          # 关卡生成器：parity + 不变量 + bot 通关率
node tools/verify-web.mjs    # 浏览器版端到端 13 项
node docs/qoder/sim.mjs      # 规则母本验收套件（Qoder 维护，现 38 项）
node node_modules/typescript/bin/tsc -p tools/tsconfig.check.json --noEmit
```

- 代码/文档唯一源：本仓库 main 分支，所有改动走 git
- 协作规则（AI 间怎么配合）：`docs/AI-HANDOFF.md`
- 手感/数值调参：`assets/scripts/config.ts` + `assets/scripts/LevelCurve.ts`
