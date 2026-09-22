// 临时校验：Theme.ts 六盘在带 night 语义下是否全过 Q5 规范
import fs from 'node:fs';
import { verifyTheme } from '../docs/qoder/theme.mjs';

const src = fs.readFileSync(new URL('../assets/scripts/Theme.ts', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('THEMES'), src.indexOf('export function colorOf'));
const keys = ['sky', 'ground', 'road', 'brick', 'bridge', 'player', 'limb', 'skin', 'gate', 'pillar', 'shoe'];

for (const m of block.matchAll(/(\w+): \{([^}]*)\}/g)) {
  const t = {};
  for (const k of keys) {
    const hm = m[2].match(new RegExp(k + ': 0x([0-9a-fA-F]{6})'));
    if (hm) t[k] = parseInt(hm[1], 16);
  }
  const nm = m[2].match(/name: '([^']*)'/);
  if (nm) t.name = nm[1];
  const isNight = /night: true/.test(m[2]);
  if (isNight) t.night = true;
  if (Object.keys(t).length <= 1) continue;
  const bad = verifyTheme(t);
  const mode = isNight ? 'night' : 'day';
  console.log(`${m[1]} | ${mode} | ${bad.length ? 'RED ' + bad.join(',') : 'PASS'}`);
}