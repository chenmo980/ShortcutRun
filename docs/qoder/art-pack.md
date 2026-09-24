# 美术规格包 v2.x（源：art-studio 重制版，用户 2026-09-22 推送）

> Qoder 提炼投递。源分支 = 本地 `art-studio`（= 用户 force-push 的 origin/main 内容，
> commit 3b977d7，React+Vite+three 工作台，与主工程**零共同历史**）。
> 独立 worktree 只读评估：`E:\WorkSpaces\QoderCache\art-studio`（勿在主工作区 pull/merge 它）。
> 本包 = step-5 把工作台视觉移植到 web-preview/Cocos 的完整参数表；配色全部过 Q5 规范（theme.mjs ARTSTUDIO，verifyAll 常绿锁）。

## 1. 四套调色板（Theme.ts 十键直抄，night 盘注意）

| 盘 | night | sky | ground | road | brick | bridge | player | limb | gate | pillar |
|---|---|---|---|---|---|---|---|---|---|---|
| voodoo 马卡龙 | - | 0xbee1e6 | 0x48cae4 | 0xffffff | 0xb45309 | 0x94a3b8 | 0x06b6d4 | 0x3a86ff | 0x8338ec | 0x1098f7 |
| tropical 海岛 | - | 0xc8e7f5 | 0x00b4d8 | 0xf5f5f4 | 0xd97706 | 0x8b5e34 | 0x005f73 | 0x94d2bd | 0xae2012 | 0x0077b6 |
| sunset 落日 | ✓ | 0x6d28d9 | 0x0e7490 | 0xe8dcc4 | 0xb91c1c | 0x7c2d12 | 0x1e40af | 0xfde047 | 0xdc2626 | 0x581845 |
| cyberpunk 霓虹 | ✓ | 0x0d0826 | 0x0e7490 | 0x1a1e29 | 0x00f5d4 | 0x7000ff | 0xff007f | 0xfee440 | 0x9b5de5 | 0x050517 |

与原工作台盘的差异 = 保身份最小修复（每盘改了哪几键、为什么，见 theme.mjs `ARTSTUDIO` 注释）。
night 语义：verifyTheme 第二参 `{night:true}` 或表内 `night:true`——跳过天空亮度下限与天路明暗序，配对检查全保留。
shoe 键各盘自定（柠檬黄 0xffee58 在浅路可、深路更亮），过"鞋vs路 >=2.0"即可。

## 2. 角色（characterBuilder.ts 462 行，程序化零素材，与我们 V1 同路线）

骨架（three 单位≈米，总高 ~1.5）：
- 髋组 y=0.72 → 躯干组；颈上 head 组 y=1.15，头球 r=0.32（12x10 段），castShadow
- 腿=髋→膝(-0.38)→小腿→脚(-0.36)，鞋底加白色薄底片；眼=白球+黑瞳+高光点（MeshBasicMaterial 不吃光，永远清晰）
- 胸牌 bib：白底双面片 + 数字纹理位（可放砖数！我们 HUD 已有，二选一）
- 头带 ribbon：AI 盘=发光青能量目镜（emissive 0x0891B2）

跑步动画公式（runCycle=速度定相）：
```
torso.rotation.y = sin(cycle)*0.08        // 摆背
arm.shoulder.x   = 0.58 ∓ sin(cycle)*0.08 // 双臂前抱（抱板姿，遮挡修复核心）
headband.x       = -0.35 + sin(cycle*2.5)*0.22
plankMount.x     = 0.04 + sin(cycle*2)*0.04 // 板堆随步微晃
```
**遮挡修复=木板堆从身后移到双臂前抱位**，配 55° 跟拍相机全程无遮挡——直接抄这个。
板堆几何：1.45x0.15x0.55 薄板，逐块 y+0.155 堆叠（我们的砖堆是立方体，可换薄板更"桥"）。

五皮肤（配色表在 characterBuilder.ts L53-85）：阳光活力跑者(推荐默认)/疾风暗影忍者/夏日冲浪少年/赛博潮玩特工/极简糖豆人。皮肤=纯换色+配件开关，Cocos 侧一个 switch 即可。

## 3. 渲染与相机（GameCanvas.tsx）

- `PerspectiveCamera(fov 55, near .1, far 1000)`，位 (0, 8, -11) 看 (0, 1.5, 8)；tilt 可调 30-80（工作台滑杆 55 默认）
- `FogExp2(skyBottom, 0.007)`——雾色=天底色的配方直接可用
- 阴影：PCFSoftShadowMap，dirLight 1024 图，正交范围 ±~30，far 150；**只主角/板堆 castShadow，路面 receive**（微信小游戏性能线：1024 够用）
- 材质全 MeshStandardMaterial（Cocos 对应 pbr 金属度0/粗糙度~0.8）；眼睛/文字用 Basic 不吃光
- 拾取粒子：吃板瞬间 spawn 若干 BoxGeometry 碎片+重力速度衰减（工作台 particles 数组同款，上限建议 24）
- 水面：工作台自带 Cocos 3.8 卡通水 effect 完整代码（`src/data/themes.ts` COCOS_WATER_SHADER_CODE，正弦顶点位移+泡沫阈值），可直接落 `assets/effects/water-toon.effect`；微信性能存疑时降级=静态双色水+滚动 UV 波纹贴图

## 4. 附赠（同文件）

- MIXAMO_GUIDE：4 动作选型（跑步/负重抱板跑/落水挣扎/胜利舞）+ 触发条件——V1 骨骼动画升级路线
- AI_PROMPTS：Meshy/Tripo 低模生成 + 微信封面/UI 的出图 prompt

## 5. 仓库事故通报（重要）

用户把本工作台 force-push 到了 origin/main，**主工程 15 个提交在远端已不可见**（本地完好：
HEAD 1b18e88 + 全套 docs/qoder）。已做：①全部 refs bundle 备份 `E:\WorkSpaces\QoderCache\shortcut-run-backup-20260922.bundle`；
②`git branch art-studio origin/main` 固化评估对象。
**待用户拍板**：建议 origin 上把工作台推为 `art-studio` 分支、main 由本地强推恢复（一次 force-push 找回主工程，工作台内容不丢）。step-5 在恢复前**不要 push**（会被拒或覆盖）。
