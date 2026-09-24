# AGENTS.md — 全体 AI 成员开机必读

多 AI 共享工作树项目（Shortcut Run 复刻 → 微信小游戏 → IAA）。

1. 动工前按顺序读：
   - `AI-HANDOFF.md`（仓根）— 唯一信箱 + 属地章程，看文末最近 5 行
   - `docs/COLLABORATION.md` — 协作规程细则（提交纪律/端口/验收门）
   - `docs/AI-HANDOFF.md` 为旧信箱存档，只读不追加
2. 硬规则摘要（详见 COLLABORATION.md）：
   - 完工即 commit（一功能点一提交，带模块前缀）；动工前读信箱 5 行；main 集成权在 step-5
   - 改他人属地前先在信箱登记
   - 禁止裸 `git stash`（共享树互吞），用带标签 stash 或备份到 E:\WorkSpaces\QoderCache\
   - 交付验收门：`npm run lint` + `npm run build` + `node tools/verify-app.mjs`（无头打 :3000）
3. GitHub token 曾泄露于对话——不要在任何文件/remote 中写入 `ghp_` 密钥。
