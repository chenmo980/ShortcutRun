import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { ColorPalette, VisualSettings } from '../types';
import { createGame, GameHandle, SECTION_SHORTCUTS } from '../game/core';
import { PerformanceMonitor, PerfMetricPoint } from './PerformanceMonitor';

// GameCanvas = 薄壳(刀1抽取后): HUD/面板/对话框保留 React; 场景/仿真/输入/音频/遥测全部在 src/game/core.ts
// core 零 React: Web 壳由本文件挂 canvas 容器, 小游戏壳直传 wx.createCanvas, 同接口复用
interface GameCanvasProps {
  palette: ColorPalette;
  settings: VisualSettings;
  onUpdateSettings?: (settings: Partial<VisualSettings>) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  palette,
  settings,
  onUpdateSettings,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GameHandle | null>(null);

  const [gameState, setGameState] = useState<'idle' | 'running' | 'bridging' | 'drowned' | 'finished'>('running');
  const [plankCount, setPlankCount] = useState<number>(settings.infinitePlanks ? 30 : 12);
  const [finalMultiplier, setFinalMultiplier] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [progressZ, setProgressZ] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Performance telemetry state for Recharts waveform
  const [perfHistory, setPerfHistory] = useState<PerfMetricPoint[]>(() => {
    const initial: PerfMetricPoint[] = [];
    for (let i = 12; i >= 0; i--) {
      initial.push({
        time: `${i}s`,
        fps: 60,
        drawCalls: 38,
        renderMs: 1.2,
      });
    }
    return initial;
  });
  const [liveFps, setLiveFps] = useState<number>(60);
  const [liveDrawCalls, setLiveDrawCalls] = useState<number>(38);
  const [liveRenderMs, setLiveRenderMs] = useState<number>(1.2);
  const [cameraViewMode, setCameraViewMode] = useState<'chase' | 'front' | 'side'>('chase');
  // 轮77: 秒传条在竖屏414px下flex-wrap成8行(~240px高)盖掉半个canvas(r72/r76帧实锤), 窄屏默认收成一颗📍徽标, 点击展开; 桌面(≥768px)默认展开零回归
  const [jumpBarOpen, setJumpBarOpen] = useState<boolean>(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));

  // 主生命周期: 与旧版主 useEffect 同依赖(角色/板皮/AI/平面阴影变更即整局重建, 零回归)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const handle = createGame({
      parent: container,
      palette,
      settings,
      width: container.clientWidth || undefined,
      height: container.clientHeight || undefined,
    });
    handleRef.current = handle;

    const off = handle.onEvent((ev) => {
      if (ev.state !== undefined) setGameState(ev.state);
      if (ev.planks !== undefined) setPlankCount(ev.planks);
      if (ev.score !== undefined) setScore(ev.score);
      if (ev.multiplier !== undefined) setFinalMultiplier(ev.multiplier);
      if (ev.progress !== undefined) setProgressZ(ev.progress);
      if (ev.paused !== undefined) setIsPaused(ev.paused);
      if (ev.cameraView !== undefined) setCameraViewMode(ev.cameraView);
      if (ev.perf) {
        const { fps, drawCalls, renderMs } = ev.perf;
        setLiveFps(fps);
        setLiveDrawCalls(drawCalls);
        setLiveRenderMs(renderMs);
        setPerfHistory((prev) => {
          const now = new Date();
          const timeLabel = `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;
          const next = [...prev, { time: timeLabel, fps, drawCalls, renderMs }];
          return next.length > 25 ? next.slice(next.length - 25) : next;
        });
      }
      if (ev.finished) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    });

    handle.start();

    // 轮76: dev-only探针钩子——SwiftShader低帧率+HUD 5Hz节流下截图判读不可靠, 无头取证需直读playerX/steerOffset; 生产构建不含(import.meta.env.DEV)
    // 保持 __shortcutRun.current.playerZ 读法兼容: current 为实时快照 getter
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__shortcutRun = {
        get current() {
          return handle.debug();
        },
      };
    }

    return () => {
      off();
      handle.dispose();
      handleRef.current = null;
    };
  }, [palette.id, settings.characterType, settings.plankStyle, settings.showOpponent, settings.planarShadows]);

  // 运行期设置实时同步(不含触发重建的头4项): 音频开关/物理参数/IK/自动巡航等
  useEffect(() => {
    handleRef.current?.setSettings(settings);
  }, [settings]);

  const resetGame = useCallback((targetZ: number = 0) => {
    handleRef.current?.reset(targetZ);
  }, []);

  const togglePaused = useCallback(() => {
    handleRef.current?.togglePaused();
  }, []);

  const setCameraView = useCallback((mode: 'chase' | 'front' | 'side') => {
    handleRef.current?.setCameraView(mode);
    setCameraViewMode(mode);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-900">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating HUD: Telemetry & Testing Quick Toggles —— 轮81: 徽标改挂右下后撤pr-[17rem]让位带(登记窗口内与PerformanceMonitor同批落地) */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Left Side: Planks, State, Progress —— min-w-0: flex默认min-width:auto会被nowrap进度chip(209px)撑住不随父pr收缩, 必须显式放开; 轮89: 轮85默认折叠后徽标常驻md右上(右缘起于~224px宽处), 左组限宽让位→chips自行wrap到第二行, 1280+(lg)不受限零回归 */}
        <div className="flex min-w-0 md:max-w-[calc(100%-15rem)] xl:max-none flex-wrap items-center gap-2 pointer-events-auto">
          {/* Carried Planks Badge */}
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg">
            <div
              className="w-3.5 h-3.5 rounded-sm shadow-sm"
              style={{ backgroundColor: palette.plankColor }}
            />
            <span className="text-[11px] font-semibold tracking-wider text-slate-400">木板</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {settings.infinitePlanks ? '∞' : plankCount}
            </span>
          </div>

          {/* Running State Badge */}
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                gameState === 'bridging'
                  ? 'bg-amber-400'
                  : gameState === 'drowned'
                  ? 'bg-rose-500'
                  : gameState === 'finished'
                  ? 'bg-emerald-400'
                  : 'bg-cyan-400'
              }`}
            />
            <span className="text-[11px] font-medium text-slate-200">
              {gameState === 'bridging'
                ? '水面铺桥'
                : gameState === 'drowned'
                ? '落水'
                : gameState === 'finished'
                ? `冲线登顶 (x${finalMultiplier.toFixed(1)})`
                : '奔跑中'}
            </span>
          </div>

          {/* Distance Progress Badge —— 轮79: r78帧实锤chip被130px可用宽挤成三行(关卡\n进度 2m /\n350m), nowrap让chip整体换行不碎行 */}
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap">
            <span className="text-[11px] text-slate-400 font-medium">关卡进度</span>
            <span className="text-[12px] font-bold font-mono text-cyan-300">
              {progressZ}m / 350m
            </span>
            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200"
                style={{ width: `${Math.min(100, Math.round((progressZ / 350) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Toggles (Auto-Pilot, Infinite Planks, Auto-Loop, Pause) —— 轮80: 原不换行整组~560px在414视口右缘裁掉正前特写/3/4侧颜(r78帧实锤), 加wrap让镜头组落到第二行 */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
          {/* Auto-Pilot Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ autoPilot: !settings.autoPilot })}
            title="开启/关闭全关卡自动寻路巡航，解决过弯落水重复卡死问题"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              settings.autoPilot
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🤖</span>
            <span>自动巡航</span>
            <span className={`text-[9px] px-1 rounded ${settings.autoPilot ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-500'}`}>
              {settings.autoPilot ? '开' : '关'}
            </span>
          </button>

          {/* Infinite Planks Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ infinitePlanks: !settings.infinitePlanks })}
            title="无限木板开发不死模式，水面任意自由跨海测试"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              settings.infinitePlanks
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🛡️</span>
            <span>无限木板</span>
            <span className={`text-[9px] px-1 rounded ${settings.infinitePlanks ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-500'}`}>
              {settings.infinitePlanks ? '开' : '关'}
            </span>
          </button>

          {/* Auto Loop Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ autoLoop: !settings.autoLoop })}
            title="冲线或重试时自动开启下一轮，实现全天候无阻断巡跑"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              settings.autoLoop
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🔁</span>
            <span>自动循环</span>
          </button>

          {/* Sound Toggle（用户令 2026-09-24：默认关闭，工具条可开） */}
          <button
            onClick={() => onUpdateSettings?.({ soundEnabled: !settings.soundEnabled })}
            title="游戏音效开关（默认关闭）"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              settings.soundEnabled
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>{settings.soundEnabled ? '🔊' : '🔇'}</span>
            <span>音效</span>
            <span className={`text-[9px] px-1 rounded ${settings.soundEnabled ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-800 text-slate-500'}`}>
              {settings.soundEnabled ? '开' : '关'}
            </span>
          </button>

          {/* Pause / Play Toggle */}
          <button
            onClick={togglePaused}
            title="暂停/继续（按空格键），方便停格细致观察模型与姿态"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
              isPaused
                ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>{isPaused ? '▶️ 继续' : '⏸️ 暂停'}</span>
          </button>

          {/* Camera View Mode Selector (Chase / Front / Side) */}
          <div className="flex items-center gap-0.5 bg-slate-950/60 p-0.5 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setCameraView('chase')}
              title="默认跑酷后置跟踪视角"
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                cameraViewMode === 'chase'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              后视
            </button>
            <button
              onClick={() => setCameraView('front')}
              title="正前特写走查视角：细看五官、浓眉大眼双高光、如意卷云紧箍儿与交领战袍"
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                cameraViewMode === 'front'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              正前特写
            </button>
            <button
              onClick={() => setCameraView('side')}
              title="45° 黄金侧视走查：查看虎纹战裙、护腕双金箍、斜插如意金箍棒与飞扬大红披巾飘带"
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                cameraViewMode === 'side'
                  ? 'bg-orange-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3/4侧颜
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Real-Time Performance Waveform Floating Panel */}
      <PerformanceMonitor
        data={perfHistory}
        currentFps={liveFps}
        currentDrawCalls={liveDrawCalls}
        currentRenderMs={liveRenderMs}
      />

      {/* Bottom Section Quick Jump Bar (竖屏窄屏换行而非横滚: 秒传按钮须始终可见可点; 轮77: 窄屏默认折叠成徽标防遮挡画面; 轮89: 中挂底部会压住md带wrap后的顶带第3行(896x414实锤开关/镜头COVERED), 且桌面右上徽标是轮85默认常驻→底部整条让给秒传, 改挂左下) */}
      {jumpBarOpen ? (
      <div className="absolute bottom-3 left-3 max-sm:max-w-[calc(100%-9.5rem)] flex flex-wrap justify-start items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-2xl z-10">
        <button
          onClick={() => setJumpBarOpen(false)}
          className="text-[11px] font-bold text-slate-400 hover:text-amber-300 shrink-0 mr-1 flex items-center gap-1 cursor-pointer"
          title="折叠秒传条"
        >
          <span>📍</span>
          <span>路段秒传:</span>
          <span className="text-[10px] text-slate-500">▾</span>
        </button>
        {SECTION_SHORTCUTS.map((sec, idx) => (
          <button
            key={sec.z}
            onClick={() => resetGame(sec.z)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 active:bg-amber-500/30 text-slate-200 hover:text-amber-300 text-[11px] font-medium border border-slate-700/60 hover:border-amber-500/40 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
            title={`传送至 ${sec.name} (${sec.tag})，快捷键 ${idx + 1}`}
          >
            <span className="text-amber-400/80 font-mono text-[10px]">{idx + 1}.</span>
            <span>{sec.name}</span>
            <span className="text-[9px] text-slate-400 font-mono">[{sec.tag}]</span>
          </button>
        ))}
        <button
          onClick={() => resetGame(0)}
          className="ml-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 transition-all cursor-pointer whitespace-nowrap"
          title="按 R 键重置关卡"
        >
          🔄 从头跑 (R)
        </button>
      </div>
      ) : (
        <button
          onClick={() => setJumpBarOpen(true)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-2xl z-10 text-[11px] font-bold text-slate-300 hover:text-amber-300 cursor-pointer"
          title="展开路段秒传条"
        >
          <span>📍</span>
          <span>秒传</span>
          <span className="text-[10px] text-slate-500">▴</span>
        </button>
      )}

      {/* Non-intrusive Toast Banner when Auto-Loop is Active —— 轮84: 原top-16落在HUD顶带内, 改挂画布垂直中心; 轮96: 横屏896x414顶带wrap两行(镜头组第二行y195~214), top-1/2 toast{197~248}压住后视/正前特写(probe-r96 vsToast=true×2)→下移至间隙带top-[58%](横屏240~291避开214/330, 竖屏420高下244~295仍避开顶带222与右下徽标378) */}
      {settings.autoLoop && (gameState === 'drowned' || gameState === 'finished') && (
        <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 border border-slate-700/90 text-slate-100 text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 z-30 animate-bounce">
          <span>{gameState === 'finished' ? '🎉 冲线登顶！正在准备下一轮全景测试...' : '🌊 踩空落水！正在准备重新出发...'}</span>
          <button
            onClick={() => resetGame(0)}
            className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 cursor-pointer"
          >
            立即重试
          </button>
        </div>
      )}

      {/* Manual Full Modal when Auto-Loop is Disabled */}
      {!settings.autoLoop && (gameState === 'drowned' || gameState === 'finished') && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 text-2xl font-black ${
                gameState === 'finished'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {gameState === 'finished' ? '🏆' : '🌊'}
            </div>

            <h3 className="text-xl font-bold text-slate-100 mb-1">
              {gameState === 'finished' ? '成功通关冲线！' : '木板耗尽，踩空落水'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              {gameState === 'finished'
                ? `冲刺获得 ${finalMultiplier.toFixed(1)}x 结算倍率，得分结算加成！`
                : '开启上方【自动巡航】与【无限木板】可畅通测试全程，无需担心操作失误。'}
            </p>

            <button
              onClick={() => resetGame(0)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-transform cursor-pointer"
            >
              再次出发 (按 R 键重试)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
