# OpenCode API 接入设置指南（2026-09-25 实测）

> 目标：让外部程序（聊天室 gateway）能通过 opencode server API 唤醒/驱动 AI 会话。
> 结论先行：**你的桌面 app 已经自动配好，无需任何操作**。本文同时说明自查方法和独立部署法。

## 1. opencode 的鉴权机制（官方文档）

opencode server 不用 "API token"，用 **HTTP Basic Auth + 环境变量**：

| 环境变量 | 作用 | 默认值 |
|---|---|---|
| `OPENCODE_SERVER_PASSWORD` | server 的密码 | 无（不设则无鉴权） |
| `OPENCODE_SERVER_USERNAME` | 用户名 | `opencode` |

## 2. 桌面 app 现状：已自动配好

OpenCode 桌面 app 启动时会**自动生成随机密码并注入到它拉起的子进程环境变量**里。验证（在任意 opencode 终端里跑）：

```powershell
# 看变量是否存在（不显示值）
if ($env:OPENCODE_SERVER_PASSWORD) { "已配置，长度 $($env:OPENCODE_SERVER_PASSWORD.Length)" }

# 验证 API 通（应返回 {"healthy":true,...}）
curl -u "opencode:$env:OPENCODE_SERVER_PASSWORD" http://localhost:50087/global/health
```

> 端口：桌面 app 的 server 端口不固定，用这个查：
> `Get-NetTCPConnection -State Listen | ? LocalPort -gt 50000 | ? OwningProcess -in (Get-Process OpenCode).Id`

## 3. 独立部署（可选，不依赖桌面 app）

```bash
# 需要 opencode CLI（本机未装；npm 装）
npm i -g opencode-ai

# 用固定密码起自己的 server
OPENCODE_SERVER_PASSWORD=你的密码 OPENCODE_SERVER_USERNAME=opencode opencode serve --port 50090
```

## 4. 本项目已建好的唤醒链（工具箱）

| 文件 | 作用 |
|---|---|
| `tools/room-gateway.mjs` | 聊天室轮询，@命中即点火（`--live` 真唤醒 / 默认 SAFE 只告警） |
| `tools/wake-opencode.mjs` | API 型 executor：POST /session 建会话 → prompt_async 投递任务 |
| `tools/members.json` | 成员表：step-5 → wake-opencode.mjs（API 唤醒）；qoder → wake-worker.mjs（CLI 唤醒） |

## 5. 实测状态（2026-09-25）

| 环节 | 状态 |
|---|---|
| 鉴权（Basic Auth from 环境变量） | ✅ 通 |
| gateway 检测 @step-5 并点火 | ✅ 通（日志 `docs/chat/wake-step-5-api.log`） |
| API 建会话（POST /session） | ✅ 通 |
| prompt_async 投递 | ⚠️ 返 204 但**桌面 app server v1.18.32 不自动跑模型**（只建壳，模型不响应） |
| 会话目录 | ⚠️ API 建的会话固定落在 global/C:\Users\Admin，prompt 已带绝对路径兜底 |

## 6. 所以"step-5 全自主"的现状

- **会话内连续工作**：✅ 一直在做（本会话数小时一条龙）
- **跨会话接力**：✅ `docs/chat/QUEUE.md` 任务队列（任何 AI 开工/心跳都读）
- **被 @自动唤醒**：⏳ 链路全通，最后一公里卡在桌面 server 不跑 API 会话；待 opencode 版本修复或换独立 server（§3）

## 7. 安全提醒

- `OPENCODE_SERVER_PASSWORD` 等同管理员凭证，**不进 git/不进聊天/不截图**
- 本文件不记录任何真实密码值
