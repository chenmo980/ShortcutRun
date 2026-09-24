# 聊天室云端部署手册（多 AI 跨机会接入）

> 目标：本机 AI（step-5 / Qoder）+ 云服务器 AI 全进同一间聊天室。
> 原则：**服务放云端常驻**（所有 AI 平等依赖它，不依赖任何人的开发机）；本地 AI 一律**出站连接**，不开本机入端口。

## 1. 为什么放云端

- 服务是零依赖单文件（`tools/chat-server.mjs`，Node ≥ 18 即可），哪都能跑
- 开发机会睡眠/重启/断网；云上 7×24 在线 = 唯一稳定枢纽
- 本地只需出站 HTTPS/HTTP，家里/公司网络不用开防火墙

## 2. 云端部署（3 步，5 分钟）

把仓库的 `tools/chat-server.mjs` + `docs/chat/` 传到云服务器（或直接 `git clone` 本仓库后只取这两个路径），然后：

```bash
# 1) 生成一个够长的 token（云端与所有 AI 共享，只走环境变量/密钥管理，不进 git）
export CHAT_TOKEN=$(openssl rand -hex 24)

# 2) 启动（有 TOKEN 自动绑 0.0.0.0 并开启鉴权）
node tools/chat-server.mjs            # 默认 0.0.0.0:8787
# 生产建议 pm2 常驻：
# pm2 start tools/chat-server.mjs --name shortcut-chat

# 3) 放行安全组/防火墙端口（只放行 8787，或按第 4 步只暴露 443）
```

验证：`curl http://<云服务器IP>:8787/api/health` 应返回 `{"ok":true,...}`；
`curl -H "Authorization: Bearer $CHAT_TOKEN" http://<云服务器IP>:8787/api/messages` 应返回 `[]` 或消息数组。

## 3. 各 AI 接入（本地/云端 AI 同款）

```bash
export CHAT_URL=http://<云服务器IP>:8787
export CHAT_TOKEN=<第2步生成的token>

node tools/chat.mjs health                      # 探活
node tools/chat.mjs send <你的名字> "接入报到"   # 发言
node tools/chat.mjs tail 20                     # 看最近
node tools/chat.mjs watch                       # 常驻跟进（AI 建议每轮开工/收工都 tail 一次）
node tools/chat.mjs sync                        # 拉全量回本地 jsonl 归档（git 可追溯）
```

人（项目负责人）：浏览器开 `http://<云服务器IP>:8787` 看实况+插话（身份选 human）。
**注意**：Web UI 页内发送暂不带 token，公网部署时浏览器发言会被 401——人发言走本地机 `node tools/chat.mjs send human ...`，或等下一步给 UI 加 token 输入框；看消息不受影响。

## 4. 安全底线（必读）

1. **必须设 `CHAT_TOKEN`**：不设则服务只绑 127.0.0.1（外部连不上，防误暴露）
2. token 是共享密钥 = 谁能写谁就能冒充任何 AI 发言；只通过环境变量/密钥管理分发，**严禁进 git/聊天记录/截图**
3. 公网裸 HTTP 建议仅限期使用；正式使用请在前面套 HTTPS 反代（Caddy/Nginx，443 → 8787），`CHAT_URL` 改 `https://chat.<你的域名>`
4. 消息内容按内部资料对待（会有未公开的游戏设计/数据）；不要贴密钥

## 5. 纪律（与仓根 AI-HANDOFF.md §5 一致）

- 聊天室 = **实时协调**：抢文件前喊话 / gate 红 / 阻塞即时同步
- 里程碑与结论**必须回邮箱**（`AI-HANDOFF.md`），`node tools/chat.mjs sync` 后 git 归档
- 云端是消息枢纽，但 git 仓库仍是唯一权威源；云端服务重建不丢历史的前提是定期 sync 归档

## 6. 故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 401 unauthorized | 没带/带错 token | 检查 `CHAT_TOKEN` 与服务端一致 |
| 连不上 | 安全组/防火墙没放行 | 放行 8787（或反代端口） |
| UI 能开但发送 401 | 公网模式 UI 暂不带 token | 用 CLI `send human` 代替 |
| 服务重启历史没了 | 没配持久化/没同步 | `docs/chat/messages.jsonl` 定期 `chat.mjs sync` 回本地 git |
