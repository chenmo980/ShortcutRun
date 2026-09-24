# 多 AI 协作规程 v1.1（2026-09-24 · Qoder 起草，v1.1 对齐 step-5 章程 ee50524）

> 背景：ec1a41d 大重置后仓库变为纯 Three.js 工作台（root = Vite+React+Three）。
> step-5 于 ee50524 重立章程，**唯一信箱 = 仓根 `AI-HANDOFF.md`**（本文件只是其操作层细则，冲突时以仓根章程为准）。
> `docs/AI-HANDOFF.md` 为旧 v2 信箱存档（Cocos 时代 + 当日历史登记），不再追加。

## 0. 唯一目标（不变）

Shortcut Run 复刻 → 微信小游戏 → IAA 变现。G1 门禁：用户试玩"还想再来一把"。

## 1. 成员与属地（= 仓根章程 §2 文件锁，同文件同时只允许一个 AI 改）

| 成员 | 属地 |
|---|---|
| **Qoder CN** | `src/components/GameCanvas.tsx`、`src/components/characterBuilder.ts`、`src/data/*`（游戏运行时/角色/物理预设） |
| **step-5** | `tools/*`、`vite.config.ts`、`index.html`、微信导出链路、协作文档 |
| **共享（先登记后改）** | `src/App.tsx`、`ArtStudioPanel.tsx`、`PerformanceMonitor.tsx`、`src/types.ts`、`package.json` |
| AI Studio / K2 | 视觉规范投递 `docs/qoder/art-pack.md` 类 / `docs/k2/*`（文档层，不占代码文件锁） |

改他人属地或共享文件：仓根 `AI-HANDOFF.md` §5 文末先登记一行（日期 | 谁 | 干什么 | 影响），完工回帖（改了什么/为什么/如何回滚）。

## 2. 提交纪律（方案 A：单目录共享工作树）

1. **完工即 commit**：一个功能点一个提交，消息带模块前缀（`feat(game):` / `perf(ui):` / `chore(docs):`）。不许留未提交工作过夜（共享树前科：补丁⑧⑨⑩差点被 pull 冲掉）。
2. **动工前**：读仓根 `AI-HANDOFF.md` 文末最近 5 行 + `git status` 确认无他人半成品混在自己的路径里；有 remote 时 `git pull --ff-only`。
3. **实验性大改**：临时分支 `ai/qoder/<topic>`（step-5 章程 §3.3 命名），炸了就删分支，主干零污染。
4. **集成权**：main 的 push/集成由 step-5 执行（每日一次或用户指示）；其余成员 commit 到本地 main 或 exp 分支，集成前必跑 §4 门禁。
5. **禁止裸 stash**（共享树互吞）：用带标签 stash `git stash push -m "qoder-日期-事由"`，或备份到 `E:\WorkSpaces\QoderCache\`。

## 3. 端口约定（dev server 互不抢占）

| 端口 | 归属 |
|---|---|
| 3000 | 默认（step-5 门禁 `tools/verify-app.mjs` 固定打 :3000，跑门禁时该端口须是最新码） |
| 3001 | Qoder 日常（`npm run dev -- --port 3001`） |
| 3002 | AI Studio |

## 4. 统一门禁（step-5 维护，任何 AI 提交前全过）

```bash
npm run lint                    # tsc 零错
npm run build                   # vite 构建通过
node tools/verify-app.mjs       # 无头浏览器打 :3000: canvas 渲染 + 无 pageerror + 角色像素可见 + 巡航有位移
```

Qoder 附加自验：性能不回归（遥测面板常开 rAF ≥ 50，基线 55-60）；纯逻辑模块附 headless 断言（`node xxx.mjs` 直接可跑）。
任何一条不过 = 不交付。回归数据写进邮箱回帖，不接受"应该没问题"。

## 5. 同步通道（按触达力排序）

1. **仓根 `AI-HANDOFF.md` 信箱 + git 历史**：全员可达，权威源（跨界登记与正式回执只认这里）。
2. **聊天室 `:8787`（step-5 维护 tools/chat-server.mjs）**：实时商量/呼叫/状态播报；`node tools/chat.mjs send <名字> <文字>` 发言、`tail 10` 查房、人可开浏览器插话；服务未起时降级直读落盘 `docs/chat/messages.jsonl`（append-only 进 git，即权威）。测试/代发帖须署名真实身份。Qoder 原建的 docs/room/ 文件室已经用户拍板合并至此。信箱=合同，聊天室=对讲机。
3. **AGENTS.md / QODER.md（仓根）**：opencode 自动读 AGENTS.md，Qoder 自动读 QODER.md——规则写在这里**无需成员主动记得**，是唯一"开机即生效"的通道。改动须两文件同步。
4. **机器门禁**：`tools/verify-app.mjs` 是硬同步——谁回归了门立刻红，不靠互相转告。
5. 用户转达：仅限争议裁决 + K2/Art Studio 的 @帖带话（他们不在本机运行时）。

## 6. 待决事项（谁有结论谁回帖）

- [x] docs/ 去留：Qoder 已从 3ba5637 恢复并提交（e5aec32），定位=历史档案+投递区；信箱职能移交仓根。
- [ ] step-5：微信导出链路——章程 §5 已写"纯 Three.js 路线重启评估中"，与 Qoder 提议一致（弃 Cocos 中转）。等 `tools/wechat-export.mjs` 排期；磁盘旧 build/wechatgame 12 文件补丁链勿再投入。
- [ ] Qoder：Recharts 1Hz ~100ms 尖峰为已知余项（可选 canvas 手绘波形，低优先级）。
