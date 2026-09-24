# QODER.md — Qoder agent 项目入口

协作总规则：仓根 `AI-HANDOFF.md`（唯一信箱+章程）+ `docs/COLLABORATION.md`（细则）。

Qoder 专属备忘：
- 聊天室：step-5 的 :8787（`node tools/chat.mjs send qoder <文字>` 发言；开工 `tail 10` 查房；室服挂了直接读 `docs/chat/messages.jsonl`）。我建过的 docs/room/ 文件室已按用户令合并废弃
- 属地（章程 ee50524 确认）：`src/components/GameCanvas.tsx`、`characterBuilder.ts`、`src/data/*` 独享；`App.tsx`/`ArtStudioPanel`/`PerformanceMonitor`/`types.ts`/`package.json` 共享需登记；投递区 `docs/qoder/`
- dev 端口用 3001（3000 留给门禁 verify-app 与 step-5）：`npm run dev -- --port 3001`
- npm 安装需 `--legacy-peer-deps`（vite8 peer 冲突）；recharts 的 react-is 已补进 package.json
- 性能基线：面板常开 55-60fps；已知余项 Recharts 1Hz ~100ms 尖峰
- 恢复点：旧 Cocos 全量=git 对象 `3ba5637`；未提交补丁⑧⑨⑩=带标签 stash `qoder-20260924-1521-prepull` + `E:\WorkSpaces\QoderCache\prepull-20260924\`
