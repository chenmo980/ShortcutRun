# 任务看板

> 2026-09-26 重写：Cocos 时代旧档已冻结（历史见 git），本看板只记当前 Three.js 架构。协作规则见仓根 `AI-HANDOFF.md`。

## 进行中

- [ ] **G1 手感门禁**：浏览器工作台（`npm run dev` → :3000）试玩，真人反馈裁决"还想再来一把"
- [ ] **微信真机预览**（step-5 出包 + 人工）：`wechat-export.mjs --core` → 开发者工具导入验四件事（WebGL渲染/触控/帧循环/包体）
- [ ] core 合流后持续门禁值守（每轮三门绿）

## 里程碑

| 里程碑 | 状态 | 说明 |
|---|---|---|
| 能玩的 3D 复刻（Web） | ✅ 2026-09-26 | 玩法闭环 + 9 角色 + 主题换肤 + 物理手感可调 |
| core 抽取（微信前置） | ✅ 2026-09-26 | `src/game/core.ts` 零 React；GameCanvas 407 行薄壳 |
| 微信导出技术排雷 | ✅ spike 2.69MB | `--core` 待 core 合流后 dry-run（预算 4MB；core-only bundle 实测 0.52MB） |
| 微信真机可玩 | ⏳ | 需人工（开发者工具在人手） |
| IAA 上架 | ⏳ | 版号 3-6 个月并行推进（docs/k2/ 规格） |

## Qoder 本轮（core 抽取，2026-09-26）

- [x] 刀1 渲染骨架：`createGame` → start/stop（6af35ac）
- [x] 刀2 输入总线：window→`input{left,right,dragging}` 抽象，wx.onTouch 同接口
- [x] 刀3 音频/结算/遥测：sound+metricsStore 留 core；confetti 移壳（finished 事件）
- [x] 门禁：tsc 0 错 / build 17s / verify-app 11/11
- [x] 输入探针：拖右 playerX+8.9（同 r76 口径）、KeyD/KeyA ±14、Space 暂停、秒传 3 落点正确、0 pageerror
- [x] 分支合流 main（a1f2e43），信箱登记 + 室帖通告
- [x] 竖屏 414×896 终验（c5ef714 后补测）：FPS 60→60、进度 85→131m、画布中心 200×200 零 HUD 遮挡、0 pageerror
- [x] node 导入自验（无 DOM 环境 require core）：getTrackCenterX/getGroundHeight/SECTION_SHORTCUTS/createGame 断言全过
- [x] 微信包体预算核验：core-only bundle 实测 0.52MB（< 4MB 预算，含 three.js）

## step-5 待办（出自我方通告）

- [ ] `wechat-export.mjs --core`：入口传 `{canvas: wx.createCanvas(), width, height, devicePixelRatio, palette, settings}`
- [ ] 包体 dry-run 报告 + 门禁断言接入（check-bundle）
- [ ] main 集成推送（我方不推 main）

## 待办（G1 通过后按序）

- [ ] 音效素材采购（现在为 WebAudio 合成，够 G1）
- [ ] 广告 SDK 接入（docs/k2/ad-spec.md → 小游戏侧 AdMgr）
- [ ] 竖屏适配终验：414×896 下 HUD 遮挡/触控灵敏度按 G1 反馈调
- [ ] 遥测 G1 schema 落地（level/seed/outcome/t/planksLeft/failZ）

## 阻塞

- [ ] 微信真机预览必须人工（开发者工具在人手）
- [ ] 本地 git push 凭证 403 时用一次性 PAT URL（token 禁入库/聊天，见 AGENTS.md 安全红线）

## 资产记录

| 资产 | 来源 | 状态 |
|---|---|---|
| 程序化角色（9 预设） | characterBuilder.ts | 使用中 |
| 主题色板（多套） | src/data/themes.ts | 使用中 |
| 微信导出 spike 壳 | tools/wechat-export.mjs | --core 待对接 |
