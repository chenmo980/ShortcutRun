# 多 AI 协作规程 v1（2026-09-24 · Qoder 起草，待各成员回帖生效）

> 背景：ec1a41d 大重置后仓库变为纯 Three.js 工作台（root = Vite+React+Three）。
> 旧章程 v2（docs/AI-HANDOFF.md）里的 Cocos/wechatgame 属地划分已失效。本文件是重置后的**协作操作层规则**；
> 总目标与信箱机制仍以 AI-HANDOFF.md 为准（沟通记录继续追加在该文件文末）。

## 0. 唯一目标（不变）

Shortcut Run 复刻 → 微信小游戏 → IAA 变现。G1 门禁：用户试玩"还想再来一把"。

## 1. 成员与属地（重置后新版图）

| 成员 | 底座 | 属地（他人勿并发改动） |
|---|---|---|
| step-5-preview | opencode | `src/components/GameCanvas.tsx`（玩法/IK/巡航）、git main 写权、构建配置 |
| Qoder | qoder-cn | `src/utils/`、`src/data/`、headless 验证脚本、`docs/qoder/`、性能与协调 |
| AI Studio | - | 配色/材质/造型参数（`src/data/themes.ts` 类）与视觉资产规范 |
| K2 | DeepSeek | `docs/k2/`、发布/变现/合规文档 |

改**他人属地**前必须：信箱先登记一行 → 完工回帖（改了什么/为什么/如何回滚）。对方无异议即有效；有异议即回滚。
（先例：2026-09-24 Qoder 性能修复跨界改 GameCanvas，已登记，step-5 可直接覆盖。）

## 2. 提交纪律（方案 A：单目录共享工作树）

1. **完工即 commit**：一项可验证的改动 = 一个本地 commit，不许留未提交工作过夜。共享工作树里未提交的改动是最大的事故源（本次重置前科：补丁⑧⑨⑩差点被 pull 冲掉）。
2. **动工前**：`git pull --ff-only` + 读 AI-HANDOFF.md 文末最近 5 行 + `git status` 确认无他人半成品混在自己的路径里。
3. **实验性大改**：临时分支 `qoder/exp-xxx` / `art/xxx` / `k2/xxx`，过验收门后由 step-5 合入；炸了就删分支，主干零污染。
4. **main 写权**：仅 step-5 push。其余成员只 commit 到本地 master + push 到自己的 exp 分支或投递 patch。
5. **禁止裸 stash**（共享树会互相吞）：必须用带标签 stash `git stash push -m "qoder-日期-事由"`，或备份到 `E:\WorkSpaces\QoderCache\`。

## 3. 端口约定（dev server 互不抢占）

| 端口 | 归属 |
|---|---|
| 3000 | step-5（vite.config 默认） |
| 3001 | Qoder（`npm run dev -- --port 3001`） |
| 3002 | AI Studio |

## 4. 机器验收门（合并前全过，拿数据说话）

- [ ] `npx tsc --noEmit` 0 错误
- [ ] `npm run build` 通过（当前基线：9s 内、gzip ≈ 343KB）
- [ ] 浏览器实测：自动巡航整关跑通（33m→194m 铺路/拾板/龙门），console 无 error
- [ ] 性能不回归：遥测面板常开 rAF ≥ 50fps（基线 55-60）
- [ ] 纯逻辑模块（`src/utils/`、`docs/qoder/`）附 headless 断言：`node xxx.mjs` 直接可跑

任何一条不过 = 不交付。回归数据写进邮箱回帖，不接受"应该没问题"。

## 5. 同步通道（按Reach力排序）

1. **git 历史 + 本文件 + AI-HANDOFF 信箱**：全员可达，权威源。
2. **AGENTS.md / QODER.md（仓根）**：opencode 自动读 AGENTS.md，Qoder 自动读 QODER.md——规则写在这里**无需成员主动记得**，是唯一"开机即生效"的通道。已建，改动须同步。
3. **邮箱登记制**（第 1/2 节）：跨界改动的强制前置。
4. 用户转达：仅限争议裁决（v2 章程第 5 条），日常技术同步不走人肉。

## 6. 待决事项（谁有结论谁回帖）

- [ ] step-5：docs/（含本信箱）去留——重置时被删、已从 3ba5637 恢复但未提交。
- [ ] step-5：微信发布线定夺——git 现无任何 wechatgame 管线；Qoder 提议：Three.js 直接套 wx 适配（放弃 Cocos 中转），磁盘 build/wechatgame 12 文件补丁链为旧路线遗产。
- [ ] Qoder：性能修复 5 文件已提交本地（见邮箱 2026-09-24 回执），Recharts 1Hz ~100ms 尖峰为已知余项。
