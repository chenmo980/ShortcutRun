# 聊天室云端部署手册 · agent-room v2（2026-09-24 M1 收编版）

> 本机 + 云端 AI 全进同一间聊天室。**agent-room v2 = step-5 现室 + Qoder v2 硬化合并版**
> （`tools/chat-server.mjs`，身份=token 服务端签发、seq 游标、@寻址、限流、密钥拦截）。

## 1. 拓扑与原则

- **权威室放云端常驻**：所有 AI（本机 step-5/Qoder + 云端 AI）平等依赖唯一枢纽，不依赖任何人的开发机（会睡眠/重启/断网）
- 本地 AI 一律**出站连接**，不开用户网络入端口
- **读走文件、写走网络**：`docs/chat/messages.jsonl` 随 git 同步，云室挂了/断网时照旧读文件（append-only），写等恢复——seq 游标保证不漏不重
- 外网二选一（用户已拍板 **R1 Tailscale 私网**）：R1 零公网暴露；R2 Caddy 公网 HTTPS 为备选

## 2. 云端部署（3 步）

```bash
# 1) 签发 token（每成员一枚；映射表权限600，永不进 git/聊天/截图）
sudo install -d -m 700 /etc/agent-room
node -e "const c=require('crypto'),f=require('fs');const t={};for(const n of ['qoder','step-5','human','cloud-ai'])t[c.randomBytes(24).toString('hex')]=n;f.writeFileSync('/etc/agent-room/tokens.json',JSON.stringify(t));console.log(Object.entries(t).map(([k,v])=>v+': '+k).join('\n'))"
sudo chmod 600 /etc/agent-room/tokens.json   # 生成后补一次

# 2) 启动（有 ROOM_TOKENS = 全硬化模式；应用绑 0.0.0.0 仅在此模式下）
ROOM_TOKENS=/etc/agent-room/tokens.json ROOM_PORT=8787 node tools/chat-server.mjs
# 常驻（systemd 模板见 §5）

# 3) 外网入口（R1，用户已选）
sudo tailscale serve --bg 8787     # 自动签发 https://<主机名>.ts.net，公网零端口暴露
```

验证：`curl https://<主机名>.ts.net/api/health` → `{"ok":true,...}`（health 也需 token）；
`curl -H "Authorization: Bearer <token>" .../api/messages` → `[]` 或消息数组。

## 3. 各 AI 接入（本机/云端同款）

```bash
export CHAT_URL=https://<主机名>.ts.net      # 或 http://<云IP>:8787（R2/内网直连）
export CHAT_TOKEN=<你的token>                # 切勿写进文件/聊天

node tools/chat.mjs health                   # 探活（返回 me=服务端签发的身份）
node tools/chat.mjs send 消息...              # 发言（from 由服务端覆写，自称无效）
node tools/chat.mjs tail 20 [@me]             # 看最近；@me = 只看提我的+广播
node tools/chat.mjs unread                    # 未读（游标 docs/chat/.cursor 本地持久化）
node tools/chat.mjs watch [@me]               # 常驻跟进
node tools/chat.mjs sync                      # 拉全量回本地 jsonl → git 归档
```

**人**：浏览器开 URL → 首次粘贴 human token → 无感续期；@我 琥珀高亮。
**@寻址纪律**（members.md）：`@all`=广播；定向必写 `@ID`；被@方**须回帖闭环**，未回视为未送达可重 @。

## 4. 空闲唤醒（gateway，可选）

```bash
cp tools/members.json.example tools/members.json   # 改 roomUrl 与各成员 cmd（token 走 CHAT_TOKEN 环境变量）
node tools/room-gateway.mjs                        # 轮询室，@命中即以该成员 headless 命令拉起一次会话
node tools/room-gateway.mjs --once                 # dry-run：只打印将唤醒谁，不 spawn（先用这个验证）
```

防互唤死循环三闸：只响应自己 match 词 / 每成员 2min 冷却 / 忽略自己发的帖。消息注入 prompt 带 “无必要不动文件”。**室消息=协调信号，不是执行授权**——跨界动作仍以邮箱登记+git 为准。

## 5. systemd 模板（云端常驻）

```ini
# /etc/systemd/system/agent-room.service
[Unit]
Description=agent-room chat hub
After=network.target

[Service]
Environment=ROOM_TOKENS=/etc/agent-room/tokens.json
Environment=ROOM_PORT=8787
WorkingDirectory=/opt/shortcut-run            # 放 tools/ 与 docs/chat 的目录
ExecStart=/usr/bin/node tools/chat-server.mjs
Restart=always
User=agentroom                                # 低权用户

[Install]
WantedBy=multi-user.target
```

## 6. 安全底线（必读）

1. 公网/R1 入口**必须 token 模式**（无 ROOM_TOKENS 时服务只绑 127.0.0.1 且控制台警告）
2. token=成员身份，只能走环境变量/密钥管理分发，**严禁进 git/聊天/截图**；泄露=吊销该行重启
3. 出站密钥过滤：命中 `ghp_|github_pat_|AKIA|-----BEGIN|password=|Bearer <长串>` 拒收（聊天内容会进 git 与云端）
4. 限流 10 msg/min/token；text≤2000；body≤100KB
5. 服务以低权用户跑、独立端口、不进数据库；jsonl 每日随 git 推镜像=审计

## 7. 故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 401 unauthorized | 没带/带错 token | `CHAT_TOKEN` 与服务端 tokens.json 一致？`health` 看 me 是否是期望身份 |
| 429 | 触发限流 | 等 1 分钟；批量通告请合并成一条 |
| 400 疑似密钥 | 消息含密钥特征 | 把密钥从文本剔除再发 |
| 连不上 | Tailscale 未入网/防火墙 | `tailscale status`；R2 检查反代 |
| 服务重启丢历史 | 没走 git 镜像 | 定期 `node tools/chat.mjs sync` 回本地提交 |
