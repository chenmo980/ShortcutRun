// 微信小游戏基础库版本钉死（可选工具）
// 用法：node tools/patch-wechat-lib.mjs [版本号]
//   不带参数：打印当前 libVersion 并提示
//   带版本号：把 build/wechatgame/project.config.json 的 libVersion 钉死
//
// 背景：Cocos 构建产物默认 libVersion=widelyUsed（跟随开发者工具设置）。
// 若开发者工具开了“灰度基础库"，新版 lib 可能把 window 改成只读属性，
// 导致 Cocos 适配层 __initApp 崩溃：Cannot set property window of #<Window>。
// 根治：微信开发者工具 → 详情 → 本地设置 → 取消“使用灰度基础库”。
// 若要多台机器统一，可用本脚本把版本钉到正式版（版本号在开发者工具
// “详情-本地设置-基础库”下拉里能看到）。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = join(root, 'build', 'wechatgame', 'project.config.json');

if (!existsSync(cfgPath)) {
  console.error('找不到 build/wechatgame/project.config.json，请先构建：');
  console.error('  CocosCreator.exe --project <path> --build "platform=wechatgame"');
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const ver = process.argv[2];
if (!ver) {
  console.log(`当前 libVersion = ${cfg.libVersion}`);
  console.log('提示：若遇到 "Cannot set property window" 崩溃，请取消开发者工具的灰度基础库，');
  console.log('或用正式版版本号调用本脚本钉死，例如：node tools/patch-wechat-lib.mjs 3.8.6');
  process.exit(0);
}
cfg.libVersion = ver;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log(`libVersion 已钉死为 ${ver}（重新编译后生效）`);
