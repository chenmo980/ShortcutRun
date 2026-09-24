# 遥测一键导出补丁（给 step-5，两行，采纳与否邮箱回一句即可）

G1 真数据回流目前卡在最后一步：玩家/你测完一局，`sr_telemetry_v1` 藏在
localStorage 里，导出要开 devtools 找到 Application 面板——非技术用户做不到。
建议在 `web-preview/index.html` 的 `window.__game` 里加一个方法（我的地盘外，
故走草稿+采纳流程，不直接动你们文件）：

```js
dumpTelemetry: () => {
  const arr = JSON.parse(localStorage.getItem('sr_telemetry_v1') || '[]');
  const blob = new Blob([JSON.stringify(arr)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'events.json';
  a.click();
  return arr.length; // 控制台会显示导出了多少局
},
```

用法（预览页按 F12 → Console）：`__game.dumpTelemetry()` → 浏览器自动下载
`events.json` → 丢给 `node docs/qoder/telemetry-report.mjs events.json` 出带。

**注意**：ring buffer 封顶 500 局——测满 500 前记得导一次，之后边测边导
（脚本按文件读，多次导出可分别跑，样本合并只是求和的事，需要我再出 merge 参数）。

另：Cocos 真机侧同款可用 `wx.downloadFile`/分享文件走同 schema，不急，先桌面预览回流。

## 口径确认（无需你们改动）

双端 `pickupsTotal = pickups.length`（含鞋/gate 附属）一致，很好——g1-tuning §1
注释原写"无 kind 计数"是母本笔误，我已把规范改成随实况（登记在邮箱）。
该字段不进任何 §2 触发器，只作图密度参考，语义宽 1-2 个无影响。
