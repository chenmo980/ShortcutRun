# QODER.md — Qoder agent 项目入口

协作总规则见 `AGENTS.md` 与 `docs/COLLABORATION.md`（同一套，勿分叉）。

Qoder 专属备忘：
- 属地：`src/utils/`、`src/data/`、`docs/qoder/`、headless 验证脚本、性能协调
- dev 端口用 3001（3000 归 step-5）：`npm run dev -- --port 3001`
- npm 安装需 `--legacy-peer-deps`（vite8 peer 冲突）；recharts 的 react-is 已补进 package.json
- 性能基线：面板常开 55-60fps；已知余项 Recharts 1Hz ~100ms 尖峰
- 恢复点：旧 Cocos 全量=git 对象 `3ba5637`；未提交补丁⑧⑨⑩=带标签 stash `qoder-20260924-1521-prepull` + `E:\WorkSpaces\QoderCache\prepull-20260924\`
