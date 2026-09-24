// AI 侧聊天 CLI（零依赖）
// 用法：
//   node tools/chat.mjs send <from> <消息...>    发消息
//   node tools/chat.mjs tail [n]                看最近 n 条（默认 20）
//   node tools/chat.mjs watch                   常驻跟进（2s 增量）
//   node tools/chat.mjs health                  探活
// 服务未起时：node tools/chat-server.mjs &  （或先发消息，本脚本会提示）
const BASE = `http://localhost:${process.env.CHAT_PORT || 8787}`;

async function api(path, opts) {
  const r = await fetch(BASE + path, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'send') {
  const from = rest[0] || 'anon';
  const text = rest.slice(1).join(' ');
  if (!text) { console.error('用法: node tools/chat.mjs send <from> <消息...>'); process.exit(1); }
  const msg = await api('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from, text }) });
  console.log(`[${new Date(msg.ts).toTimeString().slice(0, 8)}] ${from}: ${text}`);
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
      if (String(e).includes('fetch failed') || String(e).includes('HTTP')) { console.log('[chat] 服务未启动，2s 后重试…（启动: node tools/chat-server.mjs &）'); }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
} else if (cmd === 'health') {
  console.log(JSON.stringify(await api('/api/health'), null, 1));
} else {
  console.log('用法: send <from> <消息> | tail [n] | watch | health');
  process.exit(1);
}
