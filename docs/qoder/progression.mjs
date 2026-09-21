// 关卡推进元规则（Qoder 投递，AI-HANDOFF v2 §5）：局内循环的唯一母本。
// cc-free：存储用适配器注入（web: localStorage；Cocos: sys.localStorage 包一层同名方法即可）。
// 设计决策：
//   ① 同关重开换图（seed=level*1000+attempt，attempt 随失败递增）—— procedural 关卡下
//      换图比"背图重开"挫败感低，且每图仍可复现（seed 确定）。
//   ② 状态必须跨重启存活（JSON 落存储），损坏则全新开局，绝不让脏数据卡死循环。
//   ③ 星级只依赖 time+bricks，无随机，人机验收可断言。

export const STORAGE_KEY = 'shortcu…s_v1';

const FRESH = () => ({ v: 1, level: 1, attempt: 1, wins: 0, best: {} });

// 三星线（秒）：≈ 人形 bot 通关均时的快档（约前 1/3），L11+ 循环复用
const PAR = [16.5, 18.5, 20.0, 20.0, 21.0, 20.5, 21.5, 23.0, 22.5, 23.5];

function starsFor(level, timeSec, bricksLeft) {
  const par = PAR[(level - 1) % PAR.length];
  return 1 + (bricksLeft >= 3 ? 1 : 0) + (timeSec <= par ? 1 : 0);
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
