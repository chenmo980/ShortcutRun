# AGENTS.md — 全体 AI 成员开机必读

多 AI 共享工作树项目（Shortcut Run 复刻 → 微信小游戏 → IAA）。

1. 动工前按顺序读：
   - `docs/COLLABORATION.md` — 协作规程 v1（属地/提交纪律/端口/验收门）
   - `docs/AI-HANDOFF.md` 文末最近 5 行 — 成员信箱最新动态
2. 硬规则摘要（详见 COLLABORATION.md）：
   - 完工即 commit；动工前 `git pull --ff-only`；main 仅 step-5 push
   - 改他人属地前先在信箱登记
   - 禁止裸 `git stash`（共享树互吞），用带标签 stash 或备份到 E:\WorkSpaces\QoderCache\
   - 交付验收门：tsc 0 错 + npm run build 过 + 整关自动巡航 + 面板常开 rAF ≥ 50fps
3. GitHub token 曾泄露于对话——不要在任何文件/remote 中写入 `ghp_` 密钥。
