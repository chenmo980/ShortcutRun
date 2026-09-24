# AI 协作交接单 · Shortcut Run 3D（多 AI 并行版）

> 本文件是本机多 AI（step-5 / Qoder CN）协作的**唯一信箱 + 唯一边界契约**。
> 规则：动对方地盘或共享文件前，先在文末追加一行登记；不许静默改对方文件。
> 2026-09-24 重建（ec1a41d 清除 Cocos 时误删了旧 AI-TEAM.md/协约，本次按新架构重立）。

## 1. 当前架构（2026-09-24 起）

纯 **Three.js + React + Tailwind** 单应用（Cocos 已彻底清除，无 assets/、无 web-preview/、无 adapter 补丁地狱）：

```
npm install && npm run dev     # 开发（:3000）
npm run lint                   # tsc 零错门禁
npm run build                  # vite 产物 → dist/
```

- 游戏运行时：`src/components/GameCanvas.tsx`（渲染/相机/玩法/自动巡航）
- 角色系统：`src/components/characterBuilder.ts`（程序化骨骼 + IK 力学）
- 工作台：`src/App.tsx` + `ArtStudioPanel.tsx`（调色/材质）+ `PerformanceMonitor.tsx`（遥测）
- 数据预设：`src/data/chinesePresets.ts`（角色）+ `physicsPresets.ts`（物理）

## 2. 地盘划分（按文件锁，同文件同时只允许一个 AI 改）

| AI | 独享地盘 | 说明 |
|---|---|---|
| **Qoder CN** | `src/components/GameCanvas.tsx`、`src/components/characterBuilder.ts`、`src/data/*` | 游戏运行时/角色/物理预设（当前活跃中） |
| **step-5** | `tools/*`、`vite.config.ts`、`index.html`、微信导出链路、协作文档 | 门禁/构建/协作 |
| **共享（先登记后改）** | `src/App.tsx`、`src/components/ArtStudioPanel.tsx`、`src/components/PerformanceMonitor.tsx`、`src/types.ts`、`package.json` | Qoder 当前正在改 App 三件套；step-5 要改先登记 |

## 3. 协作规则

1. **登记后动**：改对方独享地盘或共享文件前，文末邮箱加一行（日期 | 谁 | 干什么 | 影响）
2. **本机并行红线**：两个 AI 不同时编辑同一文件；大文件（GameCanvas 926 行）归 Qoder 独享
3. **提交纪律**：一个功能点一个提交，消息带模块前缀（`feat(game):` / `chore(tools):`）；Qoder 的功能点由 step-5 协助提交到 `ai/qoder/<topic>` 分支或经用户确认后直接 main
4. **集成权**：main 的集成由 step-5 执行（每日一次或在用户指示时），集成前必跑门禁
5. **阻塞即上报**：卡住超过半天写邮箱，不硬扛

## 4. 统一门禁（step-5 维护，任何 AI 提交前都要过）

```bash
npm run lint                    # tsc 零错
npm run build                   # vite 构建通过
node tools/verify-app.mjs       # 无头浏览器打 :3000：canvas 渲染 + 无 pageerror + 角色像素可见 + 自动巡航有位移
```

微信导出 dry-run（包体 < 4MB）由 step-5 的 `tools/wechat-export.mjs` 承担。

## 5. 沟通记录（邮箱）

- 2026-09-24 | step-5 | **协作重建**：ec1a41d 清除 Cocos 时协约丢失，本文件重立；确认 Qoder 10:06 起在本机活跃开发（当前未提交改动：App.tsx 去 metrics 状态、CocosToolkitModal 回调重构、package-lock 更新）；step-5 认领 tools/门禁+微信导出+协会议程，不碰 Qoder 的 GameCanvas/characterBuilder/data。
- 2026-09-24 | step-5 | **门禁建设中**：`tools/verify-app.mjs`（迁移旧 verify-web 到 :3000 架构）；微信导出链路重启评估中（纯 Three.js 路线，预期无 Cocos adapter 类问题）。
