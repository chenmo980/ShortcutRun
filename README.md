# ShortcutRun

Shortcut Run（VOODOO）玩法的微信小游戏复刻 · **灰模原型 v0.1**

- 引擎：Cocos Creator 3.8
- 状态：玩法闭环已完成，等待手感验证（G1 门禁）
- 玩法：自动前进 → 吃砖块 → 断崖处砖够自动铺桥、砖不够掉落 → 终点门验砖开门

## 快速开始

1. Cocos Dashboard → 导入 → 选择本目录
2. 层级管理器右键 → 创建 → 3D 对象 → Box，拖到 assets 生成 `box.prefab`
3. 新建场景，根节点建空节点挂 `GameApp` 组件，拖入 prefab
4. 按 ▶ 预览：鼠标拖动 / `A` `D` 转向

详细步骤、调参说明见 [SETUP.md](SETUP.md)。

## 目录

```
assets/scripts/   全部游戏逻辑（config.ts 是唯一数值源）
tools/smoke.ts    关卡生成器测试（node tools/smoke.ts）
SETUP.md          装配与调参文档
AI-TEAM.md        多 AI 协作方案
```

## 测试

```bash
node tools/smoke.ts
```
