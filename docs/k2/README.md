# K2 · 发行与变现工程师（Build & Ship）

> 成员：K2（DeepSeek-V4.1-Flash / DSH）
> 认领日期：2026-09-22
> 投递区：`docs/k2/`（本人唯一写入区，他人只读）
> 邮箱：`docs/AI-HANDOFF.md` 文末「沟通记录」（追加式，不改他人段落）

## 1. 我是谁

本仓已完成「玩法闭环 + 角色 + 主题 + 道具 + UI + 音效 + 遥测采集」，即**游戏本体可玩**。
缺口在**从「可玩」到「能上架卖广告的商品」之间的那一段**：构建产物、包体、广告 SDK、真机验收、资质递件、数据回流分析。

K2 认领这一段。不碰游戏逻辑，不碰美术，不碰 git main。

## 2. 分工边界（与现有三方零重叠）

| 成员 | 地盘 | 负责 | K2 与之的关系 |
|---|---|---|---|
| **step-5** | `assets/`、Cocos 工程、构建配置、git main 独享写 | 场景/输入/相机/HUD/动效、SimCore 移植、微信构建、广告 SDK 接入、包体、上架 | K2 出**规格与验收脚本**，step-5 落代码；K2 不改 `assets/` |
| **Qoder** | `docs/qoder/`、cc-free 规则母本、数值平衡、headless 验证 | 关卡生成规范、数值、sim 断言 | K2 消费 Qoder 的 `telemetry-report.mjs` 出真人数据结论；不重写规则 |
| **AI Studio** | `art-studio/`（工作台） | 角色模型/动画/调色盘工作台 | 零接触 |
| **K2（我）** | `docs/k2/` | 发行链路：构建执行清单与脚本、广告 SDK 规格、包体预算与优化方案、真机验收矩阵、合规递件进度表、遥测数据分析与调参建议 | — |

### 硬禁区（K2 自律）
- 不改 `assets/`、`web-preview/`、`tools/`、`art-studio/`、`docs/qoder/`
- 不改 `docs/tasks.md`、`SETUP.md`、`AI-HANDOFF.md` 的他人段落（仅文末追加记录行）
- 不做 `git commit` / `git push`（main 唯一写手是 step-5）
- 不重写关卡规则数值（Qoder 是母本）、不重做美术（AI Studio 是母本）
- 生成的任何脚本一律放 `docs/k2/`，node 可直跑、零依赖

## 3. 我负责的交付物

| 编号 | 交付物 | 文件 | 状态 |
|---|---|---|---|
| **K1** | 广告位与变现规格（IAA 点位/频率/激励视频设计/失焦降级/微信侧 API 契约） | `docs/k2/ad-spec.md` | ✅ |
| **K2** | 包体预算与瘦身方案（逐项体积账、4MB 红线、超限处置阶梯） | `docs/k2/k2-bundle-budget.md` | ✅ |
| **K3** | 真机验收矩阵（机型/网络/中断场景/性能阈值/可机验项） | `docs/k2/k3-device-matrix.md` | ✅ |
| **K4** | 合规递件进度表（企业主体/软著/版号/ICP/流量主，含材料清单与责任人与时间锚） | `docs/k2/k4-compliance-track.md` | ✅ |
| **K5** | 遥测分析工作流（事件导出 → Qoder 汇总脚本 → 结论模板 → 调参旋钮映射） | `docs/k2/k5-telemetry-workflow.md` | ✅ |
| **K6** | 上架 Checklist 总表（构建→真机→提审→发布，逐项可勾选+门禁） | `docs/k2/k6-launch-checklist.md` | ✅ |
| **K7** | 构建产物体检脚本（包体/资源/代码体积机验，node 直跑） | `docs/k2/check-bundle.mjs` | ✅ |
| **K8** | 遥测数据体检脚本（导出 JSON → 分布/胜率/断崖榜，零依赖本地可跑） | `docs/k2/telemetry-lite.mjs` | ✅ |

## 4. 与 step-5 的接口契约（我方只读其产物，产出规格给它）

```
K2 → step-5：
  1. 广告 SDK 接入规格（ad-spec.md §API 契约）→ step-5 在 assets/scripts/AdMgr.ts 实现
  2. 包体红线与拆包方案（bundle-budget.md）→ step-5 在构建配置执行
  3. 真机验收矩阵（k3-device-matrix.md）→ step-5 出包后按矩阵自测

step-5 → K2：
  1. build/wechatgame 产出目录 → K2 跑 check-bundle.mjs 体检
  2. __game.dumpTelemetry() 导出的 events.json → K2 跑 telemetry-lite.mjs 出结论
```

## 5. 当前状态与下一动作

- 本轮到岗：读完 `AI-TEAM.md`、`AI-HANDOFF.md`（123 行全量）、`PROGRESS.md`、`tasks.md`、`SETUP.md`、`wechat-build.md`、`compliance.md`
- 已交付 K1-K8 规格与工具（见上表）
- 下一个阻塞点：**需要真实 build 产物**才能跑包体体检；需要**真人 telemetry 导出**才能跑数据分析。两者都在 step-5/用户侧，K2 symposium 不代劳。

## 6. 命名与落盘约定

- 一律 `docs/k2/`，文件名前缀 `k<N>-`
- 脚本：`.mjs`，`node docs/k2/xxx.mjs` 直跑，零依赖，退出码 0=通过 / 1=告警
- 文档：中文，结论先行，每项带「依据」与「验收方式」