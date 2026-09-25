// 通过 opencode server API 唤醒 step-5（gateway --live 的 API 型 executor）
// 前置条件（用户设置，见 docs/chat/OPENCODE-API-SETUP.md）：
//   OPENCODE_API_BASE   opencode server 地址，默认 http://localhost:50087（桌面 app 自带的 server）
//   OPENCODE_SERVER_PASSWORD  server 的 Basic Auth 密码（用户设的 OPENCODE_SERVER_PASSWORD）
//   OPENCODE_SERVER_USERNAME 可选，默认 opencode
// 行为：POST /session 建会话 → POST /session/:id/prompt_async 投递 prompt（不等回复，204 即点火成功）
// 文档依据：opencode 官方 Server 文档（/session、/prompt_async、Basic Auth）
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.OPENCODE_API_BASE || 'http://localhost:50087').replace(/\/$/, '');
const USER = process.env.OPENCODE_SERVER_USERNAME || 'opencode';
const PASS = process.env.OPENCODE_SERVER_PASSWORD || '';
const msg = process.env.ROOM_MSG || '';
const from = process.env.ROOM_MSG_FROM || '?';
const member = process.env.ROOM_MEMBER || 'step-5';
mkdirSync(join(root, 'docs', 'chat'), { recursive: true });
const logFile = join(root, 'docs', 'chat', `wake-${member}-api.log`);
const log = (s) => { try { appendFileSync(logFile, `[${new Date().toISOString()}] ${s}\n`); } catch { /* ignore */ } console.log(s); };

if (!PASS) {
  log('WAKE-FAIL: 未设 OPENCODE_SERVER_PASSWORD。按 docs/chat/OPENCODE-API-SETUP.md 设置后重启 OpenCode 桌面 app。');
  process.exit(2);
}
if (!msg.trim()) { log('WAKE-SKIP: ROOM_MSG 为空'); process.exit(0); }

const prompt = [
  `你是 Shortcut Run 项目协作室的「${member}」值守 worker（由 gateway 经 opencode server API 自动唤醒）。`,
  `项目目录（API 唤醒的会话默认落在 global/C:\\Users\\Admin，必须显式 cd 过去）：`,
  `E:\\WorkSpaces\\WxSoftWare\\shortcut-run`,
  `先读该目录下的 AGENTS.md 与 AI-HANDOFF.md（最近 10 行）+ docs/chat/QUEUE.md 任务队列，遵守章程。`,
  `触发消息（来自 ${from}）：`,
  msg,
  `处理要求：所有操作 cd 到上述项目目录后执行；动他人属地先登记；完工跑 npm run lint + npm run build + node tools/verify-app.mjs 后 commit；`,
  `完成后回帖：node tools/chat.mjs send ${member} "<结论>"（注意核对输出 from）。无必要不动文件、不外传密钥。`,
].join('\n');

const auth = { Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64') };

async function j(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...auth, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: r.status === 204 ? null : await r.json().catch(() => null) };
}

try {
  const created = await j('POST', '/session', { title: `room-wake: ${msg.slice(0, 30)}` });
  if (created.status !== 200 || !created.json?.id) {
    log(`WAKE-FAIL: 建会话失败 HTTP ${created.status} ${JSON.stringify(created.json).slice(0, 160)}`);
    process.exit(1);
  }
  const sent = await j('POST', `/session/${created.json.id}/prompt_async`, {
    parts: [{ type: 'text', text: prompt }],
  });
  if (sent.status !== 204) {
    log(`WAKE-FAIL: 投递失败 HTTP ${sent.status} ${JSON.stringify(sent.json).slice(0, 160)}`);
    process.exit(1);
  }
  log(`WAKE-FIRE member=${member} via=opencode-api session=${created.json.id} msg="${msg.slice(0, 80)}"（异步执行中，回帖见聊天室）`);
} catch (e) {
  log(`WAKE-ERROR: ${String(e.message || e).slice(0, 200)}（server 未起？密码错？见 docs/chat/OPENCODE-API-SETUP.md）`);
  process.exit(1);
}
