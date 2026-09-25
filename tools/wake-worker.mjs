// 通用无头 worker 启动器（gateway --live 的執行端）
// 由 tools/room-gateway.mjs 在 @命中 时 spawn；环境变量由 gateway 注入：
//   ROOM_MSG      消息原文
//   ROOM_MEMBER  被唤醒的成员名（qoder / step-5 / cloud-ai ...）
//   ROOM_MSG_FROM 发帖人
//   ROOM_MSG_SEQ  消息 seq
// CLI 自动探测顺序（本机 2026-09-24 实测快照）：
//   1) qoder   （Qoder CLI，`-p` 非交互；曾可用后被 Qoder 更新清掉 npm shim，恢复即自动选中）
//   2) claude  （claude.cmd，需先 `claude /login`）
//   3) dsh     （DeepSeek harness，`--profile headless`；依赖用户 DSH 模型配置可用）
// 4) 都没有 → 落 wake-<member>.log 报错退出（gateway 下次心跳再试）
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logDir = join(root, 'docs', 'chat');
mkdirSync(logDir, { recursive: true });
const member = process.env.ROOM_MEMBER || 'worker';
const logFile = join(logDir, `wake-${member}.log`);
const log = (line) => {
  const s = `[${new Date().toISOString()}] ${line}\n`;
  appendFileSync(logFile, s);
  console.log(s.trim());
};

const cli = (process.env.WORKER_CLI || '').trim(); // 可强制指定
const msg = process.env.ROOM_MSG || '';
const from = process.env.ROOM_MSG_FROM || '?';
const seq = process.env.ROOM_MSG_SEQ || '?';

if (!msg.trim()) { log('WAKE-SKIP: ROOM_MSG 为空'); process.exit(0); }

const prompt = [
  `你是 Shortcut Run 项目协作室的「${member}」值守 worker（由 gateway 自动唤醒的无头会话）。`,
  `先读仓根 AGENTS.md 与 AI-HANDOFF.md（最近 10 行），遵守其中章程（地盘/登记/门禁/纪律）。`,
  `触发你的消息（来自 ${from}，seq#${seq}）：`,
  msg,
  `处理要求：`,
  `1. 若消息是任务/报障：按章程处理；动他人属地前先 node tools/chat.mjs send ${member} 登记；完工跑 npm run lint + npm run build + node tools/verify-app.mjs 三门禁后 commit。`,
  `2. 若消息只需回应：直接回帖。`,
  `3. 无必要不动文件、不碰人类机器配置、不外传任何密钥。`,
  `4. 完成后必须回帖：node tools/chat.mjs send ${member} "<结论：改了什么/门禁结果/待办>"（注意核对输出的 from 是你自己）。`,
].join('\n');

// —— CLI 探测与命令组装 ——
// Windows 上 spawn(无 shell) 不做 PATHEXT 解析，'qoder' 找不到 'qoder.cmd'（ENOENT 踩坑）——
// 用 where/which 拿全路径再 spawn
const resolveCli = (name) => {
  try {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
    if (r.status === 0 && (r.stdout || '').trim()) return r.stdout.split(/\r?\n/)[0].trim();
  } catch { /* ignore */ }
  return null;
};
const cands = [
  {
    name: 'qoder',
    found: () => !!resolveCli('qoder') || !!resolveCli('qoder.cmd'),
    build: (p) => ({ cmd: resolveCli('qoder') || resolveCli('qoder.cmd') || 'qoder', args: ['-p', p, '--permission-mode', 'accept_edits'] }),
  },
  {
    name: 'claude',
    found: () => !!resolveCli('claude') || !!resolveCli('claude.cmd'),
    build: (p) => ({ cmd: resolveCli('claude') || resolveCli('claude.cmd') || 'claude', args: ['-p', p, '--permission-mode', 'acceptEdits'] }),
  },
  {
    name: 'dsh',
    found: () => !!resolveCli('dsh') || !!resolveCli('dsh.ps1'),
    build: (p) => ({ cmd: resolveCli('dsh') || resolveCli('dsh.ps1') || 'dsh', args: ['--profile', 'headless', p] }),
  },
];

let chosen = cli ? cands.find((c) => c.name === cli) : null;
if (!chosen && !cli) chosen = cands.find((c) => c.found()) || null;
if (!chosen) {
  log(`WAKE-FAIL: 无可用无头 CLI。恢复任一项即可自动生效：qoder CLI（npm i -g qodercli）/ claude（claude /login）/ dsh（配好模型）。msg#${seq} from ${from}: ${msg.slice(0, 120)}`);
  process.exit(2);
}

// 单行化 argv：cmd.exe /c 无法承载换行符（E2E 踩坑），CLI 侧用 ⏎ 分段语义不变；
// 完整多行 prompt 仍在 ROOM_MSG 环境变量里，worker 可自取
const cliPrompt = prompt.replace(/\s*[\r\n]+\s*/g, ' | ');

// Windows 上给 .cmd CLI 传参的最稳形态（E2E 四轮踩坑后的结论）：
// node shell:true 的 cmd 封装引号不可靠 / cmd /c 手拼引号是地狱 / powershell -File 不吃 .cmd
// → wake-worker 生成临时 wrapper .cmd（UTF-8 + chcp 65001 保中文），spawn 只传单路径零引号问题
function toSpawnable(cmd, args) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd)) {
    const wrapper = join(root, 'docs', 'chat', `.wake-${member}-run.cmd`);
    const line = [cmd, ...args].map((a) => `"${String(a).replace(/"/g, '""')}"`).join(' ');
    writeFileSync(wrapper, `@echo off\r\nchcp 65001 > nul\r\n${line}\r\n`, 'utf8');
    return { cmd: process.env.COMSPEC || 'cmd.exe', args: ['/d', '/c', wrapper], shell: false };
  }
  return { cmd, args, shell: false };
}

const { cmd, args } = chosen.build(cliPrompt);
const spawnable = toSpawnable(cmd, args);
log(`WAKE-FIRE member=${member} cli=${chosen.name} cmd=${cmd} msg#${seq} from=${from}: ${msg.slice(0, 100)}`);
const child = spawn(spawnable.cmd, spawnable.args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: spawnable.shell });
child.stdout.on('data', (d) => log(`[${chosen.name}:out] ${String(d).trim().slice(0, 400)}`));
child.stderr.on('data', (d) => log(`[${chosen.name}:err] ${String(d).trim().slice(0, 400)}`));
child.on('error', (e) => log(`WAKE-ERROR: spawn ${chosen.name} 失败: ${e.message}`));
child.on('exit', (code) => log(`WAKE-DONE member=${member} cli=${chosen.name} exit=${code}`));
