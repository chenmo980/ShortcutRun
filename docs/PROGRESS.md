# 项目进度报告

> 更新时间：2026-09-26 · 架构：Three.js + React 19 + Vite 8（Web 工作台）→ 微信小游戏 · 仓库：chenmo980/ShortcutRun（main）

## 一句话

复刻 VOODOO《Shortcut Run》（铺路过断崖跑酷）：3D 可玩工作台已闭环，**游戏运行时已抽成零 React 的 `src/game/core.ts`**，微信导出链路 spike 通过，下一步真机预览 → G1 真人试玩 → IAA 变现。

## 现在就能玩（1 分钟）

```bash
cd E:\WorkSpaces\WxSoftWare\shortcut-run
npm install --legacy-peer-deps   # 首次
npm run dev                     #  http://localhost:3000
```

操作：自动巡航默认开；`A`/`D` 或拖动转向 → 拾木板 → 断崖自动铺板过海 → 登顶倍率阶梯结算；`空格`暂停、`R`重开、`1`-`6`秒传路段；右侧 Art Studio 切主题/角色/板皮/物理手感参数。

## 当前架构（2026-09-26 core 抽取后）

| 层 | 文件 | 职责 |
|---|---|---|
| 游戏运行时 | `src/game/core.ts`（2060 行） | 纯 Three.js：场景/赛道/角色/桥板/拾取/阶梯/龙门、仿真、输入总线、音频、遥测。**零 React、零 JSX，唯一 DOM 触碰=可注入的 make2D 工厂** |
| Web 薄壳 | `src/components/GameCanvas.tsx`（407 行） | HUD/工具条/秒传条/结算弹层；订阅 core `onEvent` 帧末 flush 事件 |
| 角色 | `src/components/characterBuilder.ts`（1452 行） | 程序化 articulated 角色（9 预设）+ IK 抱持动画 |
| 工作台 | `src/components/ArtStudioPanel.tsx` | 主题/板皮/物理/IK 调参（含 Cocos 导出模态） |
| 遥测 | `src/components/PerformanceMonitor.tsx` + `src/utils/metricsStore.ts` | Recharts 波形（1Hz）+ 外部 store（useSyncExternalStore） |
| 小游戏导出 | `tools/wechat-export.mjs`（step-5） | `--dry-run` 报告 / `--core` 将 core 壳换成 `wx.createCanvas` |

core 入口（小游戏与 Web 同接口）：

```ts
const game = createGame({ canvas | parent, width, height, palette, settings, devicePixelRatio, create2DCanvas });
game.start(); // wx.onTouch 写 game.input{left,right,dragging}
```

## 已完成（含自动化证据）

| 模块 | 状态 | 验证 |
|---|---|---|
| 玩法闭环（前进/拾板/铺桥/落水/倍率登顶） | ✅ | verify-app 11/11：进度 48→105m、双海缺口铺板 141m 未溺水 |
| 弯道 + 缺口铺板物理（摩擦力/侧滑/浮力弹簧可调） | ✅ | 轮97-100a 提交链；缺口行板按水道实宽铺满 |
| 程序化角色 9 预设 + 抱板 IK | ✅ | 角色切换断言 + 三镜头走查可交互 |
| 主题换肤全套色板 | ✅ | 栈台与玩家板皮解耦（轮100a） |
| 性能（DC 111 / FPS60 稳态） | ✅ | 阴影 20Hz、实例化拾板/桥板/栈台、遥测节流 |
| core 抽取（刀1/2/3） | ✅ | tsc 0 错 / build 17s / 门禁 11/11；输入探针数值实证 |
| 微信导出 spike | ✅ | 2.69MB < 4MB 预算；core-only bundle 实测 0.52MB |

## 质量数据（QA 口径）

- 门禁三件套：`npm run lint`（tsc 0 错）→ `npm run build` → `node tools/verify-app.mjs`（无头 :3000，11 项断言）
- 稳态 55-60 FPS；draw calls 91~112（语义见性能基线 QODER.md）
- 输入手感参数（拖拽 0.042/px、KeyD 攻击曲线 0.18s）由 76/输入探针两轮实证锁定

## 分工（详见 `AI-HANDOFF.md`）

| 成员 | 地盘 | 当前任务 |
|---|---|---|
| Qoder | GameCanvas / characterBuilder / data/* / src/game/* | core 抽取（已完）→ 合流 main → 视觉/手感打磨 |
| step-5 | tools/* / vite.config / index.html / 集成 / main 推送 | `wechat-export.mjs --core` 对接 → 包体 dry-run → 集成推送 |
| 人类 | 手感裁决 / 审美 / 合规 / G1 试玩 | 微信开发者工具真机预览（人工） |

## 下一步

1. core 合流 main 并保持门禁绿（进行中）
2. `wechat-export.mjs --core` dry-run：包体预算核对 + 开发者工具真机预览四件事（WebGL渲染/触控/帧循环/包体）
3. G1 真人试玩门禁：真人"还想再来一把" → 不过则调手感不进发行
4. IAA 广告接入（规格见 docs/k2/）→ 软著/版号并行推进

## 风险与阻塞

| 风险 | 状态 | 对策 |
|---|---|---|
| 版号 3-6 个月 | 最大外部依赖 | 开发版先做数据留存，资质并行 |
| 微信真机触控手感（屏宽缩放） | 待裁决 | 真机预览后按 G1 反馈调 input 总线参数 |
| 玩法红海 | 关注中 | G1 后加差异化微创新再上量 |

## 给新成员（3 分钟上手）

```bash
npm run lint                    # tsc --noEmit（门禁一）
npm run build                   # 门禁二
node tools/verify-app.mjs       # 门禁三（无头 11 断言；APP_URL 可换端口）
node tools/chat.mjs tail 10     # 查 AI 协作室
```

- 协作规则/属地/端口：`AI-HANDOFF.md`（仓根唯一信箱）+ `AGENTS.md`（开机规程）
- 手感/数值调参：Art Studio 右侧物理面板 → `src/data/physicsPresets.ts`
- core 接口：`src/game/core.ts` 顶部 `CreateGameOptions` / `GameHandle`
