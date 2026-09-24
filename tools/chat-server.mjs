// 多 AI 实时聊天室服务端（零新依赖，node http）
// 用法：
//   本机：  node tools/chat-server.mjs                     （默认 127.0.0.1:8787，免鉴权）
//   云上：  CHAT_TOKEN=<token> node tools/chat-server.mjs   （自动绑 0.0.0.0，必须鉴权）
//   CHAT_HOST / CHAT_PORT / CHAT_TOKEN 均可覆盖。
// 安全：设了 CHAT_TOKEN 后，读写 /api/messages 都要带 Authorization: Bearer <token>
//       （或 ?token=<token>）；/api/health 保持开放做探活。公网建议再套 HTTPS 反代。
//   GET  /                      → web UI（人看/插话，2s 自动刷新）
//   GET  /api/messages?since=ms → JSON 增量拉取
//   POST /api/messages          → {from, text} 追加落盘
// 纪律：聊天室=实时协调通道；里程碑/结论仍要归档进仓根 AI-HANDOFF.md 邮箱（权威记录）。
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chatDir = join(root, 'docs', 'chat');
const logFile = process.env.CHAT_LOG || join(chatDir, 'messages.jsonl');
const TOKEN = process.env.CHAT_TOKEN || '';
// 有 TOKEN = 公网模式：绑所有网卡；无 TOKEN = 本机模式：只绑回环（防误暴露）
const HOST = process.env.CHAT_HOST || (TOKEN ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(process.env.CHAT_PORT || 8787);
mkdirSync(chatDir, { recursive: true });
if (!existsSync(logFile)) writeFileSync(logFile, '');

const MEMBERS = ['step-5', 'qoder', 'human', 'system'];

function readMessages(since = 0) {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8')
    .split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((m) => m && m.ts > since)
    .sort((a, b) => a.ts - b.ts);
}

function postMessage(from, text) {
  const msg = { ts: Date.now(), from: String(from || 'anon').slice(0, 32), text: String(text || '').slice(0, 2000) };
  appendFileSync(logFile, JSON.stringify(msg) + '\n');
  return msg;
}

function authorized(req, u) {
  if (!TOKEN) return true; // 本机免鉴权模式
  const h = req.headers.authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : '';
  const q = u.searchParams.get('token') || '';
  return bearer === TOKEN || q === TOKEN;
}

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Shortcut Run · AI 聊天室</title>
<style>
  body{background:#0f172a;color:#e2e8f0;font:14px/1.5 Consolas,monospace;margin:0;display:flex;flex-direction:column;height:100vh}
  header{padding:10px 16px;background:#1e293b;font-weight:bold;display:flex;gap:12px;align-items:center}
  header .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block}
  #list{flex:1;overflow-y:auto;padding:12px 16px}
  .msg{margin:4px 0;padding:6px 10px;background:#1e293b;border-radius:8px;max-width:80%}
  .msg.human{background:#134e4a;margin-left:auto}
  .msg.system{background:#334155;color:#94a3b8;font-size:12px}
  .msg .who{color:#7dd3fc;font-size:12px;margin-right:8px}
  .msg.human .who{color:#5eead4}
  form{display:flex;gap:8px;padding:10px 16px;background:#1e293b}
  select,input{background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:8px}
  input{flex:1}
  button{background:#0284c7;color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer}
</style>
<header><span class="dot"></span>Shortcut Run · AI 聊天室 <span style="color:#64748b;font-weight:normal">step-5 / qoder / human 实时协商 · 权威记录仍以 AI-HANDOFF.md 邮箱为准</span></header>
<div id="list"></div>
<form id="f"><select id="who"><option>human</option><option>step-5</option><option>qoder</option></select><input id="text" placeholder="说点什么…" autocomplete="off"><button>发送</button></form>
<script>
let since = 0;
const list = document.getElementById('list');
async function poll() {
  try {
    const r = await fetch('/api/messages?since=' + since);
    const msgs = await r.json();
    for (const m of msgs) {
      since = Math.max(since, m.ts);
      const d = document.createElement('div');
      d.className = 'msg ' + (m.from === 'human' ? 'human' : m.from === 'system' ? 'system' : '');
      const t = new Date(m.ts).toTimeString().slice(0, 8);
      d.innerHTML = '<span class="who">' + t + ' · ' + m.from + '</span>' + m.text.replace(/</g, '&lt;');
      list.appendChild(d);
    }
    if (msgs.length) list.scrollTop = list.scrollHeight;
  } catch (e) { /* server 重启中，静默重试 */ }
  setTimeout(poll, 2000);
}
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const who = document.getElementById('who').value;
  const text = document.getElementById('text').value.trim();
  if (!text) return;
  document.getElementById('text').value = '';
  await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: who, text }) });
  poll();
};
poll();
</script>`;

const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  if (req.method === 'GET' && u.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, members: MEMBERS, auth: !!TOKEN, host: HOST, file: logFile.replace(root, '.') }));
    return;
  }
  if (!authorized(req, u)) {
    res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' });
    res.end('{"error":"unauthorized: set CHAT_TOKEN and pass Authorization: Bearer <token>"}');
    return;
  }
  if (req.method === 'GET' && u.pathname === '/api/messages') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(readMessages(Number(u.searchParams.get('since') || 0))));
    return;
  }
  if (req.method === 'GET' && u.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, members: MEMBERS, file: logFile.replace(root, '.') }));
    return;
  }
  if (req.method === 'POST' && u.pathname === '/api/messages') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const { from, text } = JSON.parse(body || '{}');
        if (!text) { res.writeHead(400); res.end('{"error":"text required"}'); return; }
        const msg = postMessage(from, text);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(msg));
      } catch {
        res.writeHead(400); res.end('{"error":"bad json"}');
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, HOST, () => {
  postMessage('system', TOKEN
    ? `聊天室服务已启动（公网模式 ${HOST}:${PORT}，鉴权开启；成员: ${MEMBERS.join(' / ')}；权威记录=仓根 AI-HANDOFF.md）`
    : `聊天室服务已启动（本机 ${HOST}:${PORT}，免鉴权；成员: ${MEMBERS.join(' / ')}；权威记录=仓根 AI-HANDOFF.md）`);
  console.log(`[chat] listening on http://${HOST}:${PORT}  auth=${TOKEN ? 'ON' : 'off'}  log=${logFile.replace(root, '.')}`);
});
