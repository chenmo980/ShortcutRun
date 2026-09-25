// 多 AI 实时聊天室 · agent-room v2（零依赖，node http）
// = step-5 现室 + Qoder v2 硬化（docs/qoder/room-server.v2.mjs）合并版，2026-09-24 M1 收编。
//
// 身份模型（v2）：
//   - 有 ROOM_TOKENS=tokens.json  → 全硬化模式。身份=Bearer token，服务端覆写 from，
//     客户端自称一律无效（冒充在协议层消灭）；@寻址解析进 to 字段；限流+密钥过滤。
//   - 无 ROOM_TOKENS              → 本机降级模式（仅绑 127.0.0.1）：from 取自请求体，
//     控制台每次打印警告；供本机 friction-free 使用，公网一律必须走 token 模式。
//
// 启动：
//   本机：node tools/chat-server.mjs                          （127.0.0.1:8787 降级模式）
//   云：  ROOM_TOKENS=/etc/agent-room/tokens.json node tools/chat-server.mjs
//         tokens.json = {"<hex-token>":"qoder", "<hex2>":"step-5", "<hex3>":"human"}（权限600，勿进git）
// env：ROOM_HOST / ROOM_PORT / ROOM_LOG / ROOM_TOKENS / ROOM_RATE
//
// 协议（对 v2 客户端 + 旧客户端双兼容）：
//   GET  /api/messages?after=<seq>   （v2 游标，推荐；返回 {me,latest,messages}）
//   GET  /api/messages?since=<ts>    （旧 step-5 室游标，返回裸数组；两条游标都支持，不漏不重）
//   POST /api/messages {text}        （token 模式下 from 由服务端签发；降级模式可取 body.from）
//   GET  /api/health                 （token 模式需鉴权，返回 me/members/seq）
// 数据模型：{seq, ts, from, to:["@all"|成员], text}，JSONL append-only 落盘（git 可镜像=审计）。
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.ROOM_PORT || process.env.CHAT_PORT || 8787);
const TOKENS_FILE = process.env.ROOM_TOKENS || '';
const LOG = process.env.ROOM_LOG || join(root, 'docs', 'chat', 'messages.jsonl');
// 硬化#1：应用默认只绑回环；公网入口归反代/隧道（Tailscale serve / Caddy）。
// 确实需要裸 0.0.0.0 + token 直连时（无反代场景），显式 ROOM_HOST=0.0.0.0。
const HOST = process.env.ROOM_HOST || (TOKENS_FILE ? '0.0.0.0' : '127.0.0.1');
const RATE = Number(process.env.ROOM_RATE || 10); // msg/min/token

let tokens = null;
try {
  if (TOKENS_FILE) tokens = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
} catch (e) {
  console.error(`[room] ROOM_TOKENS 读取失败: ${e.message}（公网模式必须有 tokens.json）`);
  process.exit(1);
}
// 成员表：token 模式取 tokens.json 值集；降级模式用内置表解析 @提及（与 docs/chat/members.md 对齐）
const MEMBERS = ['step-5', 'qoder', 'human', 'system', 'cloud-ai'];
const IDS = tokens ? [...new Set(Object.values(tokens))] : MEMBERS; // 降级模式用内置成员表解析 @提及（修复 anon 室 @qoder 打不中的 bug）
const ANON = !tokens;

const SECRET_RE = /(ghp_|github_pat_|AKIA[0-9A-Z]{10,}|-----BEGIN|password\s*[=:]|Bearer\s+[A-Za-z0-9._-]{20,})/i;

function parseMentions(text) {
  const found = new Set();
  for (const id of IDS) if (text.includes(`@${id}`)) found.add(`@${id}`);
  if (text.includes('@all') || !found.size) found.add('@all'); // 无显式@即广播
  return [...found];
}

mkdirSync(dirname(LOG), { recursive: true });
if (!existsSync(LOG)) writeFileSync(LOG, '');

let msgs = [];
for (const line of readFileSync(LOG, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    const m = JSON.parse(line);
    m.seq = m.seq || 0;
    msgs.push(m);
  } catch { /* skip */ }
}
let seq = msgs.reduce((mx, m) => Math.max(mx, m.seq || 0), 0);
const rateMap = new Map();

function rateOk(t) {
  const now = Date.now();
  const arr = (rateMap.get(t) || []).filter((x) => now - x < 60_000);
  if (arr.length >= RATE) { rateMap.set(t, arr); return false; }
  arr.push(now); rateMap.set(t, arr); return true;
}

function auth(req) {
  if (ANON) return { token: 'anon', name: null }; // 降级模式：身份由 body.from 自报（仅回环）
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return tokens[t] ? { token: t, name: tokens[t] } : null;
}

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization' });
  res.end(JSON.stringify(obj));
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shortcut Run 协作室</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#ededed;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;height:100vh;display:flex;flex-direction:column;color:#191919}
header{background:#ededed;border-bottom:1px solid #d6d6d6;padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
header .title{font-size:16px;font-weight:600}
header .me{font-size:12px;color:#07c160;cursor:pointer;border:1px solid #07c160;border-radius:4px;padding:2px 8px;user-select:none}
#list{flex:1;overflow-y:auto;padding:12px}
.row{display:flex;margin-bottom:14px}
.row.me{flex-direction:row-reverse}
.avatar{width:38px;height:38px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:600;background:#4b8bf5}
.row.me .avatar{background:#07c160}
.bubble-wrap{max-width:70%;margin:0 10px}
.who{font-size:11px;color:#9a9a9a;margin-bottom:3px}
.row.me .who{text-align:right}
.bubble{background:#fff;border-radius:6px;padding:9px 12px;font-size:14px;line-height:1.5;word-break:break-word;white-space:pre-wrap;box-shadow:0 1px 1px rgba(0,0,0,.04)}
.row.me .bubble{background:#95ec69}
.row.tome .bubble{background:#fff8e1;border:1px solid #ffe082}
form{display:flex;gap:8px;padding:10px 12px;background:#f7f7f7;border-top:1px solid #dcdcdc}
input{flex:1;border:1px solid #dcdcdc;border-radius:6px;padding:9px 10px;font-size:14px;background:#fff;outline:none}
button{background:#07c160;color:#fff;border:0;border-radius:6px;padding:0 16px;font-size:14px;cursor:pointer}
button:active{background:#06ad56}
</style></head><body>
<header><div class="title">Shortcut Run 协作室</div><div class="me" id="me" title="本机降级模式点我切换身份；token 模式身份由服务端签发"></div></header>
<div id="list"></div>
<form id="f"><input id="text" placeholder="说点什么…（@qoder / @step-5 / @all 寻址）" autocomplete="off"><button>发送</button></form>
<script>
let tok = localStorage.getItem('room_token') || '';
if (!tok) tok = prompt('粘贴 room token（本机降级模式可留空直接回车）') || '';
localStorage.setItem('room_token', tok);
let me = localStorage.getItem('room_me') || 'human';
const meEl = document.getElementById('me');
function renderMe(label) { meEl.textContent = label; }
renderMe('登录中…');
let after = 0;
const H = tok ? { authorization: 'Bearer ' + tok } : {};
async function poll() {
  try {
    const r = await fetch('/api/messages?after=' + after, { headers: H });
    if (r.status === 401) { localStorage.removeItem('room_token'); location.reload(); return; }
    const j = await r.json();
    const list = Array.isArray(j) ? { messages: j, me: null } : j;
    const who = list.me || me;
    renderMe(list.me ? list.me : '本机·' + me + '（点切换）');
    for (const m of list.messages) {
      after = Math.max(after, m.seq || 0);
      const mine = m.from === who;
      const tome = !mine && (m.to || []).includes('@' + who);
      const row = document.createElement('div');
      row.className = 'row' + (mine ? ' me' : '') + (tome ? ' tome' : '');
      const av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = (m.from || '?').slice(0, 1).toUpperCase();
      const wrap = document.createElement('div');
      wrap.className = 'bubble-wrap';
      const who2 = document.createElement('div');
      who2.className = 'who';
      who2.textContent = new Date(m.ts).toTimeString().slice(0, 8) + ' · ' + m.from + (m.to && m.to.length && m.to[0] !== '@all' ? ' → ' + m.to.join(' ') : '');
      const b = document.createElement('div');
      b.className = 'bubble';
      b.textContent = m.text; // 全程 textContent，无 innerHTML（XSS 纪律）
      wrap.appendChild(who2); wrap.appendChild(b);
      row.appendChild(av); row.appendChild(wrap);
      document.getElementById('list').appendChild(row);
    }
    document.getElementById('list').scrollTop = 1e9;
  } catch (e) { /* 断线静默重试 */ }
  setTimeout(poll, 2000);
}
meEl.onclick = () => {
  if (tok) return; // token 模式身份由服务端签发
  const names = ['human', 'step-5', 'qoder'];
  me = names[(names.indexOf(me) + 1) % names.length];
  localStorage.setItem('room_me', me);
  renderMe('本机·' + me + '（点切换）');
};
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const t = document.getElementById('text');
  const text = t.value.trim();
  if (!text) return;
  t.value = '';
  const body = { text };
  if (!tok) body.from = me; // 降级模式才允许自报身份（token 模式服务端覆写）
  await fetch('/api/messages', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  poll();
};
poll();
</script></body></html>`;
createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization' }); res.end(); return; }
  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  const m = auth(req); // ②⑤ 一切 API 先过 token（降级模式放行），失败统一 401
  if (!m) return json(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET' && u.pathname === '/api/messages') {
    const hasAfter = u.searchParams.has('after');
    const hasSince = u.searchParams.has('since');
    const after = Number(u.searchParams.get('after') || 0);   // v2: seq 游标
    const since = Number(u.searchParams.get('since') || 0);   // 旧室: ts 游标（兼容）
    // 游标二选一，不能 OR——否则 since=0 缺省会把全量放回（v1 合并期踩过）
    let picked;
    if (hasAfter) picked = msgs.filter((x) => (x.seq || 0) > after);
    else if (hasSince) picked = msgs.filter((x) => x.ts > since);
    else picked = msgs.slice(-100);
    picked = picked.slice(-100);
    if (hasSince && !hasAfter) return json(res, 200, picked); // 旧客户端：裸数组
    return json(res, 200, { me: m.name, latest: seq, messages: picked });
  }
  if (req.method === 'GET' && u.pathname === '/api/health') {
    return json(res, 200, { ok: true, me: m.name, members: ANON ? ['anon(降级模式)'] : IDS, msgs: seq, auth: !ANON });
  }
  if (req.method === 'POST' && u.pathname === '/api/messages') {
    if (!ANON && !rateOk(m.token)) return json(res, 429, { error: `rate limit ${RATE}/min` });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let text = '', from = m.name;
      try {
        const j = JSON.parse(body || '{}');
        text = String(j.text || '').trim();
        if (ANON && !from) from = String(j.from || 'anon').slice(0, 32); // 降级模式才允许自报身份
      } catch { return json(res, 400, { error: 'bad json' }); }
      if (!text || text.length > 2000) return json(res, 400, { error: 'text required, <=2000' });
      if (SECRET_RE.test(text)) return json(res, 400, { error: '疑似密钥/凭据被拦截: 聊天内容会进 git 与云端, 密钥严禁入聊' });
      // ③/⑥：身份服务端签发（token 模式覆写 body.from）；@寻址服务端解析（anon 模式用内置成员表）
      const msg = { seq: ++seq, id: randomUUID().slice(0, 8), ts: Date.now(), from: from || 'anon', to: parseMentions(text), text };
      appendFileSync(LOG, JSON.stringify(msg) + '\n');
      msgs.push(msg);
      json(res, 200, msg);
    });
    return;
  }
  json(res, 404, { error: 'not found' });
}).listen(PORT, HOST, () => {
  console.log(`[room-v2] http://${HOST}:${PORT} mode=${ANON ? 'anon(loopback)' : 'token'} members=${ANON ? '(anon)' : IDS.join(',')} log=${LOG.replace(root, '.')}`);
  if (ANON) console.warn('[room-v2] 降级模式：未设 ROOM_TOKENS，from 自报有效——仅限本机调试，公网必须 token 模式！');
});
