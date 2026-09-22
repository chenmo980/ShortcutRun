# Shortcut Run 复刻 · 灰模原型 v0.2

**零装配版**：场景和灰盒都由仓库内置/代码生成，不需要做 prefab、不需要挂脚本。

## 1. 环境

- Cocos Creator **3.8.x**（Cocos 官网下载，Dashboard 安装）
- 微信开发者工具暂时不用（等接广告/上架阶段）

## 2. 打开项目

Cocos Dashboard → **导入** → 选择本目录 `shortcut-run`。

> 如果 Dashboard 不认这个目录：新建一个空的 **3D** 项目，把本项目的 `assets/` 文件夹整个覆盖进去。

## 3. 运行（就两步）

1. 资源管理器里双击 **`assets/scenes/game.scene`**（Bootstrap 节点已挂好 GameApp，相机已内置）
2. 编辑器顶部按 **▶**，然后**点击一下画面**开始

成功的标志：控制台出现 `[ShortcutRun] 第 1 关 (seed 1001) 断崖=... 拾取=... 门需求=10`，屏幕里出现深色跑道、黄色砖块、头戴纯金紧箍与凤翅双雉翎的齐天大圣孙悟空（按 C 键可随时切换角色）。

| 操作 | 按键 |
|---|---|
| 开始 | 任意点击 / 任意键 |
| 转向 | 鼠标拖动 / 触屏滑动，或 `A`/`D`、`←`/`→` |
| 场景换肤 | **`T`**（白天原版 / 城市 / 糖果 / 霓虹等主题轮换） |
| 角色换装 | **`C`**（国风角色换装：默认【齐天大圣 孙悟空】 / 莲花哪吒 / 青莲剑客 / 功夫熊猫 / 国潮刺客 / 经典跑者） |
| 音效开关 | **`M`** |
| 重开 | 胜利/失败后自动进入下一关/换图重试（浏览器版有开始界面和结算面板） |

规则：自动前进 → 吃砖块（身后拖砖堆 = 携带量）→ 断崖处砖够自动拍桥下来、砖不够掉落 → 终点门验砖。**赢了进下一关（L1-L10 难度递增，进度和星级自动存档），输了同关换图重试。**

道具（复刻原版，第 3 关起逐步解锁）：**+N 门**（蓝底，过门加砖）/ **×2 门**（红底，过门砖数翻倍）/ **加速鞋**（拾取后 3.5 秒提速 1.35 倍）。道具纯增益，不影响关卡可通关性（母本数学锁死）。

> 想先体验也行：双击 `web-preview/index.html` 浏览器直接玩（逻辑相同，还带进度条）。

### 3.5 HUD（可选，约 3 分钟）

不配也能玩（砖块数/进度看控制台），但试玩时建议配上：

1. 层级右键 → **创建 → UI → Label**（引擎会自动生成 `Canvas` 和 UI 相机），命名为 `BrickLabel`，拖到屏幕上方中间，字号调大（如 60）
2. 再建 Label 命名 `HintLabel`（屏幕中央）和 `ProgressLabel`（BrickLabel 下方）
3. `Canvas` 节点挂 **GameUI** 组件，把三个 Label 分别拖到对应字段

效果：上方常驻“砖块 N / 进度 xx%”，中央显示关卡提示（含本关最佳成绩）/ 胜利星级 / 失败原因。

## 4. 兜底：如果 game.scene 打不开/报错

删掉 `assets/scenes/` 整个文件夹，改手动装配（5 分钟）：

1. 资源管理器右键 → 创建 → Scene，命名 `game`，双击打开
2. 层级树右键 → 创建空节点，命名 `Bootstrap`
3. 右边属性检查器 → 添加组件 → 用户脚本 → **GameApp**（BoxPrefab 留空即可，代码会自动造灰盒）
4. 场景里应有 `Main Camera`（没有就右键创建 Camera 节点改名为 `Main Camera`）
5. 按 ▶ → 点击开始

## 5. 调参（手感不对就改这里）

| 文件 | 管什么 |
|---|---|
| `assets/scripts/config.ts` | 手感参数（速度/转向/相机） |
| `assets/scripts/LevelCurve.ts` | L1-L10 难度曲线（断崖宽窄/间隔/门需求/速度） |
| `assets/scripts/Theme.ts` | 主题色表（换肤改这里） |

## 6. 决策关口（G1）

**连玩 30 分钟。** 还想再来一把 = 立项成功，进入下一阶段（UI 打磨/音效/广告 SDK）；觉得无聊 = 趁早砍，只亏两周。

## 7. 测试

```bash
node tools/smoke.ts          # 关卡生成器：parity + 200 种子不变量 + bot 通关率 + progression
node tools/verify-web.mjs    # 浏览器版端到端 13 项断言
node docs/qoder/sim.mjs      # 规则母本验收套件（Qoder 维护）
```

## 8. 构建微信小游戏（V5 已实测通过）

命令行一键构建（编辑器无头模式，约 1-2 分钟）：

```bash
& "E:\Program Files (x86)\CocosDashboard\CocosCreator.exe" --project "E:\WorkSpaces\WxSoftWare\shortcut-run" --build "platform=wechatgame"
```

产物在 `build/wechatgame/`（当前 **1.96MB / 24 文件**，低于 4MB 主包上限）。已验证：全部 21 个脚本打入 `assets/main/index.js`，game.js/game.json 齐全。

**真机预览**：打开微信开发者工具 → 导入 `build/wechatgame` → 项目类型选**小游戏** → 点预览扫码真机试玩。

### 已知坑：基础库灰度导致启动崩溃

若真机/模拟器报 `Cannot set property window of #<Window> which has only a getter`（`__initApp` 崩）：
**是微信开发者工具开了“灰度基础库”**，与 Cocos 适配层冲突。修复（30 秒，永久）：
1. 开发者工具右上角 **详情** → **本地设置**
2. 取消勾选 **“使用灰度基础库”**（或把基础库版本选回正式版）
3. 点**编译**重新运行

控制台里 `[jsbridge] invoke getSystemInfo fail: jsbridge not ready` 是启动早期正常噪音，不用管。
多机器统一可用 `node tools/patch-wechat-lib.mjs <正式版版本号>` 钉死构建产物的 libVersion。

工程要点：
- `settings/v2/packages/project.json` 已配竖屏 720×1280 + 起始场景
- `settings/v2/packages/engine.json` 已裁掉物理/spine/龙骨等未用模块（4.42MB → 1.96MB）
- `assets/scenes/game.scene` 只含 Bootstrap 节点（相机由代码运行时自建）——手写场景若带手抄的 Camera/DirectionalLight 组件会导致构建期反序列化失败
