# 任务看板

> 规则见 AI-TEAM.md：两个文件两个门禁。本文件 = 看板 + DeepSeek 草稿收货区 + 资产记录。

## 进行中

- [ ] **G1 手感门禁**：Cocos 双击 `assets/scenes/game.scene` 按 ▶ 即玩（或浏览器版 `web-preview/index.html`），反馈手感，裁决玩法去向
- [ ] 素材采购：音效 4 件套（见 `docs/audio-assets.md`，放进 `assets/resources/audio/` 即生效）
- [ ] Cocos UI 面板搭建（按 SETUP.md 3.5 挂 Label，10 分钟）
- [ ] V5 微信小游戏构建 + 真机预览（按 `docs/wechat-build.md` 执行）

## 今晚完成（2026-09-21 夜~22 凌晨）

- [x] T1 开始界面：标题/开始按钮/最高进度/操作说明（浏览器版）
- [x] T2 结算面板：星级弹出动画/用时/余砖/最佳成绩/下一关与重试按钮
- [x] T3 HUD 精修：砖块图标、渐变进度条、关卡徽章
- [x] T4 Cocos GameUI 扩展：结算行（星级/用时/最佳）+ 关卡徽章
- [x] T5 音效管线：AudioMgr.ts 骨架（素材即插即用）+ docs/audio-assets.md 采购清单
- [x] T6 微信构建预演：docs/wechat-build.md（竖屏/包体预算/真机清单/已知坑）
- [x] T7 全量回归：smoke + verify-web 11/11 + sim 25 项全绿
- [x] Q5 主题规范落地：theme.mjs 断言锁 + PROPOSALS 修复色已并入 Theme.ts（day/city/candy 三盘全过对比度+色盲规范）
- [x] Q6 G1 数据回调方案：docs/qoder/g1-tuning.md（Qoder 交付）
- [x] v4 道具系统移植（Qoder）：±N 增减门 + 速度鞋，默认关闭（字节锚不变），母本 §19-§21 全锁

## 第二批：G1 反馈批量改进（2026-09-22，用户四类全中后）

- [x] J1 爽感反馈：吃砖浮动 +N / 铺桥震屏+轻微减速 / 速度 FOV 冲刺(45→53) / 掉落震屏（双版本）
- [x] J2 视觉信息量：道路白边线 / 断崖前黄黑警示条纹 / 主题两侧建筑群 26 栋（双版本）
- [x] J3 难度可读性：开始界面显示本关目标（终点需 X 砖 · 3★ ≤Xs 且余砖≥3）
- [x] J4 操作手感：铺桥瞬间减速 ×0.55（落桥停顿感）、FOV 随速度冲刺
- [x] J5 Cocos 同步：CameraFollow 震屏+FOV / TrackBuilder 边线警示建筑 / Theme building 色键
- [x] J6 三套件全绿（verify-web 升至 13 项，含 Qoder 加的道具门断言）
- [ ] **失败慢动作**（浏览器版已有 slow-mo；Cocos 版待接 director.timeScale）
- [x] T8 PAR 星线换表同步（2026-09-22）：Progression.ts + web-preview 内联改走 parFor(level)（loop 补偿 +2.5s/loop，修 L11+ 三星恒不可达）；smoke 新增 PAR 漂移锁 L1-L60；§17 转绿

## 本波（2026-09-22 弯道/遥测/协作，step-5 推送）

- [x] 怀里搬木板 + 弯道系统（表现层 sin 弯曲，LevelGen 零改动保 parity）双版本落地 8f30c51
- [x] dumpTelemetry() 采纳（__game 一键导出 events.json，G1 数据回流闭环）dea55fd
- [x] Qoder 弯道审计两点采纳：pickup/鞋 mesh 改 `bendX(z)+x*cos(h)` 切线系；restart/resetProgress 后 pushEvent 带 qa:true
- [x] curveFor 母本化收编（Qoder levels.mjs + sim §22 双端锁）随波入库，sim 38 项全绿
- [x] K2 投递收货：docs/k2/（ad-spec / bundle-budget / device-matrix / README）入仓；回执=K4-K8 待补实存、广告事件隔离、统计母本唯一
- [x] 四门回归：tsc 0 错（本地 TS 5.9.3）/ smoke / sim 38/38 / verify-web 13/13
- [x] package.json 增 devDependencies.typescript + package-lock；.gitignore 补 node_modules/

## 时间预期（说实话）

| 里程碑 | 时间 | 说明 |
|---|---|---|
| 能看的 Demo（角色+主题+UI+音效） | **已达成** | 2026-09-22 凌晨交付 |
| 能真机玩的微信版 | 半天 | 按 wechat-build.md 走一遍构建 |
| 能上架卖广告的商品 | **1-3 个月** | 大头是版号等待（compliance.md 排期）+ 留存调优 |

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
- [x] **S1 Cocos 零装配**：内置 game.scene + BoxFactory 程序化灰盒，双击场景按 ▶ 即玩（2026-09-21）
- [x] **移植 genLevelV2**（Qoder 母本）：修复 D1（2.75% 数学不可通关）+ D2（16.4% 前缀死局），bot 通关率 82%→100%；smoke 增加 parity/D1/D2/bot 四断言全绿
- [x] Qoder Q2/Q3/Q4 交付并审阅：规则母本包 docs/qoder/ + balance-v1.md（L1-L10 曲线）

## 阻塞

- [ ] 本地 `git push` 默认走 chenmo980-hue 凭证会 403；当前靠一次性 PAT URL 推送。建议在 Windows 凭据管理器更新 github.com 凭证
- [ ] **AI Studio 占仓事件后排期**：远程备份二选一——① MCP 通道推全量到 lark980-web/ShortcutRun（约 50 文件，three.min.js 走 CDN）② 用户新建仓库 + 给 PAT，git 直推（含完整历史）。本地 + bundle + F 盘副本已三重保全

## 待办（G1 通过后按序）

- [x] Mixamo 角色替换灰盒 → 已改为 AI Studio 关节角色移植（CharacterRig.ts，零素材）
- [ ] 微信小游戏构建 + 真机预览（wechat-build.md）
- [x] 主题换肤系统（Theme.ts 五盘，Q5 规范锁）
- [ ] 广告 SDK（banner/激励视频）
- [ ] 音效（audio-assets.md 清单，素材即插即用）

## DeepSeek 草稿收货区

（产出一律进 `docs/drafts/`，orchestrator 审查后才合并，DeepSeek 不直接改工程）

| 日期 | 任务 | 文件 | 状态 |
|---|---|---|---|
| | | | 空 |

## 资产记录

| 资产 | 来源 | 规格 | 状态 |
|---|---|---|---|
| box.prefab（灰盒） | 编辑器手搓 | 1x1x1 | 使用中 |
| art-studio（3D美术工作台） | AI Studio | React + Three.js 独立子目录 | 使用中（主干落地 CharacterRig.ts + web-preview） |
