# 任务看板

> 规则见 AI-TEAM.md：两个文件两个门禁。本文件 = 看板 + DeepSeek 草稿收货区 + 资产记录。

## 进行中

- [ ] **G1 手感门禁**：在 Cocos 里试玩灰模版，反馈手感（速度/转向/难度）——阻塞后续资产投入，只有你能过这关

## 已完成

- [x] v0.1 灰模原型：GameApp 状态机 + TrackBuilder + LevelGen（2026-09-20）
- [x] 冒烟测试 tools/smoke.ts 50 种子全绿
- [x] HUD：GameUI.ts + SETUP.md 4.5 装配步骤（2026-09-21，待试玩验证）
- [x] AI-TEAM.md v2 最小协作方案
- [x] 本地 git 仓库初始化 + 首次提交

## 阻塞

- [ ] 推送到 GitHub（chenmo980/ShortcutRun）：**MCP 令牌无写权限**。解法二选一：
  - 给 opencode 的 github MCP 配上你有写权限的账号 token；或
  - 本地 `gh auth login` 后用 git push（远程已配为 origin）

## 待办（G1 通过后按序）

- [ ] Mixamo 角色替换灰盒（自动绑骨 + run/fall/win 动画）
- [ ] 微信小游戏构建 + 真机预览
- [ ] 主题换肤系统（同几何体换配色）
- [ ] 广告 SDK（banner/激励视频）
- [ ] 音效（Suno/免费素材）

## DeepSeek 草稿收货区

（产出一律进 `docs/drafts/`，orchestrator 审查后才合并，DeepSeek 不直接改工程）

| 日期 | 任务 | 文件 | 状态 |
|---|---|---|---|
| | | | 空 |

## 资产记录

| 资产 | 来源 | 规格 | 状态 |
|---|---|---|---|
| box.prefab（灰盒） | 编辑器手搓 | 1x1x1 | 使用中 |
