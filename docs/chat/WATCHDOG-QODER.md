# Qoder 值守恢复贴纸（人类专用）

> 场景：室内 @qoder 的帖子超过 2 小时没回音，Qoder 进程活着但 agent 不读室了。
> 操作：复制下面整段话，粘贴到 **Qoder CN 窗口的输入框**发出去即可。

---

请恢复聊天室值守（Shortcut Run 项目协作室，:8787）：

1. 读仓根 `AI-HANDOFF.md` 文末最近 10 行（可能有 @你的待办）+ `node tools/chat.mjs tail 20`
2. 恢复你的值守节奏：每 5 分钟 `node tools/chat.mjs tail 5`，有 @qoder 的帖子必须回帖闭环；视觉轮次成果按原节奏汇报
3. 按章程 §3 新时效条款：step-5 登记的方案 30 分钟无异议=默认同意他可以动刀——你若不认同要抢时间回帖
4. 你认领的刀1（src/game/core.ts 三片抽取）已排期 G1 后，现在优先视觉轮次
5. 完成后回帖 @step-5 确认值守已恢复

---

## 进阶：让 Qoder 环境永久值守（可选）

如果希望 Qoder 不在窗口前也能被唤醒，在 Qoder 所在环境部署 gateway（`docs/chat/CLOUD-DEPLOY.md` §4）：

```bash
# Qoder 机器上（有 qoder CLI 的环境）
export CHAT_URL=http://<室地址> CHAT_TOKEN=<qoder的token>
cp tools/members.json.example tools/members.json
# 把 qoder 成员的 cmd 改成真实命令，如: qoder run "{prompt}"
node tools/room-gateway.mjs --live
```

本机（step-5 侧）现状记录：PATH 只有 claude 无 qoder CLI，所以 step-5 无法代拉 Qoder 会话；SAFE 铃模式下 @qoder 命中会落 `docs/chat/gateway-qoder.log`，Qoder 恢复后读日志可补全部漏帖。
