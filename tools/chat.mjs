// AI 侧聊天 CLI（零依赖）——agent-room v2 协议（含旧室 since 兼容）
// 环境变量：
//   CHAT_URL=http://<服务器>:8787   指向服务（默认 http://localhost:8787）
//   CHAT_TOKEN=<token>              token 身份（服务端 token 模式必填；本机降级模式可空）
// 用法：
//   node tools/chat.mjs send <from> <消息...>     发消息（token 模式下 from 被服务端覆写，仅为本地显示）
//   node tools/chat.mjs tail [n] [@me]           看最近 n 条（默认 20；@me=只看提我的+广播）
//   node tools/chat.mjs unread                   未读条数（基于本地游标 docs/chat/.cursor）
//   node tools/chat.mjs watch [@me]              常驻跟进（2s 增量）
//   node tools/chat.mjs health                   探活
//   node tools/chat.mjs sync                     把服务端记录拉回本地 jsonl（按 seq 去重，供 git 归档）
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.CHAT_URL || `http://localhost:${process.env.CHAT_PORT || 8787}`).replace(/\/$/, '');
const TOKEN = process.env.CHAT_TOKEN || '';
const CURSOR_FILE = join(root, 'docs', 'chat', '.cursor');

function loadCursor() { try { return existsSync(CURSOR_FILE) ? Number(readFileSync(CURSOR_FILE, 'utf8').trim()) || 0 : 0; } catch { return 0; } }
function saveCursor(seq) { mkdirSync(dirname(CURSOR_FILE), { recursive: true }); writeFileSync(CURSOR_FILE, String(seq)); }

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const r = await fetch(BASE + path, { ...opts, headers });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
  return r.json();
}

const fmt = (m) => `[${new Date(m.ts).toTimeString().slice(0, 8)}] ${m.from}${m.to && m.to.length && m.to[0] !== '@all' ? ' → ' + m.to.join(' ') : ''}: ${m.text}`;
function isMine(m, who) {
  if (!who) return true;
  const to = m.to || ['@all'];
  return to.includes('@all') || to.includes('@' + who) || m.from === who;
}

const [, , cmd, ...rest] = process.argv;

async function main() {
  if (cmd === 'send') {
    // token 模式：from 由服务端签发，请求体的 from 无效；容忍用户习惯性多打一个身份词
    let text = rest.join(' ');
    if (TOKEN && /^(@?)(step-5|qoder|human|cloud-ai|k2|art-studio|system)\s+/.test(text)) text = text.replace(/^(@?)(step-5|qoder|human|cloud-ai|k2|art-studio|system)\s+/, '');
    if (!text.trim()) { console.error('用法: node tools/chat.mjs send <消息...>（token 模式身份由服务端签发）'); process.exit(1); }
    const msg = await api('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(TOKEN ? { text } : { from: rest[0] || 'anon', text }) });
    console.log(`${fmt(msg)}  → ${BASE}`);
    if (msg.seq) saveCursor(msg.seq);
  } else if (cmd === 'tail') {
    let n = 20, who = '';
    for (const a of rest) { if (/^@/.test(a)) who = a.slice(1); else n = Number(a) || 20; }
    const j = await api('/api/messages?after=0');
    const list = Array.isArray(j) ? j : j.messages;
    const shown = list.filter((m) => isMine(m, who)).slice(-n);
    for (const m of shown) console.log(fmt(m));
    saveCursor(list.length ? list[list.length - 1].seq || list[list.length - 1].ts : loadCursor());
  } else if (cmd === 'unread') {
    const j = await api('/api/messages?after=' + loadCursor());
    const list = Array.isArray(j) ? j : j.messages;
    const fresh = list.filter((m) => (m.seq || m.ts) > loadCursor());
    console.log(`未读 ${fresh.length} 条（游标 ${loadCursor()} → ${list.length ? list[list.length - 1].seq : loadCursor()}）`);
    if (fresh.length) { for (const m of fresh.slice(0, 10)) console.log(fmt(m)); if (fresh.length > 10) console.log(`…共 ${fresh.length} 条，tail 看全`); }
    if (list.length) saveCursor(list[list.length - 1].seq || list[list.length - 1].ts);
  } else if (cmd === 'watch') {
    const who = rest.find((a) => /^@/.test(a))?.slice(1) || '';
    let after = loadCursor();
    console.log(`[chat] watch ${BASE}${who ? ` @${who}` : ''}（Ctrl+C 退出）`);
    for (;;) {
      try {
        const j = await api('/api/messages?after=' + after);
        const list = Array.isArray(j) ? j : j.messages;
        for (const m of list.filter((x) => isMine(x, who))) console.log(fmt(m));
        if (list.length) { after = list[list.length - 1].seq || after; saveCursor(after); }
      } catch (e) {
        console.log('[chat] 连接失败，2s 后重试：', String(e.message || e).split('\n')[0].slice(0, 120));
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } else if (cmd === 'health') {
    console.log(JSON.stringify(await api('/api/health'), null, 1));
  } else if (cmd === 'sync') {
    const j = await api('/api/messages?after=0');
    const list = Array.isArray(j) ? j : j.messages;
    const local = join(root, 'docs', 'chat', 'messages.jsonl');
    const seen = new Set(existsSync(local) ? readFileSync(local, 'utf8').split('\n').filter(Boolean) : []);
    let added = 0;
    for (const m of list) { const line = JSON.stringify(m); if (!seen.has(line)) { appendFileSync(local, line + '\n'); seen.add(line); added++; } }
    if (list.length) saveCursor(list[list.length - 1].seq || 0);
    console.log(`[chat] sync 完成：服务端 ${list.length} 条，新增归档 ${added} 条 → ${local.replace(root, '.')}`);
  } else {
    console.log('用法: send <from> <消息> | tail [n] [@me] | unread | watch [@me] | health | sync');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[chat] 失败: ${String(e.message || e).split('\n')[0]}`);
  console.error('       排查: CHAT_URL 指向? CHAT_TOKEN 一致? 服务端 node tools/chat-server.mjs 起着?');
  process.exit(1);
});
