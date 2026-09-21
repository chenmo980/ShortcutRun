# 任务看板

> 规则见 AI-TEAM.md：两个文件两个门禁。本文件 = 看板 + DeepSeek 草稿收货区 + 资产记录。

## 进行中

- [ ] **G1 手感门禁**：Cocos 双击 `assets/scenes/game.scene` 按 ▶ 即玩（或浏览器版 `web-preview/index.html`），反馈手感，裁决玩法去向

## 协作格局（2026-09-21 用户确认 v2，详见 docs/AI-HANDOFF.md）

- 只做一款游戏：桥版（Shortcut Run 复刻）；画路径版停止
- step-5（我）：Cocos/微信侧全部代码 + 集成 + 构建上架 + main 唯一写手
- Qoder：cc-free 规则母本 + 关卡生成规范 + 数值平衡 + headless 验证，产出投 `docs/qoder/`，我审查后移植
- Qoder 本轮任务：Q1 确认边界 / Q2 规则母本包 / Q3 数值平衡表 / Q4 关卡不变量测试

## 已完成

- [x] v0.1 灰模原型：GameApp 状态机 + TrackBuilder + LevelGen（2026-09-20）
- [x] 冒烟测试 tools/smoke.ts 50 种子全绿
- [x] HUD：GameUI.ts + SETUP.md 4.5 装配步骤（2026-09-21）
- [x] AI-TEAM.md v2 最小协作方案
- [x] 远程仓库：origin=chenmo980/ShortcutRun（用户 PAT 推送），backup=lark980-web/ShortcutRun
- [x] 扫掠检测修复：断崖/拾取按帧位移区间判定，防低端机帧抖动穿透
- [x] docs/compliance.md 上架合规清单
- [x] **浏览器试玩版 web-preview/index.html**（2026-09-21）：零安装双击即玩，逻辑与 Cocos 版一致
- [x] **浏览器版自动化验证 10/10 全过**（tools/verify-web.mjs）：开始/吃砖/转向/铺桥/掉落/胜利/无错误/画面渲染/玩家可见
- [x] 修复：浏览器版重开关卡时玩家位置未重置——Cocos 版整场景重载无此问题
- [x] **Qoder 评审 4 项缺陷全修**（2026-09-21）：①MOUSE+TOUCH 双绑定致 PC 预览灵敏度翻倍→只绑 TOUCH_*；②补 onDestroy 解绑 input（reload 后旧实例监听残留）；③tween 回调加 node.isValid 守卫；④多指触摸忽略后续手指。详见 docs/AI-HANDOFF.md

## 阻塞

- [ ] 本地 `git push` 默认走 chenmo980-hue 凭证会 403；当前靠一次性 PAT URL 推送。建议在 Windows 凭据管理器更新 github.com 凭证

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
