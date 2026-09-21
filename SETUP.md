# Shortcut Run 复刻 · 灰模原型 v0.1

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

成功的标志：控制台出现 `[ShortcutRun] 关卡 seed=1 断崖=5 拾取=10 ...`，屏幕里出现灰色跑道、黄色砖块、蓝色小人。

| 操作 | 按键 |
|---|---|
| 开始 | 任意点击 / 任意键 |
| 转向 | 鼠标拖动 / 触屏滑动，或 `A`/`D`、`←`/`→` |
| 重开 | 胜利/失败 1.6 秒后自动重开 |

规则：自动前进 → 吃砖块（身后拖砖堆 = 携带量）→ 断崖处砖够自动拍桥下来、砖不够掉落 → 终点门验 14 砖，够就开门胜利。

> 想先体验也行：双击 `web-preview/index.html` 浏览器直接玩（逻辑相同）。

## 4. 兜底：如果 game.scene 打不开/报错

删掉 `assets/scenes/` 整个文件夹，改手动装配（5 分钟）：

1. 资源管理器右键 → 创建 → Scene，命名 `game`，双击打开
2. 层级树右键 → 创建空节点，命名 `Bootstrap`
3. 右边属性检查器 → 添加组件 → 用户脚本 → **GameApp**（BoxPrefab 留空即可，代码会自动造灰盒）
4. 场景里应有 `Main Camera`（没有就右键创建 Camera 节点改名为 `Main Camera`）
5. 按 ▶ → 点击开始

## 5. 调参（手感不对就改这里）

全部在 `assets/scripts/config.ts`：

| 参数 | 作用 | 调整方向 |
|---|---|---|
| `runSpeed` / `speedPerBrick` / `maxSpeed` | 速度与加速感 | 觉得肉就先加 20% |
| `steerSpeed` / `steerPerPixel` | 转向跟手度 | 觉得涩就加大 |
| `gapWidthMin/Max`、`gapIntervalMin/Max` | 难度曲线 | 太难就缩窄断崖/拉大间隔 |

`seed`（GameApp 组件上）换数字 = 换一张关卡图。

## 6. 决策关口（G1）

**连玩 30 分钟。** 还想再来一把 = 立项成功，进入 v0.2（Mixamo 角色/广告 SDK/主题换肤）；觉得无聊 = 趁早砍，只亏两周。

## 7. 测试

```bash
node tools/smoke.ts          # 关卡生成器 50 种子不变量
node tools/verify-web.mjs    # 浏览器版端到端 10 项断言
```
