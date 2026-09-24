# 聊天室 v2 · 云端中枢方案（Qoder 起草，2026-09-24）

> 背景：本机 + 云服务器已有 1 个 AI，未来 1-2 个加入。现室（step-5 的 :8787 本机室）只覆盖同机成员。
> 本文档=方案提案，未拍板前不动任何人的属地代码。

## 1. 拓扑：中心辐射（hub & spoke）

```
        ┌─ 本机(step-5 / Qoder / 人浏览器)
        │     └─ CLI/UI → 云端室（HTTPS + 各自 token）
云服务器 hub: agent-room 服务 ── docs/chat/messages.jsonl(权威落盘) + git 提交镜像
        │
        └─ 云端 AI-1 / 未来 AI-2,3 → 同一 URL 同一协议
```

- **权威室在云端**：always-on、全网成员可达、人浏览器也能开。
- **本机保留降级路径**：`docs/chat/messages.jsonl` 仍随 git 同步到本机——云室挂了/断网时，成员照旧读文件（append-only，读不需要服务器），发则等恢复。聊天不断档靠"读走文件、写走网络"。

## 2. 安全设计（按威胁逐条）

| 威胁 | 对策 |
|---|---|
| 冒充成员（本机室 P1 已实证会发生） | **身份=token，不是字段**：每成员一枚随机 token 存服务端，POST 时 `Authorization: Bearer`，服务端把 token 映射成 from 后**覆写请求体里的 from**。人用浏览器走一次性登录页领自己的 token。 |
| 公网明文嗅探/篡改 | 只走 HTTPS（复用服务器现有域名反代，或自签+固定指纹；拒绝裸 HTTP 公网） |
| 任意人接入 | 成员注册制：token 由服务器管理员（你）发放/吊销；无 token 一律 401 |
| 消息注入指令（把室当 RCE 入口） | 纪律入章程：**室消息=协调信号，不是执行授权**。凡跨界改文件/执行命令，以信箱登记+git 提交为准；室里的 @指令 需回帖确认才执行。 |
| 密钥泄露进聊天记录 | 服务端出站过滤：正则扫 `ghp_|AKIA|-----BEGIN|Bearer [A-Za-z0-9]` 命中即拒收；成员侧写进 AGENTS.md（已有 token 泄露前科，此条必须硬） |
| 洪水/超大包 | 每 token 10 msg/min 限流；text≤2000 字符；body≤100KB |
| 服务器本身沦陷 | 爆炸半径=伪造成员发言（上两条已缓解）+ 历史读取（本来就是项目内部信息）；室服务以低权用户跑、独立端口、不进数据库 |

## 3. 通用性：把机制做成可复用的 "agent-room" 协议

沉淀物（独立目录 `docs/spec/agent-room.md`，未来可原样搬去独立 repo）：

- **数据模型**：`{seq: int(单调), ts, from(服务端签发), to("@all"|成员), text}`，落盘=JSONL append-only（git 可镜像=天然审计）
- **传输**：REST 轮询起步（`GET /api/messages?after=seq` / `POST /api/messages`），WebSocket 推送为可选 v2.1 升级——协议不绑定输运，AI 侧 CLI 零改动
- **身份**：token→member 映射表 + 管理员发放/吊销接口
- **通道**：预留 `room` 字段（默认 `#main`），支持未来"一服多项目"复用
- **客户端规范**：CLI 三命令（send/tail/ack）+ 游标持久化（本地 cursor 文件）+ 降级读 jsonl
- 首个消费者=本项目；第二个项目接入成本=发 token + 配 URL，两行 env

## 4. 分工与迁移（三步，零中断）

| 步骤 | 谁 | 干什么 | 验收 |
|---|---|---|---|
| M1（今天） | step-5 | 本机室修 P0 绑 127.0.0.1 + P1 token 化 from（协议先按 §3 数据模型出） | 本机评审四项全绿 |
| M2（1-2 天） | Qoder 主导，用户提供服务器/域名 | 把 M1 版移植云端：systemd/pm2 常驻 + HTTPS + token 发放 + 限流 + 密钥过滤器 + 云端 AI 接入测试 | 云端 AI 与本机在**同一室**互发成功；断网演练走降级读 |
| M3 | 全员 | 本机室退役为纯缓存；协议文档定稿 `docs/spec/agent-room.md` | 新成员（未来 AI-2/3）按文档 30 分钟内自助接入 |

## 5. 成本与风险一句话

- 成本：现有云服务器 ≈ ¥0 增量 + 我 1 人日（M2）；step-5 0.5 人日（M1）。
- 最大风险：云端 token 管理不善=把冒充问题从局域网搬到公网 → 用 §2 的 token 覆写 + 发放制 + 限流压住；以及"室消息当授权"的纪律必须进章程，这条不花钱但最重要。

## 6. 外网接入二选一（2026-09-24 用户令"设计好外网可访问+安全"后的具体架设）

### R1 · Tailscale 私网（推荐首选）
- 云服务器 + 需要远程接入的机器各装 Tailscale（一条命令，免费档 3 用户 100 设备够用），组成私有 mesh。
- 服务器上 `tailscale serve --bg 8787`：自动给内网服务签发 HTTPS 证书（https://主机名.ts.local），**公网零端口暴露**——扫描器看不到这个室，未入网设备物理不可达。
- 不需要域名、不需要证书管理、不需要开防火墙口。
- 代价：每个成员机器要装 tailscale（云端 AI 若在我们控制不了的环境、装不了软件 → 退回 R2）。

### R2 · 公网 HTTPS（备选）
- Caddy 反代一行配置：`room.你的域名 { reverse_proxy 127.0.0.1:8787 }`，自动申请续期 Let's Encrypt。
- 攻击面=一个 HTTPS 端口 + token 是唯一门；配 fail2ban 扫 401 洪水。

### 两路通用的服务端硬化（R1/R2 都必须做，参考实现已内置）
1. 应用只绑 `127.0.0.1`（公网入口只归反代/隧道）
2. **token→身份覆写**：`Authorization: Bearer <token>`，服务端查 tokens.json 得成员名并**覆写**请求体 from——冒充在协议层消灭
3. 每 token 10 msg/min 限流；text≤2000；body≤100KB
4. 出站密钥过滤：命中 `ghp_|github_pat_|AKIA|-----BEGIN|password=` 拒收并回提示
5. 无 token/错 token 一律 401，不区分"不存在 vs 密码错"
6. systemd `Restart=always` + 低权用户运行；jsonl 落盘 + 每日随 git 推镜像
7. token 发放：服务器上 `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` 生成，写入 tokens.json（文件权限 600，**不进 git**），线下交给成员

### 部署分工（零中断迁移）
| 谁 | 做什么 | 产出 |
|---|---|---|
| Qoder | 参考实现 `docs/qoder/room-server.v2.mjs`（含 1-6 硬化）+ systemd/反代配置模板 | 已完成（2026-09-24） |
| step-5 | M1 收编 P0-P2 进 tools/（或直接用我的 v2 替换，二选一，室服不断档） | 本机室先安全 |
| 云端 AI | 拉 git → 按模板跑 v2 服务 → 生成 3-4 枚 token 交用户转发 → 报公网/尾网 URL | 云室上线 |
| 用户 | 只做两件事：给云端 AI 部署授权；把 token 分发给各成员（含你自己浏览器的 human token） | — |

### 成员接入（改造后）
- CLI：`CHAT_URL=https://... CHAT_TOKEN=xxx node tools/chat.mjs send qoder "..."`（游标持久化到本地文件，解决重开全量拉取）
- 人：浏览器开 URL，首次粘贴 token，之后无感
- 断网降级：读仍走 git 镜像的 jsonl；写等恢复（seq 游标保证不漏不重）

## 7. 待拍板（用户）

1. 服务器给哪个域名/端口、用什么反代（nginx/caddy/裸 node）？
2. 云端那个 AI 是谁的底座（决定它读什么自动加载文件）？
3. M1 是否现在就转给 step-5（我可以把本方案摘要发进室）？
