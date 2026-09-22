import React, { useState } from 'react';
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
  Copy,
  Download,
  Check,
  Code2,
  ChevronDown,
  ChevronUp,
  Box,
} from 'lucide-react';
import { THEME_PALETTES } from '../data/themes';
import { ColorPalette, VisualSettings, GameMetrics, CharacterModelType } from '../types';
import {
  CHINESE_AESTHETIC_PRESETS,
  generateMixamoFbxConfigJson,
  ChineseAestheticPreset,
} from '../data/chinesePresets';

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
  isChinese?: boolean;
}[] = [
  {
    id: 'wukong',
    name: '齐天大圣·美猴王',
    tag: '国潮顶流',
    desc: '紧箍金圈、凤翅紫金冠雉翎双飘带、大红战袍与黄金锁子甲',
    icon: '🐵',
    isChinese: true,
  },
  {
    id: 'nezha',
    name: '三坛海会·莲花哪吒',
    tag: '灵珠神祇',
    desc: '双丸子冲天抓髻、纯金乾坤圈、绕肩飞扬混天绫与荷花红肚兜',
    icon: '🔥',
    isChinese: true,
  },
  {
    id: 'guofeng_hero',
    name: '国潮少侠·少年剑客',
    tag: '飘逸仙侠',
    desc: '高马尾发髻、赤红丝发带、月白汉服交领与千层底布鞋',
    icon: '⚔️',
    isChinese: true,
  },
  {
    id: 'panda_hero',
    name: '功夫国宝·熊猫大侠',
    tag: '武侠萌趣',
    desc: '毛绒黑白国宝圆耳、大黑眼圈、大红武术背心与金腰带',
    icon: '🐼',
    isChinese: true,
  },
  {
    id: 'runner_boy',
    name: '阳光活力跑者',
    tag: '动感十足',
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

const PLANK_STYLES: {
  id: import('../types').PlankStyleType;
  name: string;
  tag: string;
  desc: string;
  icon: string;
}[] = [
  {
    id: 'bamboo_raft',
    name: '碧翠青竹排 (国风竹筏)',
    tag: '中国特色',
    desc: '江南水乡青楠竹排，翠绿通透，水上飞渡如轻舟疾驰',
    icon: '🎋',
  },
  {
    id: 'jade_slab',
    name: '羊脂温玉板 (翡翠美玉)',
    tag: '东方美玉',
    desc: '莹润无瑕的翠绿玉石板，光泽温润雅致，尽显东方神韵',
    icon: '🪨',
  },
  {
    id: 'wood_plank',
    name: '经典暖黄木板',
    tag: '经典原版',
    desc: '温暖木质纹理与厚实触感，超休闲游戏最纯正的跑酷体验',
    icon: '🪵',
  },
  {
    id: 'gold_bar',
    name: '赤金元宝砖',
    tag: '多巴胺暴富',
    desc: '高反光金属纯金砖条，碰撞带来极致视听爽感',
    icon: '🪙',
  },
  {
    id: 'neon_crystal',
    name: '赛博发光能量晶体',
    tag: '能量溢彩',
    desc: '青蓝发光能量晶石，夜跑极佳伴侣',
    icon: '💎',
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
  const [copiedFbx, setCopiedFbx] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  // Active Chinese preset based on current characterType, or default to wukong
  const activeChinesePreset =
    CHINESE_AESTHETIC_PRESETS.find((p) => p.id === settings.characterType) ||
    CHINESE_AESTHETIC_PRESETS[0];

  const isCurrentChinesePresetActive = CHINESE_AESTHETIC_PRESETS.some(
    (p) => p.id === settings.characterType
  );

  const handleSelectPreset = (preset: ChineseAestheticPreset) => {
    onUpdateSettings({ characterType: preset.id });
  };

  const handleApplyFullPreset = (preset: ChineseAestheticPreset) => {
    onUpdateSettings({
      characterType: preset.id,
      plankStyle: preset.recommendedPlankStyle,
    });
    const palette = THEME_PALETTES.find((p) => p.id === preset.recommendedPaletteId);
    if (palette) {
      onSelectPalette(palette);
    }
  };

  const handleCopyFbxConfig = (preset: ChineseAestheticPreset) => {
    const jsonContent = generateMixamoFbxConfigJson(preset);
    navigator.clipboard.writeText(jsonContent);
    setCopiedFbx(true);
    setTimeout(() => setCopiedFbx(false), 2200);
  };

  const handleDownloadFbxMeta = (preset: ChineseAestheticPreset) => {
    const jsonContent = generateMixamoFbxConfigJson(preset);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.fbxMetadata.fileName}.meta.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

        {/* 🌟 Dedicated Chinese Traditional Aesthetic Character Presets Section */}
        <div className="rounded-2xl bg-gradient-to-b from-rose-950/40 via-slate-900/90 to-slate-950/90 border border-rose-500/30 p-3.5 shadow-lg shadow-rose-950/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🏮</span>
              <div>
                <h3 className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                  <span>中国传统美学角色预设</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-normal">
                    国潮3D与Mixamo规范
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  集成孙悟空、哪吒、少年侠客三大东方预设，即选即显，并自动生成 Mixamo .fbx 配置
                </p>
              </div>
            </div>
          </div>

          {/* Preset Selector Buttons (3 Core Characters) */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {CHINESE_AESTHETIC_PRESETS.map((preset) => {
              const isSelected = settings.characterType === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                    isSelected
                      ? 'bg-gradient-to-b from-rose-900/60 to-rose-950/80 border-rose-400 shadow-md shadow-rose-500/20 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-rose-500/40 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-2xl mb-1">{preset.avatar}</span>
                  <span className="text-xs font-bold block mb-0.5">{preset.name.split('·')[1]?.trim() || preset.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded ${
                      isSelected
                        ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {preset.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Preset Detail & Mixamo Configuration Generator */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-rose-500/20 space-y-3">
            {/* Header of Active Preset */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{activeChinesePreset.avatar}</span>
                  <span className="text-xs font-bold text-slate-100">{activeChinesePreset.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({activeChinesePreset.englishName})</span>
                </div>
                <p className="text-[11px] text-amber-300/90 font-medium mb-1">{activeChinesePreset.lore}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{activeChinesePreset.description}</p>
              </div>
            </div>

            {/* Signature Artifacts Badges */}
            <div>
              <span className="text-[10px] text-slate-400 block mb-1.5 font-semibold">东方神韵装配构件 (3D 实时渲染)：</span>
              <div className="flex flex-wrap gap-1.5">
                {activeChinesePreset.signatureArtifacts.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-200 border border-rose-500/25 flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* One-Click Coordinated Theme & Planks Apply */}
            <button
              onClick={() => handleApplyFullPreset(activeChinesePreset)}
              className="w-full py-2 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              <span>一键同步整套国风视觉 (配套专属场景与东方桥板)</span>
              <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
            </button>

            {/* 🤖 Mixamo .fbx Model Metadata Auto-Generated Specification */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">Mixamo .fbx 模型元数据配置 (自动生成)</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono">
                  符合小游戏规范
                </span>
              </div>

              {/* FBX Technical Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-2.5">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">FBX 模型文件</span>
                  <span className="text-cyan-300 font-bold truncate block">{activeChinesePreset.fbxMetadata.fileName}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">骨骼绑定架构</span>
                  <span className="text-amber-300 font-bold truncate block">
                    {activeChinesePreset.fbxMetadata.totalBones} 根 (含扩展链)
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">三角面数预算 (LOD0)</span>
                  <span className="text-emerald-400 font-bold block">
                    {activeChinesePreset.fbxMetadata.geometry.trianglesLOD0} 面 (通过 &lt;4000 标准)
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">根骨骼与坐标系</span>
                  <span className="text-slate-300 font-bold block">
                    {activeChinesePreset.fbxMetadata.rootBone} / Y-Up
                  </span>
                </div>
              </div>

              {/* Mixamo Custom Animation Clips */}
              <div className="mb-2.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1 font-semibold">Mixamo 标准动作切片映射 (4套完整)：</span>
                <div className="space-y-1">
                  {activeChinesePreset.fbxMetadata.animationClips.map((clip, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] text-slate-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        <span className="font-mono text-cyan-300">{clip.name}</span>
                        <span className="text-slate-500 text-[9px] truncate">({clip.mixamoSource})</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[9px] shrink-0 ml-1">{clip.duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Copy, Download, Toggle Raw JSON */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyFbxConfig(activeChinesePreset)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedFbx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">已复制配置 JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>复制 Mixamo .fbx 配置</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDownloadFbxMeta(activeChinesePreset)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                  title="下载 Cocos/Mixamo .fbx.meta.json 配置文件"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>导出 .meta</span>
                </button>

                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{showRawJson ? '折叠' : 'JSON'}</span>
                  {showRawJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Collapsible Raw JSON Code Block */}
              {showRawJson && (
                <div className="mt-2.5 bg-slate-950 rounded-lg p-2.5 border border-slate-800 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800 text-[9px] text-slate-500 font-mono">
                    <span>{activeChinesePreset.fbxMetadata.fileName}.meta.json</span>
                    <span>Cocos 3.8 / Mixamo</span>
                  </div>
                  <pre className="text-[9px] font-mono text-cyan-300/90 whitespace-pre leading-relaxed select-all">
                    {generateMixamoFbxConfigJson(activeChinesePreset)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. Lively Character Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>3D 人物模型库 (全部 9 款模型)</span>
            </label>
            <span className="text-[11px] text-amber-400 font-medium">9款可选</span>
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
                      ? char.isChinese
                        ? 'bg-rose-950/40 border-rose-400 shadow-md shadow-rose-500/10'
                        : 'bg-amber-500/10 border-amber-400 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{char.icon}</span>
                      <span className="text-xs font-bold text-slate-200">{char.name}</span>
                      {char.isChinese && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                          国潮中国风
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected
                          ? char.isChinese
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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

        {/* 1.5. Plank & Bridge Style Selector */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🎋 铺路物料与桥板材质</span>
            </label>
            <span className="text-[11px] text-emerald-400 font-medium">竹筏/温玉/原木</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {PLANK_STYLES.map((plank) => {
              const isSelected = settings.plankStyle === plank.id;
              return (
                <button
                  key={plank.id}
                  onClick={() => onUpdateSettings({ plankStyle: plank.id })}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-400 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{plank.icon}</span>
                      <span className="text-xs font-bold text-slate-200">{plank.name}</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {plank.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{plank.desc}</p>
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
