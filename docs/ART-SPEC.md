# 《Shortcut Run》美术与模型技术规格说明书 (Art & Model Spec v2.0)

> **协作职责**：美工与 3D 资产/模型担当（AI Studio）  
> **协作接口人**：opencode / step-5（Cocos 主工程集成与微信构建）、Qoder（规则母本与数值校验）  
> **生效分支**：`main`（主分支，子目录 `art-studio/` 隔离存放，不干扰 Cocos 工程）

---

## 一、 团队协作边界声明

1. **零逻辑重叠**：
   - 本工作区严格聚焦于 **3D 角色模型装配、骨骼层级、动画动力学曲线、材质调色盘与着色器（Shader）参数规范**。
   - **绝不改动** Cocos 核心代码（`assets/scripts/`）、关卡生成逻辑（`LevelGen` / `Progression`）、母本规则（`docs/qoder/`）或任何 smoke / verify 自动化门禁。
2. **交付形态**：
   - 交互式 3D 预览工作台（React + Three.js），位于 `art-studio/` 目录，可在浏览器中 360° 调试模型细节、手感反馈与材质光影。
   - 参数化骨骼/网格装配代码（`art-studio/src/components/characterBuilder.ts`），所有几何体尺寸与位置均已归一化，已由 step-5 完整映射并落地至 `assets/scripts/CharacterRig.ts` 与 `web-preview/index.html`。

---

## 二、 3D 角色骨骼与铰接层级规范 (Articulated Rigging Hierarchy)

人物采用 Low-poly 高精细化分层装配体系，解决原版与灰模“无表情、火柴人平截肢体、缺乏视觉重心”的问题：

```
root (整体位移与全局转向)
 └── torsoGroup (y: 0.72)
      ├── pelvis (y: 0.16，带双侧白色运动滚边)
      ├── chest (y: 0.55，带圆环领口包边)
      ├── raceBib (z: +0.36，带号码布与反色号码图案)
      ├── headGroup (y: 1.15)
      │    ├── headMesh (半径 0.32 球体)
      │    ├── eyes (左/右：椭圆眼白 + 深黑眼瞳 + 双对角高光微球)
      │    ├── blush (左/右：半透明珊瑚粉脸颊微片，倾角 0.55 rad)
      │    ├── smile (下颌弧形微倾笑容线)
      │    ├── hairGroup (多面体立体碎发：后脑主发簇 + 额前多层刘海 + 左右鬓角发簇)
      │    ├── headband (额前环绕运动发带 + 前额金属微徽章)
      │    └── headbandRibbons (双条脑后飘带，独立波浪震颤)
      ├── leftArm / rightArm (x: ±0.42, y: 0.72)
      │    ├── shoulder (肩关节球，与胸口平滑铰接)
      │    ├── upperArm (上臂肌群圆柱，微向前倾)
      │    ├── elbow (肘关节)
      │    ├── forearm (前臂向前伸展，z: +0.17)
      │    └── handGroup (手掌底座 + 弯曲托板四指 + 防滑拇指，自然托住木板底部)
      ├── leftLeg / rightLeg (x: ±0.20, y: 0.08)
      │    ├── hip (髋关节)
      │    ├── thigh (大腿肌肉微锥体，带短裤布料材质)
      │    ├── knee (膝关节)
      │    ├── calf (小腿肉色皮肤锥体)
      │    └── footGroup (踝关节脚掌组)
      │         ├── shoeMesh (跑鞋主鞋面)
      │         ├── sneakerSole (厚底白色高反差减震中底)
      │         ├── shoeLaces (鞋舌与鞋带条纹)
      │         └── heelTab (后跟反光提环)
      └── plankMount (y: 0.58, z: +0.62) [关键抱板点]
```

### 关键美工防遮挡规范（Plank Anti-Occlusion Rule）：
- **痛点**：原版许多换皮游戏在玩家收集超过 15 块木板时，木板直接堆在背部或紧贴胸口，追尾视角下完全遮挡人物头部、发型和动作。
- **解决方案**：`plankMount` 定位在胸前前方 `z = +0.62`，前臂向前屈伸托持。不论堆叠 5 块还是 40 块木板，人物的整个后背、发带飘扬与脚步动作**均 100% 保持清晰可见**。
- **Cocos 落地说明**：Cocos 侧追尾相机高度与俯角稍低，实装时改用了头顶堆叠挂点以适应特定机位；`art-studio` 推荐 55° 俯冲跟拍机位，两者视觉均通畅。

---

## 三、 5 套专属角色外观预设 (Character Model Presets)

| 角色类型标识 | 视觉特征与材质定义 | 适用场景 / 卖点 |
|---|---|---|
| `runner_boy` | 青绿/天蓝专业运动背心、白色短裤滚边、深棕立体刺猬头、双尾发带 | 经典主角标配，体态轻盈富有动感 |
| `chibi_ninja` | 纯黑夜行忍者面罩、额前银白护额钢板、猩红超长双飘带 | 飘带摆动幅度大，高风阻疾驰感强烈 |
| `beach_dude` | 夏威夷落日暖橙花色、青翠短裤、金发碎发造型、亮橙气垫鞋 | 假日度假风，配合落日海滩水景 |
| `voxel_bot` | 赛博机械灰金属、青色发光目镜（Emissive 0.6）、倾斜右耳天线 | 科技与速度感，带科幻流光 |
| `stickman` | 极简哑光火柴人轮廓、纯黑配亮色反差线条 | 极致轻量与高帧率表现 |

---

## 四、 运动学与动力学公式 (Kinematics & Juice Curves)

在 `characterBuilder.ts` 中封装的运行动力学，已全部落地于 `CharacterRig.ts` 与 `web-preview/index.html`：

1. **自然脚踝翻滚（Foot-Roll Gait）**：
   - 迈步前摆时（`stride > 0`）：脚掌仰角 `+0.28 rad`（脚跟触地 Heel-Strike）。
   - 蹬地后摆时（`stride < 0`）：脚尖下压 `-0.45 rad`（脚尖蹬地 Toe-Off）。
2. **负重反作用平衡（Heavy Load Counterbalance）**：
   - 负重系数：`loadFactor = min(carriedPlanks / 25, 1.0)`
   - 躯干抗压后仰：`lean = 0.18 - loadFactor * 0.08`
   - 手臂向内收紧包裹：`shoulder.z = 0.24 + loadFactor * 0.08`
   - 木板堆延迟侧倾：`stackRoll = -steerVelocity * (0.4 + loadFactor * 0.4)`，木板越多，拐弯甩尾的厚重感越强。
3. **水上铺桥俯冲投掷（Bridging Thrust）**：
   - 当状态为 `bridging` 时，双臂增加 `sin(runCycle * 3.5) * 0.22` 的高频向下推掷动作。
4. **踏地微尘与水花粒子（Step Impact Particles）**：
   - 每一个跑步相位半周期触发一次微型白色 Puff 粒子，在水面木板上疾驰时变更为浅蓝微水花。

---

## 五、 4 套主题调色盘与对比度合规矩阵 (Color Palettes)

全面兼容 Qoder 的 Q5 主题规范（明度通道 + 三色盲 Viénot-Brettel 残余）：

| 键名 | 经典海风 (Ocean) | 赛博夜景 (Cyber Neon) | 落日黄昏 (Sunset) | 薄荷森林 (Mint Forest) |
|---|---|---|---|---|
| `skyColor` | `#67E8F9` (晴空天蓝) | `#0B0F19` (午夜深空) | `#FED7AA` (落日暖霞) | `#CCFBF1` (清透薄荷) |
| `groundColor`| `#F8FAFC` (纯净浅跑道) | `#1E1B4B` (暗夜赛博道) | `#78350F` (深褐土木道) | `#134E4A` (深绿密林道) |
| `waterDeep` | `#0284C7` (深海湛蓝) | `#312E81` (霓虹深紫) | `#C2410C` (落日深橙) | `#0F766E` (碧湖深青) |
| `waterShallow`| `#38BDF8` (浅滩微光) | `#6366F1` (微光紫蓝) | `#F97316` (余晖泛光) | `#2DD4BF` (清泉泛光) |
| `plankColor`| `#F97316` (高对比活力橙) | `#F43F5E` (荧光亮粉) | `#FDE047` (明黄木块) | `#A3E635` (嫩草明绿) |
| `playerColor`| `#0288D1` (经 Q5 修正蓝) | `#06B6D4` (霓虹电光青) | `#FFFFFF` (纯白高反差) | `#F59E0B` (亮黄焦点) |
| `accentColor`| `#EF4444` (终点/警示亮红) | `#EC4899` (赛博玫红) | `#DC2626` (鲜明正红) | `#10B981` (终点翠绿) |

---

## 六、 资源交付与使用建议

- **工程隔离**：交互式 3D 工作台已完整收录在 `art-studio/` 独立子目录内，零冲突零重叠。
- **集成途径**：opencode 已完成双版本落地，后续若有新皮肤或动效微调，可通过 `docs/ART-SPEC.md` 与 `art-studio/` 无缝提取参数。
