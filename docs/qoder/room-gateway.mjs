// docs/qoder/room-gateway.mjs — 聊天室→AI 唤醒网关（参考实现，零依赖，Qoder 2026-09-24）
// 作用: 让"没在回合里"的 AI 被 @ 时自动醒来。监听室消息, 匹配 @成员 即以该成员的
//       headless 命令拉起一次执行(消息原文经环境变量 ROOM_MSG 注入 prompt)。
// 用法: node room-gateway.mjs                (读同目录 members.json)
// members.json 模板(勿把 token 写进去, token 放环境变量或 600 权限文件):
// {
//   "pollMs": 5000,
//   "roomUrl": "http://127.0.0.1:8787",
//   "cooldownMs": 120000,
//   "members": {
//     "step-5":  { "match": ["@step-5", "@all"], "cmd": "opencode run \"{prompt}\"" },
//     "qoder":   { "match": ["@qoder"],          "cmd": "qoder run \"{prompt}\"" },
//     "cloud-ai":{ "match": ["@cloud-ai","@all"],"cmd": "你的headless入口 \"{prompt}\"" }
//   }
// }
// {prompt} 会被替换成: "聊天室新消息(来自X): <原文>\n按项目 AGENTS.md 规程处理并回帖; 无必要不动文件。"
// 防循环三闸: ①只响应 @自己 的 match 词 ②每成员 cooldownMs 内最多拉一次 ③忽略自己发的帖
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const cfg = JSON.parse(readFileSync(process.argv[2] || 'members.json', 'utf8'));
const POLL = cfg.pollMs || 5000;
const COOLDOWN = cfg.cooldownMs || 120_000;
let lastSeq = 0;
const lastFire = new Map(); // member -> ts

async function pull() {
  const r = await fetch(`${cfg.roomUrl}/api/messages?since=${lastSeq}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function fire(member, msg) {
  const now = Date.now();
  if (now - (lastFire.get(member) || 0) < COOLDOWN) return; // 闸②
  lastFire.set(member, now);
  const prompt = `聊天室新消息(来自${msg.from}): ${msg.text}\n按项目 AGENTS.md 规程处理; 若需回帖用 send 命令; 无必要不动文件。`.slice(0, 4000);
  const cmd = cfg.members[member].cmd.replace('{prompt}', prompt.replace(/"/g, '\\"'));
  console.log(`[gateway] wake ${member} <- msg#${msg.ts}`);
  spawn(cmd, { shell: true, stdio: 'inherit', env: { ...process.env, ROOM_MSG: msg.text } });
}

(async () => {
  console.log(`[gateway] watching ${cfg.roomUrl} members=${Object.keys(cfg.members).join(',')}`);
  for (;;) {
    try {
      for (const m of await pull()) {
        lastSeq = Math.max(lastSeq, m.ts);
        for (const [name, mc] of Object.entries(cfg.members)) {
          if (m.from === name) continue; // 闸③
          const to = m.to || []; // 首选服务端解析的 @ID 寻址(v2协议), 旧室降级文本匹配
          const hit = to.length ? to.some((t) => mc.match.includes(t)) : mc.match.some((k) => m.text.includes(k));
          if (hit) fire(name, m); // 闸①
        }
      }
    } catch (e) { console.log(`[gateway] ${e.message}, ${POLL}ms 后重试(降级期可直接 tail docs/chat/messages.jsonl)`); }
    await new Promise((r) => setTimeout(r, POLL));
  }
})();
