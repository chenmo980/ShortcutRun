# 任务队列（QUEUE）· 跨会话不断线

> 目的：任何 AI（或人类）随时打开这个文件就知道“下一步该干什么”。
> 规则：
> 1. 认领任务 = 把状态改为 `[doing: <名字>]`，做完改 `[done: <名字>]` 并写结论一行
> 2. 新增任务 = 追加到末尾，带优先级（P0 今天 / P1 本周 / P2 排期池）
> 3. Qoder 心跳（3 次/日）读本文件，有 `[todo]` 且 @过自己的就做；step-5 会话开工也读
> 4. 这是“半自主”兜底：即使所有 AI 都离线，任务不丢、意图不丢

## 当前队列

- [todo] [P1] 微信导出 `--core` 文档化：等 `src/game/core.ts`（Qoder 刀1 三拆片）就绪后，把 `tools/wechat-export.mjs --core` 从占位改为真实打包（vite 抽 game 入口 → wx.createCanvas 壳 → 包体 <4MB 校验）。负责人：step-5
- [todo] [P1] 刀1 片1 渲染骨架：`src/game/core.ts` 导出 `createGame(canvas)` → `{start,stop}`，场景图/渲染循环下沉，GameCanvas 变薄壳；验收=lint+build+verify-app 10/10+rAF≥50。负责人：qoder（排期待用户 G1 后确认）
- [todo] [P2] replica-gap 剩余 P1-P2 项（M6 刷新区间、M8 扒边演出、M11 倍率 15 档、C1 低机位、J3 落水演出）——用户 G1 手感裁决后排期。负责人：待定
- [todo] [P2] 安全事项：请用户吊销聊天记录中明文出现过的 GitHub token（2026-09-24 推送用）。负责人：human

## 已完成（滚动归档，只留最近 10 条）

- [done: qoder] 2026-09-24 视觉轮 15-22（甲板铺装/板类单材质 DC 558→114/首帧编译治理）— 合并态三门禁全绿
- [done: step-5] 2026-09-24 声音开关默认关闭 + 工具条 🔊/🔇 按钮 + verify-app 守卫 — e1a358d..8176a90 已推送
- [done: step-5] 2026-09-24 gateway --live 真身唤醒链（@qoder → qoder -p --permission-mode auto）— Qoder 19:45 实证
- [done: qoder] 2026-09-24 值守双轨定稿（SAFE 铃 + 3 次/日心跳）
- [done: step-5] 2026-09-24 红海区铺板机制还原 + 海缺口 —— e8fa489
