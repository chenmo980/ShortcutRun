import React from 'react';
import {
  Palette,
  Sparkles,
  Waves,
  Volume2,
  VolumeX,
  Gauge,
  Cpu,
  Layers,
  FileCode2,
  ArrowRight,
  User,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { THEME_PALETTES } from '../data/themes';
import { ColorPalette, VisualSettings, GameMetrics, CharacterModelType } from '../types';

interface ArtStudioPanelProps {
  currentPalette: ColorPalette;
  settings: VisualSettings;
  metrics: GameMetrics;
  onSelectPalette: (palette: ColorPalette) => void;
  onUpdateSettings: (newSettings: Partial<VisualSettings>) => void;
  onOpenCocosModal: () => void;
}

const CHARACTER_STYLES: {
  id: CharacterModelType;
  name: string;
  tag: string;
  desc: string;
  icon: string;
}[] = [
  {
    id: 'runner_boy',
    name: '阳光活力跑者',
    tag: '推荐生动',
    desc: '动感运动背心、头带飘带、双关节跑姿与反光跑鞋',
    icon: '🏃',
  },
  {
    id: 'chibi_ninja',
    name: '疾风暗影忍者',
    tag: '极速身法',
    desc: '黑色连帽忍者服、红飘带护额、敏捷疾跑姿态',
    icon: '🥷',
  },
  {
    id: 'beach_dude',
    name: '夏日冲浪少年',
    tag: '海滩风尚',
    desc: '阳光金发、热带沙滩花裤、休闲墨镜风',
    icon: '🏄',
  },
  {
    id: 'voxel_bot',
    name: '赛博潮玩特工',
    tag: '科技机能',
    desc: '发光能量护目镜、赛博战术外骨骼关节',
    icon: '🤖',
  },
  {
    id: 'stickman',
    name: '极简糖豆人',
    tag: '经典超休闲',
    desc: 'VOODOO 纯色经典风，升级双关节踩地动画',
    icon: '🔴',
  },
];

export const ArtStudioPanel: React.FC<ArtStudioPanelProps> = ({
  currentPalette,
  settings,
  metrics,
  onSelectPalette,
  onUpdateSettings,
  onOpenCocosModal,
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-200 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">美术方案可视化调优</h2>
              <p className="text-[11px] text-slate-400">实时调整角色模型、视角与材质表现</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Anti-Occlusion Banner */}
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 leading-relaxed flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-emerald-300 block mb-0.5">人物遮挡已彻底解决</strong>
            木板堆叠已由身后改至<strong>跑者双臂向前抱举</strong>，配合智能仰角跟跑摄像机，奔跑双腿、运动背心与风中发带始终清晰无遮挡！
          </div>
        </div>

        {/* 1. Lively Character Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>生动人物模型风格</span>
            </label>
            <span className="text-[11px] text-amber-400 font-medium">即时切换</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {CHARACTER_STYLES.map((char) => {
              const isSelected = settings.characterType === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => onUpdateSettings({ characterType: char.id })}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{char.icon}</span>
                      <span className="text-xs font-bold text-slate-200">{char.name}</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {char.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{char.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Camera Viewpoint & Angle */}
        <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>摄像机观察视角 (不遮挡视线)</span>
            </label>
            <span className="text-xs font-mono font-bold text-cyan-400">{settings.cameraTilt}°</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {[
              { tilt: 55, label: '经典跟跑' },
              { tilt: 68, label: '开阔俯瞰' },
              { tilt: 42, label: '近身特写' },
            ].map((p) => (
              <button
                key={p.tilt}
                onClick={() => onUpdateSettings({ cameraTilt: p.tilt })}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-center ${
                  settings.cameraTilt === p.tilt
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={40}
            max={72}
            value={settings.cameraTilt}
            onChange={(e) => onUpdateSettings({ cameraTilt: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* 3. Theme Palette Selector */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🎨 配色调色板方案</span>
            </label>
            <span className="text-[11px] text-amber-400 font-medium">点击即可实时生效</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {THEME_PALETTES.map((p) => {
              const isSelected = p.id === currentPalette.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPalette(p)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-400 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {p.name}
                      {p.isGraybox && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-normal">
                          灰模基准
                        </span>
                      )}
                    </span>
                    {/* Color Swatch Dots */}
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: p.waterShallow }} />
                      <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: p.trackColor }} />
                      <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: p.plankColor }} />
                      <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: p.playerColor }} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Shader & Tactile Effects Toggle */}
        <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
            ✨ 质感与多巴胺反馈开关
          </label>

          <div className="space-y-2">
            {/* Water waves */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <Waves className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-slate-300 font-medium">水面正弦波浪位移</span>
              </div>
              <input
                type="checkbox"
                checked={settings.waterWaves}
                onChange={(e) => onUpdateSettings({ waterWaves: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Shadows */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-slate-300 font-medium">平面柔和光影 (Shadow)</span>
              </div>
              <input
                type="checkbox"
                checked={settings.planarShadows}
                onChange={(e) => onUpdateSettings({ planarShadows: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Tactile VFX */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-slate-300 font-medium">吃砖/铺路弹性微烟尘</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pickupVFX}
                onChange={(e) => onUpdateSettings({ pickupVFX: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {/* AI Opponent Runner */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-rose-400" />
                <div>
                  <span className="text-xs text-slate-300 font-medium block">AI 陪跑对手 (竞速演示)</span>
                  <span className="text-[10px] text-slate-500">关闭后仅显示单个主角模型</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showOpponent}
                onChange={(e) => onUpdateSettings({ showOpponent: e.target.checked })}
                className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
              />
            </div>

            {/* Sound Feedback */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                {settings.soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="text-xs text-slate-300 font-medium">连击递增音阶合成音</span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 5. Performance Monitor & WeChat Mini-Game Metric */}
        <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              微信小游戏性能体检
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
              60 FPS 稳定
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center mb-3">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">实时绘制批次</span>
              <span className="text-base font-bold font-mono text-cyan-400">{metrics.drawCalls} DC</span>
              <span className="text-[9px] text-slate-500 block">建议 ≤ 50 DC</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block">已铺木板数</span>
              <span className="text-base font-bold font-mono text-amber-400">{metrics.planksPlaced} 块</span>
              <span className="text-[9px] text-emerald-400 block">GPU Instancing</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
            <p className="flex items-start gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>包体预算预估</strong>：使用 Low-Poly + 调色板贴图方案，全套场景模型与纹理总计仅约 <strong>1.8MB</strong>（微信小游戏首包限额 4MB，毫无压力）。
              </span>
            </p>
          </div>
        </div>

        {/* 6. Action Button to Cocos Toolkit */}
        <button
          onClick={onOpenCocosModal}
          className="w-full py-3 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-between shadow-lg shadow-amber-500/15 cursor-pointer active:scale-98 transition-transform"
        >
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4" />
            <span>获取 Cocos 3.8 着色器与调色板资源</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
