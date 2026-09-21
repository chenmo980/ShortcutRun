// 关卡推进元规则 —— 移植自 docs/qoder/progression.mjs(母本,规则不许自创)
// cc-free:存储用适配器注入。web 传 localStorage;Cocos/微信用 sys.localStorage 包同名接口。
// 规则:seed = level*1000 + attempt(失败同关换图、每图可复现);
//       状态跨重启存活,脏档自愈;星级只依赖 time+bricks;attempt 封顶 99。
// GameApp 接入:onLoad 建实例 → startLevel 用 current() → win()/lose() 回调后再 startLevel。

export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = 'shortcu...s_v1';

export interface BestRecord { time: number; stars: number; }

export interface ProgState {
  v: number;
  level: number;
  attempt: number;
  wins: number;
  best: Record<number, BestRecord>;
}

const FRESH = (): ProgState => ({ v: 1, level: 1, attempt: 1, wins: 0, best: {} });

// 三星线(秒):≈ 人形 bot 通关均时的快档(约前 1/3),L11+ 循环复用
const PAR = [16.5, 18.5, 20.0, 20.0, 21.0, 20.5, 21.5, 23.0, 22.5, 23.5];

export function starsFor(level: number, timeSec: number, bricksLeft: number): number {
  const par = PAR[(level - 1) % PAR.length];
  return 1 + (bricksLeft >= 3 ? 1 : 0) + (timeSec <= par ? 1 : 0);
}

export function createProgress(store: ProgressStore) {
  function load(): ProgState {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return FRESH();
      const j = JSON.parse(raw) as ProgState;
      if (j.v !== 1 || !(j.level >= 1)) return FRESH();
      return j;
    } catch {
      return FRESH(); // 脏数据不让循环卡死
    }
  }
  let s = load();
  const save = () => {
    try { store.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* 存储不可用不卡循环 */ }
  };

  return {
    state: (): ProgState => ({ ...s }),
    starsFor,

    // 当前图:seed + 本关 cfg。接入点:每次进场调一次,胜/负回调后再调
    current<T>(cfgForLevel: (level: number) => T): { level: number; seed: number; cfg: T } {
      return { level: s.level, seed: s.level * 1000 + s.attempt, cfg: cfgForLevel(s.level) };
    },

    // 胜利:记成绩/星级,进下一关,attempt 归 1
    win(timeSec: number, bricksLeft: number) {
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

    // 失败:同关换图(attempt++),封顶 99 防 seed 溢出
    lose() {
      s.attempt = Math.min(s.attempt + 1, 99);
      save();
      return { level: s.level, seed: s.level * 1000 + s.attempt };
    },

    // QA/重测用:清空进度
    reset() { s = FRESH(); save(); },
  };
}

export type Progress = ReturnType<typeof createProgress>;
