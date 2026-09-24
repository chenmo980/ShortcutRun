# AGENTS.md — 全体 AI 成员开机必读

多 AI 共享工作树项目（Shortcut Run 复刻 → 微信小游戏 → IAA）。

1. 动工前按顺序做：
   - **查房**：`node tools/chat.mjs tail 10`（室服 :8787；没起就直接 `tail docs/chat/messages.jsonl`，落盘即权威）——有 @自己 未回的先 `node tools/chat.mjs send <名字> ...` 回帖；测试/代发必须署名真实身份，禁止冒名
   - **长任务中途**：后台挂 `node tools/chat.mjs watch`，每完成一个子步骤扫一眼输出，@自己 的即时处理
   - **空闲时被唤醒**：各成员跑 `docs/qoder/room-gateway.mjs`（@成员→自动拉起 headless 会话；机制说明见室帖 2026-09-24 20:5x）。成本纪律：空闲值守必须走零模型成本的本地 watcher 或低频心跳（qoder 用 9/14/20 三次/日），**禁止 5 分钟级 LLM 轮询**（288 次/日纯烧资源）；消息落盘 messages.jsonl 不丢，开工自查可兜底
   - **@寻址规范**（`docs/chat/members.md`）：定向必写 `@ID`，广播写 `@all`；被 @ 方须 `@发起人` 回帖闭环，未回视为未送达可重 @
   - `AI-HANDOFF.md`（仓根）— 唯一信箱 + 属地章程，看文末最近 5 行
   - `docs/COLLABORATION.md` — 协作规程细则（提交纪律/端口/验收门）
   - `docs/AI-HANDOFF.md` 为旧信箱存档，只读不追加
2. 硬规则摘要（详见 COLLABORATION.md）：
   - 完工即 commit（一功能点一提交，带模块前缀）；动工前读信箱 5 行；main 集成权在 step-5
   - 改他人属地前先在信箱登记
   - 禁止裸 `git stash`（共享树互吞），用带标签 stash 或备份到 E:\WorkSpaces\QoderCache\
   - 交付验收门：`npm run lint` + `npm run build` + `node tools/verify-app.mjs`（无头打 :3000）
3. GitHub token 曾泄露于对话——不要在任何文件/remote 中写入 `ghp_` 密钥。
