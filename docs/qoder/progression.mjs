// 关卡推进元规则（Qoder 投递，AI-HANDOFF v2 §5）：局内循环的唯一母本。
// cc-free：存储用适配器注入（web: localStorage；Cocos: sys.localStorage 包一层同名方法即可）。
// 设计决策：
//   ① 同关重开换图（seed=level*1000+attempt，attempt 随失败递增）—— procedural 关卡下
//      换图比"背图重开"挫败感低，且每图仍可复现（seed 确定）。
//   ② 状态必须跨重启存活（JSON 落存储），损坏则全新开局，绝不让脏数据卡死循环。
//   ③ 星级只依赖 time+bricks，无随机，人机验收可断言。

export const STORAGE_KEY = 'shortcut_run_progress_v1';

const FRESH = () => ({ v: 1, level: 1, attempt: 1, wins: 0, best: {} });

// 三星线（秒）：≈ 人形 bot 胜局用时前 1/3（items-on 实测 P25，g1-tuning §6，2026-09-22 校准）。
// loop 补偿：关卡每 loop +20m（cfgForLevel），旧版模 10 查表使 L11+ 达线率 0-4%、L21+ 恒 0。
const PAR = [16.5, 19.0, 19.5, 18.5, 19.5, 18.5, 19.5, 20.5, 20.5, 21.5];
const PAR_LOOP_SHIFT = 2.5; // 实测每 loop 胜局用时 +2.5~2.6s

export function parFor(level) {
  return PAR[(level - 1) % PAR.length] + Math.floor((level - 1) / PAR.length) * PAR_LOOP_SHIFT;
}

export function starsFor(level, timeSec, bricksLeft) {
  return 1 + (bricksLeft >= 3 ? 1 : 0) + (timeSec <= parFor(level) ? 1 : 0);
}

export function createProgress(store) {
  function load() {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return FRESH();
      const j = JSON.parse(raw);
      if (j.v !== 1 || !(j.level >= 1)) return FRESH();
      return j;
    } catch {
      return FRESH(); // 脏数据不让循环卡死
    }
  }
  let s = load();
  const save = () => store.setItem(STORAGE_KEY, JSON.stringify(s));

  return {
    state: () => ({ ...s }),
    starsFor,

    // 当前图：seed + 本关 cfg。step-5 接入点：每次进场调一次，胜/负回调后再调
    current: (cfgForLevel) => ({
      level: s.level,
      seed: s.level * 1000 + s.attempt,
      cfg: cfgForLevel(s.level),
    }),

    // 胜利：记成绩/星级，进下一关，attempt 归 1
    win(timeSec, bricksLeft) {
      const lv = s.level;
      const stars = starsFor(lv, timeSec, bricksLeft);
      s.wins += 1;
      if (!s.best[lv] || timeSec < s.best[lv].time) {
        s.best[lv] = { time: +timeSec.toFixed(2), stars };
      }
      s.level = lv + 1;
      s.attempt = 1;
      save();
      return { nextLevel: s.level, stars, best: s.best[lv] };
    },

    // 失败：同关换图（attempt++），封顶 99 防 seed 溢出（图循环复用，可接受）
    lose() {
      s.attempt = Math.min(s.attempt + 1, 99);
      save();
      return { level: s.level, seed: s.level * 1000 + s.attempt };
    },

    // QA/重测用：清空进度
    reset() { s = FRESH(); save(); },
  };
}
