// agent-room → AI 唤醒网关（零依赖）— 移植自 docs/qoder/room-gateway.mjs（Qoder 设计）
// 作用：让"没在回合里"的 AI 被 @ 时自动醒来。轮询室 API，消息命中 @成员 即以该成员的
//       headless 命令拉起一次执行（消息原文经 ROOM_MSG 环境变量 + {prompt} 注入）。
// 用法：
//   node tools/room-gateway.mjs                      # 读 tools/members.json
//   node tools/room-gateway.mjs --once               # dry-run：只拉一次并打印将唤醒谁，不 spawn
//   node tools/room-gateway.mjs [members.json]
// members.json 模板见 tools/members.json.example（token 不放文件里，走 CHAT_TOKEN 环境变量）。
// 防互唤死循环三闸：①只响应配置里自己的 match 词 ②每成员 cooldownMs 内最多拉一次 ③忽略自己发的帖。
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(root, 'tools', 'members.json');
const DRY = process.argv.includes('--once');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const POLL = cfg.pollMs || 5000;
const COOLDOWN = cfg.cooldownMs || 120_000;
let lastSeq = Number(cfg.startSeq || 0);
const lastFire = new Map(); // member -> ts

async function pull() {
  const headers = process.env.CHAT_TOKEN ? { authorization: `Bearer ${process.env.CHAT_TOKEN}` } : {};
  const r = await fetch(`${cfg.roomUrl}/api/messages?after=${lastSeq}`, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const list = Array.isArray(j) ? j : j.messages; // 兼容旧室裸数组
  if (list.length) lastSeq = Math.max(lastSeq, list[list.length - 1].seq || list[list.length - 1].ts);
  return list;
}

function fire(member, msg) {
  const now = Date.now();
  if (now - (lastFire.get(member) || 0) < COOLDOWN) return; // 闸②
  lastFire.set(member, now);
  const prompt = `聊天室新消息(来自${msg.from}): ${msg.text}\n按项目 AGENTS.md 规程处理; 若需回帖用 node tools/chat.mjs send; 无必要不动文件。`.slice(0, 4000);
  const cmd = cfg.members[member].cmd.replace('{prompt}', prompt.replace(/"/g, '\\"'));
  console.log(`[gateway] wake ${member} <- msg#${msg.seq || msg.ts}（${msg.text.slice(0, 60)}…）`);
  if (DRY) { console.log(`[gateway] dry-run，不执行。命令将是: ${cmd.slice(0, 160)}…`); return; }
  spawn(cmd, { shell: true, stdio: 'inherit', env: { ...process.env, ROOM_MSG: msg.text } });
}

(async () => {
  console.log(`[gateway] watching ${cfg.roomUrl} members=${Object.keys(cfg.members).join(',')}${DRY ? ' (dry-run)' : ''}`);
  for (;;) {
    try {
      for (const m of await pull()) {
        for (const [name, mc] of Object.entries(cfg.members)) {
          if (m.from === name) continue; // 闸③
          const to = m.to || []; // 首选服务端解析的 @ID 寻址（v2 协议），旧室降级文本匹配
          const hit = to.length ? to.some((t) => mc.match.includes(t)) : mc.match.some((k) => m.text.includes(k));
          if (hit) fire(name, m); // 闸①
        }
      }
    } catch (e) {
      console.log(`[gateway] ${e.message}，${POLL}ms 后重试（降级期可直接读 docs/chat/messages.jsonl）`);
    }
    if (DRY) return;
    await new Promise((r) => setTimeout(r, POLL));
  }
})();
