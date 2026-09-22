# 3D Art Studio & Character Workbench (美术与模型工作台)

本目录为《Shortcut Run》的交互式 3D 美术、模型、着色器与动力学调参工作台（React + Vite + Three.js）。

## 核心职责与分工
- **责任主体**：AI Studio（美术与模型专属）
- **交付内容**：
  - `src/components/characterBuilder.ts`：零素材 3D 人物骨骼网格装配体系与动画动力学母本。
  - `src/components/GameCanvas.tsx`：3D 交互视角与动态实时调试。
  - `src/data/themes.ts`：4 套符合 Q5 规范的主题调色盘与卡通水着色器。
  - `docs/ART-SPEC.md`：美术与骨骼动画技术规格说明书。
- **落地对应**：
  - Cocos 引擎端：已由主干集成入 `assets/scripts/CharacterRig.ts`。
  - 网页端预览：已由主干集成入 `web-preview/index.html`。

## 本地启动与调试
```bash
cd art-studio
npm install
npm run dev
```
可在浏览器中 360° 旋转视角调试角色细节（立体碎发、腮红、微笑、脚踝滚动步态、负重倾斜等）。
