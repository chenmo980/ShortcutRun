# K1 · 广告位与变现规格（IAA）

> 归属：K2 · 依据：`docs/compliance.md`（流量主 UV≥1000）、`docs/wechat-build.md`（包体/真机）
> 消费方：step-5 在 `assets/scripts/AdMgr.ts` 落地
> 状态：规格定稿，代码由 step-5 实现

## 1. 变现模型

纯 IAA（应用内广告），无内购。收入 = 展示量 × eCPM。
微信小游戏可用广告形态：

| 形态 | 微信 API | 单局展示上限 | 用于本项目 |
|---|---|---|---|
| 激励视频 | `wx.createRewardedVideoAd` | 用户主动，不设硬上限 | ✅ 主力 |
| 插屏 | `wx.createInterstitialAd` | 每局 ≤1 | ✅ 关卡结束 |
| Banner | `wx.createBannerAd` | 常驻 | ⚠️ 仅菜单页 |
| 格子广告 | `wx.createGridAd` | 常驻 | ❌ 破坏跑道视野 |

**决策**：以**激励视频**为主力（eCPM 最高、体验可控），插屏打辅助，Banner 只在开始界面（游戏进行中不出现，避免遮挡 3D 跑道）。

## 2. 广告点位设计（按"不破坏手感"排序）

| 点位 | 触发时机 | 形态 | 设计理由 |
|---|---|---|---|
| **A1 复活** | 掉落瞬间（未结算前） | 激励视频 | 最高转化点：玩家损失厌恶最强。看完原地复活，保留当前砖数 |
| **A2 双倍奖励** | 胜利结算页 | 激励视频 | 可选，不强制。看完本关奖励×2（仅影响金币/皮肤进度，不影响星级） |
| **A3 关卡插屏** | 每 3 关结算后 | 插屏 | 频率封顶，避免疲劳 |
| **A4 菜单 Banner** | 开始界面常驻 | Banner | 不干扰玩法 |

**铁律**：A1 复活每关限 1 次（`reviveUsed` 标记），防无限续命破坏难度曲线。

## 3. API 契约（step-5 实现口径）

```ts
// assets/scripts/AdMgr.ts —— 单一广告入口，双平台自适应
type AdKind = 'rewarded' | 'interstitial' | 'banner';

interface AdMgr {
  init(): void;                                // onLoad 调用，预加载激励视频
  isReady(kind: AdKind): boolean;
  showRewarded(scene: 'revive' | 'double'): Promise<boolean>;  // true=完整观看
  showInterstitial(): Promise<void>;
  showBanner(): void;
  hideBanner(): void;
}
```

### 平台判定
- 微信环境：`typeof wx !== 'undefined' && wx.createRewardedVideoAd`
- 浏览器/Cocos 预览：**桩实现** —— `showRewarded` 直接 `resolve(true)` 并打印日志，保证开发期不阻塞

### 降级规则（必须实现）
1. 广告未加载完成 → 按钮置灰，不弹"加载失败"（静默降级）
2. 用户中途关闭 → `resolve(false)`，不发放奖励，不报错
3. 连续 2 次加载失败 → 该点位本局禁用
4. **震动/音效暂停**：广告播放期间 `AudioMgr` 必须静音，关闭后恢复（否则体验割裂）

### 埋点（与既有遥测对齐）
每次广告 `push` 一条到 `sr_telemetry_v1`：
```
{ ev:'ad', kind, scene:'revive'|'double'|'interstitial', result:'complete'|'skip'|'fail', level, t }
```
用途：算 ARPU 与广告疲劳度；schema 归 K5 分析。

## 4. 频率与红线

| 约束 | 值 | 理由 |
|---|---|---|
| 单局插屏 | ≤1 | 微信审核 + 体验 |
| 每 3 关插屏 | 1 次 | 节奏留白 |
| 复活提示展示 | 掉落瞬间，3s 倒计时 | 给拒绝的余地，不强制 |
| 首次启动前 3 关 | **不显示插屏** | 新手保护，保留存 |
| 任意广告并排 | 禁止 | 审核风险 |

## 5. 验收方式

1. **桩实现可跑**：浏览器版点击复活 → 控制台出现 `[Ad] rewarded:revive (stub) → complete`，游戏正常复活
2. **不阻塞主流程**：无 `wx` 环境下所有广告 API 调用立即 resolve，`verify-web.mjs` 全绿不挂
3. **单局插屏计数**：连续通关 6 关，控制台插屏调用 = 2 次（第 4、第 7 关前），第 1-3 关为 0
4. **静音联动**：广告期间 `AudioMgr.muted === true`

> 验收脚本目录：真机项进 `k3-device-matrix.md`；浏览器桩项由 step-5 并入 `tools/verify-web.mjs`。