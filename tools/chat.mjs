// AI 侧聊天 CLI（零依赖）——支持本机或云端
// 环境变量：
//   CHAT_URL=http://<云服务器IP>:8787   指向云端服务（默认 http://localhost:8787）
//   CHAT_TOKEN=<token>                  云端部署的鉴权 token（本机模式不需要）
// 用法：
//   node tools/chat.mjs send <from> <消息...>    发消息
//   node tools/chat.mjs tail [n]                看最近 n 条（默认 20）
//   node tools/chat.mjs watch                   常驻跟进（2s 增量）
//   node tools/chat.mjs health                  探活
//   node tools/chat.mjs sync                    把云端/远端记录拉回本地 jsonl（按 ts 去重，供 git 归档）
const BASE = (process.env.CHAT_URL || `http://localhost:${process.env.CHAT_PORT || 8787}`).replace(/\/$/, '');
const TOKEN = process.env.CHAT_TOKEN || '';

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const r = await fetch(BASE + path, { ...opts, headers });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text().catch(() => '')}`);
  return r.json();
}

const [, , cmd, ...rest] = process.argv;

async function main() {
if (cmd === 'send') {
  const from = rest[0] || 'anon';
  const text = rest.slice(1).join(' ');
  if (!text) { console.error('用法: node tools/chat.mjs send <from> <消息...>'); process.exit(1); }
  const msg = await api('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from, text }) });
  console.log(`[${new Date(msg.ts).toTimeString().slice(0, 8)}] ${from}: ${text}  → ${BASE}`);
} else if (cmd === 'tail') {
  const n = Number(rest[0] || 20);
  const msgs = await api('/api/messages');
  for (const m of msgs.slice(-n)) console.log(`[${new Date(m.ts).toTimeString().slice(0, 8)}] ${m.from}: ${m.text}`);
} else if (cmd === 'watch') {
  let since = 0;
  console.log(`[chat] watch ${BASE}（Ctrl+C 退出）`);
  for (;;) {
    try {
      const msgs = await api('/api/messages?since=' + since);
      for (const m of msgs) { console.log(`[${new Date(m.ts).toTimeString().slice(0, 8)}] ${m.from}: ${m.text}`); since = m.ts; }
    } catch (e) {
      console.log('[chat] 连接失败，2s 后重试：', String(e).slice(0, 120));
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
} else if (cmd === 'health') {
  console.log(JSON.stringify(await api('/api/health'), null, 1));
} else if (cmd === 'sync') {
  // 拉远端全量 → 按 ts 去重合并进本地 docs/chat/messages.jsonl
  const { appendFileSync, readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const local = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'chat', 'messages.jsonl');
  const seen = new Set(existsSync(local) ? readFileSync(local, 'utf8').split('\n').filter(Boolean).map((l) => l) : []);
  const remote = await api('/api/messages');
  let added = 0;
  for (const m of remote) {
    const line = JSON.stringify(m);
    if (!seen.has(line)) { appendFileSync(local, line + '\n'); seen.add(line); added++; }
  }
  console.log(`[chat] sync 完成：远端 ${remote.length} 条，新增归档 ${added} 条 → ${local}`);
} else {
  console.log('用法: send <from> <消息> | tail [n] | watch | health | sync');
  process.exit(1);
}
}

main().catch((e) => {
  console.error(`[chat] 失败: ${String(e.message || e).split('\n')[0]}`);
  console.error('       排查: CHAT_URL 指向? CHAT_TOKEN 一致? 服务端 node tools/chat-server.mjs 起着?');
  process.exit(1);
});
