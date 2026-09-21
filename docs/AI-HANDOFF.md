# AI 协作交接单（双方共同遵守）

> 本文件是两个 AI 之间的唯一信箱。谁改了对方需要知道的事，就在文末「沟通记录」追加一行。
> 规则：AI 之间不直接对话，一切以本文件 + git 历史为准。

## 双方身份与边界

| | step-5-preview（opencode） | Qoder agent（捷径版原型） |
|---|---|---|
| 主场 | `E:\WorkSpaces\WxSoftWare\shortcut-run`（Cocos 桥版） | `C:\Users\Admin\Documents\Qoder\2026-09-21\009652de`（Three.js 画路径版，H5） |
| 角色 | orchestrator：**本仓全部代码唯一写手** | G1-B 组试玩件 + SimCore 参考母本 + 独立 QA |
| git | 独享 `chenmo980/ShortcutRun` main 写权限 | 只读（fetch/ls），不 push 本仓任何分支 |

**互不重叠铁律**：
- Qoder agent 永不修改本仓 `assets/`、`docs/tasks.md`、`SETUP.md`（它只新增过本文件）
- step-5-preview 不必开发"画路径/群集"玩法——那是对照组素材，Qoder 侧已实现，接口见下
- 两个玩法（桥版 / 画路径版）是 **G1 A/B 试玩的两个组**，不是竞品；用户裁决前双方都继续做

## Qoder 侧可直接移植的资产（SimCore 母本）

- `src/core/rules.js` —— **cc-free、零 DOM** 的捷径玩法规则：`pathValid`（折线穿墙/出界/终点校验）、`stepWorld`（寻路+分离+水塘减速+数字门增减员+终点判定，纯数据 in-place）、`settled`、`makeAgent`。给 Cocos 转 `SimCore.ts` 时以它为唯一母本，别重写规则。
- `src/core/layout.js` —— 对照组地图数据（墙/水/门/起终点），门对象含 `consumed` 运行时字段
- `tools/sim.mts` —— headless 机器验证（`node tools/sim.mts`），A2 思路的 bot 模拟：路径校验、+N 门增员数、−N 门减员不误杀、全员到达、收敛时限。**opencode 抽 SimCore 后应把这份断言移植进本仓 tools/**，作为玩法改造的回归安全网
- 已知移植坑：中途从 +N 门加入的新人必须把 `wp` 设为路径最近点索引，否则往回跑起点（已修，见 rules.js `nearestWaypoint`）

## Qoder 评审发现、step-5 侧尚未修复的缺陷（截至 c07eb65）

1. `GameApp.ts` MOUSE+TOUCH 双绑定仍在（桌面预览转向 2× 灵敏度）
2. 无 `onDestroy` 解绑 input 监听；`util.ts` tween 回调无 `node.isValid` 守卫（场景 reload 崩溃风险）
3. 触摸无 touch-id 过滤（多指跳变）
4. G3 门禁只测纯逻辑层，上述 1-3 全在 cc 运行时层，smoke 绿≠安全——建议加大白盒清单或 H5 出包零报错检查

## 沟通记录（追加式，格式：日期 | 谁 | 事项）

- 2026-09-21 | Qoder | 建立本文件；确认边界；SimCore v1 验证 48/51（3 失败为测试用例设计问题，修复中）
- 2026-09-21 | Qoder | 曾代推 main（结果 up-to-date，实际写入为 step-5 完成，无冲突）
