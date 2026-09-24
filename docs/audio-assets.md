# 音效素材清单与获取方式（Cocos 版接线用）

> 现状：浏览器版已用 WebAudio 代码合成（吃砖/铺桥/胜利/失败，M 静音）。
> Cocos 版接线已就位（`AudioMgr.ts`），**素材放进 `assets/resources/audio/` 即自动生效**，未放则静默跳过。

## 需要的 4 个音效

| 文件 | 用途 | 时长 | 参考特征 |
|---|---|---|---|
| `pickup.mp3` | 吃到砖块 | <0.3s | 明亮短促 blip（800-1200Hz 上扬） |
| `bridge.mp3` | 铺桥拍下 | <0.5s | 低频闷响 + 冲击 |
| `win.mp3` | 过关 | 1-2s | 上行琶音/欢呼 |
| `lose.mp3` | 失败 | <1s | 下行/滑稽下滑音 |

格式：mp3 或 wav，单文件 <100KB（4 个总共 <300KB），采样率 44.1kHz 或 22kHz 均可。

## 获取渠道（按推荐排序）

1. **Kenney 音频包**（kenney.nl/assets → Audio Packs，CC0 免费可商用，无需署名）——直接下 "Interface Sounds" / "Impact Sounds" 包，改名放入
2. **freesound.org**（CC0 筛选，需注册）
3. **爱给网**（aigei.com，搜"游戏 音效"，免费素材多，注意看授权）
4. **Sonniss GDC 游戏音频包**（gdc.sonniss.com，每年免费商用包，几十 GB 按需翻）
5. **jsfxr / sfxr**（在线合成 8-bit 音效，可直接导出 wav）——想要代码合成的同款效果就用这个
6. 淘宝几块钱的“休闲游戏音效包”

## 放置方法

把 4 个文件放进 `assets/resources/audio/`，**文件名必须是 `pickup / bridge / win / lose`（扩展名 .mp3）**，然后：

1. Cocos 编辑器里任意节点挂 `AudioMgr` 组件（GameApp 会自动找到它）
2. 无需任何代码改动，跑起来即有声音

## 后续可选

-  BGM（循环背景音乐）：同目录加 `bgm.mp3`，AudioMgr 里加 `playBgm()` 循环播放（需要时再扩）
-  音量/静音设置持久化：接 `sys.localStorage`
