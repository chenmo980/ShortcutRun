// docs/qoder/room-server.v2.mjs — agent-room 参考实现 v2（零依赖，Qoder 2026-09-24）
// 定位: step-5 现室(tools/chat-server.mjs)的安全硬化版, 供其收编或云端部署直接用。
// 协议: docs/drafts/room-v2-cloud.md §2/§3/§6
// 启动: ROOM_TOKENS=/path/tokens.json node room-server.v2.mjs   (默认绑 127.0.0.1:8787)
// tokens.json 格式(权限600, 勿进git): {"<hex-token>":"qoder", "<hex2>":"step-5", "<hex3>":"human"}
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.ROOM_PORT || 8787);
const HOST = process.env.ROOM_HOST || '127.0.0.1'; // 硬化#1: 公网入口只归反代/隧道
const LOG = process.env.ROOM_LOG || 'docs/chat/messages.jsonl';
const TOKENS_FILE = process.env.ROOM_TOKENS || 'tokens.json';

const tokens = JSON.parse(readFileSync(TOKENS_FILE, 'utf8')); // 成员名=服务端签发, 不可自报
const IDS = [...new Set(Object.values(tokens))]; // ID 登记册: token 文件的值集即成员表
const SECRET_RE = /(ghp_|github_pat_|AKIA[0-9A-Z]{10,}|-----BEGIN|password\s*[=:])/i; // 硬化#4
const RATE = 10; // msg/min/token

function parseMentions(text) {
  const found = new Set();
  for (const id of IDS) if (text.includes(`@${id}`)) found.add(`@${id}`);
  if (text.includes('@all') || !found.size) found.add('@all'); // 无显式@即广播
  return [...found];
}

mkdirSync(LOG.split('/').slice(0, -1).join('/') || '.', { recursive: true });
if (!existsSync(LOG)) writeFileSync(LOG, '');

let msgs = [];
for (const line of readFileSync(LOG, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try { msgs.push(JSON.parse(line)); } catch { /* skip */ }
}
let seq = msgs.length ? msgs[msgs.length - 1].seq : 0;
const rateMap = new Map(); // token -> timestamps[]

function rateOk(t) {
  const now = Date.now();
  const arr = (rateMap.get(t) || []).filter((x) => now - x < 60_000);
  if (arr.length >= RATE) { rateMap.set(t, arr); return false; }
  arr.push(now); rateMap.set(t, arr); return true;
}

function auth(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return tokens[t] ? { token: t, name: tokens[t] } : null;
}

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const PAGE = `<!doctype html><meta charset="utf-8"><title>agent-room</title>
<style>body{background:#0f172a;color:#e2e8f0;font:14px/1.5 Consolas,monospace;margin:0;display:flex;flex-direction:column;height:100vh}
header{padding:10px 16px;background:#1e293b;font-weight:bold}#list{flex:1;overflow-y:auto;padding:12px 16px}
.msg{margin:4px 0;padding:6px 10px;background:#1e293b;border-radius:8px;max-width:80%}.msg.me{background:#134e4a;margin-left:auto}
.msg.atme{outline:1px solid #f59e0b}
.who{color:#7dd3fc;font-size:12px;margin-right:8px}form{display:flex;gap:8px;padding:10px 16px;background:#1e293b}
input{flex:1;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:8px}
button{background:#0284c7;color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer}</style>
<header>agent-room v2 <span style="color:#64748b;font-weight:normal" id="who"></span></header>
<div id="list"></div><form id="f"><input id="text" placeholder="说点什么…" autocomplete="off"><button>发送</button></form>
<script>
let tok = localStorage.getItem('room_token') || (tok = prompt('粘贴你的 room token（仅首次）') || '');
localStorage.setItem('room_token', tok);
let after = 0;
async function poll() {
  try {
    const r = await fetch('/api/messages?after=' + after, { headers: { authorization: 'Bearer ' + tok } });
    if (r.status === 401) { localStorage.removeItem('room_token'); location.reload(); return; }
    const j = await r.json();
    document.getElementById('who').textContent = '· 登录为 ' + j.me;
    for (const m of j.messages) {
      after = Math.max(after, m.seq);
      const d = document.createElement('div');
      d.className = 'msg' + (m.from === j.me ? ' me' : '') + ((m.to || []).includes('@' + j.me) ? ' atme' : '');
      const s = document.createElement('span'); s.className = 'who';
      s.textContent = new Date(m.ts).toTimeString().slice(0, 8) + ' · ' + m.from + ((m.to || []).length && !(m.to.length === 1 && m.to[0] === '@all') ? '→' + m.to.join(',') : '');
      d.appendChild(s); d.appendChild(document.createTextNode(m.text)); // 硬化: 全程 textContent, 无 innerHTML
      document.getElementById('list').appendChild(d);
    }
  } catch (e) { /* 断线静默重试 */ }
  setTimeout(poll, 2000);
}
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const t = document.getElementById('text'); const text = t.value.trim(); if (!text) return;
  t.value = '';
  await fetch('/api/messages', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  poll();
};
poll();
</script>`;

createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  const m = auth(req); // 硬化#2/#5: 一切 API 先过 token, 失败统一 401
  if (!m) return json(res, 401, { error: 'unauthorized' });
  if (req.method === 'GET' && u.pathname === '/api/messages') {
    const after = Number(u.searchParams.get('after') || 0);
    return json(res, 200, { me: m.name, ids: IDS, latest: seq, messages: msgs.filter((x) => x.seq > after).slice(-100) });
  }
  if (req.method === 'GET' && u.pathname === '/api/health') {
    return json(res, 200, { ok: true, me: m.name, members: [...new Set(Object.values(tokens))], msgs: seq });
  }
  if (req.method === 'POST' && u.pathname === '/api/messages') {
    if (!rateOk(m.token)) return json(res, 429, { error: 'rate limit 10/min' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let text = '';
      try { text = String(JSON.parse(body || '{}').text || '').trim(); } catch { return json(res, 400, { error: 'bad json' }); }
      if (!text || text.length > 2000) return json(res, 400, { error: 'text required, <=2000' });
      if (SECRET_RE.test(text)) return json(res, 400, { error: '疑似密钥/凭据被拦截: 聊天内容会进 git 与全网, 密钥严禁入聊' });
      const msg = { seq: ++seq, id: randomUUID().slice(0, 8), ts: Date.now(), from: m.name, to: parseMentions(text), text }; // from=服务端覆写; to=服务端解析@ID
      appendFileSync(LOG, JSON.stringify(msg) + '\n');
      msgs.push(msg);
      json(res, 200, msg);
    });
    return;
  }
  json(res, 404, { error: 'not found' });
}).listen(PORT, HOST, () => console.log(`[room-v2] http://${HOST}:${PORT} log=${LOG} members=${[...new Set(Object.values(tokens))].join(',')}`));
