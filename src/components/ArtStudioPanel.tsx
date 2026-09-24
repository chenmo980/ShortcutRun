import React, { useState, useSyncExternalStore } from 'react';
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
  Sliders,
  RotateCcw,
  Zap,
  Activity,
  Wind,
  Play,
  Hand,
  Move,
} from 'lucide-react';
import { THEME_PALETTES } from '../data/themes';
import { ColorPalette, VisualSettings, CharacterModelType, PhysicsFeelPreset } from '../types';
import { metricsStore } from '../utils/metricsStore';
import {
  CHINESE_AESTHETIC_PRESETS,
  generateMixamoFbxConfigJson,
  ChineseAestheticPreset,
} from '../data/chinesePresets';
import {
  VOODOO_PHYSICS_PRESETS,
  PhysicsPresetConfig,
  DEFAULT_PHYSICS_SETTINGS,
  IK_ANIMATION_PRESETS,
  IkPresetConfig,
  DEFAULT_IK_SETTINGS,
} from '../data/physicsPresets';

interface ArtStudioPanelProps {
  currentPalette: ColorPalette;
  settings: VisualSettings;
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
    name: '齐天小圣·原创国风',
    tag: '原画专属形象',
    desc: '暖栗棕刺猬短发、额前对称如意卷云紧箍儿、大红飞扬披肩领巾、黄战袍虎皮战裙、双金箍护腕、云头金靴与斜背如意金箍棒',
    icon: '🐒',
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

// 体检数字订阅叶子：metricsStore 1Hz 更新只重渲染这两张卡，不再拖 1600 行面板整段重渲染
const PerfMetricCards: React.FC = () => {
  const metrics = useSyncExternalStore(metricsStore.subscribe, metricsStore.get, metricsStore.get);
  return (
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
  );
};

const ArtStudioPanelInner: React.FC<ArtStudioPanelProps> = ({
  currentPalette,
  settings,
  onSelectPalette,
  onUpdateSettings,
  onOpenCocosModal,
}) => {
  const [copiedFbx, setCopiedFbx] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copiedPhysics, setCopiedPhysics] = useState<boolean>(false);
  const [showPhysicsFormula, setShowPhysicsFormula] = useState<boolean>(false);
  const [copiedIk, setCopiedIk] = useState<boolean>(false);
  const [showIkSpecs, setShowIkSpecs] = useState<boolean>(false);

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

  const handleApplyPhysicsPreset = (preset: PhysicsPresetConfig) => {
    onUpdateSettings({
      feelPreset: preset.id,
      trackFriction: preset.trackFriction,
      lateralDrift: preset.lateralDrift,
      waterDamping: preset.waterDamping,
      buoyancySpring: preset.buoyancySpring,
      collisionRestitution: preset.collisionRestitution,
      runSpeed: preset.runSpeed,
    });
  };

  const handleResetPhysics = () => {
    onUpdateSettings({
      ...DEFAULT_PHYSICS_SETTINGS,
    });
  };

  const generatePhysicsExportJson = () => {
    return JSON.stringify(
      {
        engine: 'Cocos Creator 3.8 / Unity / WebGL Physics',
        gameGenre: 'VOODOO Hypercasual Runner (Shortcut Run)',
        feelPreset: settings.feelPreset || 'custom',
        physicsParameters: {
          trackFriction: settings.trackFriction ?? DEFAULT_PHYSICS_SETTINGS.trackFriction,
          lateralDrift: settings.lateralDrift ?? DEFAULT_PHYSICS_SETTINGS.lateralDrift,
          waterDamping: settings.waterDamping ?? DEFAULT_PHYSICS_SETTINGS.waterDamping,
          buoyancySpring: settings.buoyancySpring ?? DEFAULT_PHYSICS_SETTINGS.buoyancySpring,
          collisionRestitution: settings.collisionRestitution ?? DEFAULT_PHYSICS_SETTINGS.collisionRestitution,
          runSpeed: settings.runSpeed ?? DEFAULT_PHYSICS_SETTINGS.runSpeed,
        },
        cocosPhysicsMaterial: {
          ground: {
            friction: settings.trackFriction ?? DEFAULT_PHYSICS_SETTINGS.trackFriction,
            restitution: settings.collisionRestitution ?? DEFAULT_PHYSICS_SETTINGS.collisionRestitution,
          },
          waterPlank: {
            friction: Number(((settings.trackFriction ?? 0.85) * 0.62).toFixed(2)),
            restitution: 0.1,
            linearDamping: settings.waterDamping ?? DEFAULT_PHYSICS_SETTINGS.waterDamping,
            buoyancyK: settings.buoyancySpring ?? DEFAULT_PHYSICS_SETTINGS.buoyancySpring,
          },
        },
      },
      null,
      2
    );
  };

  const handleCopyPhysicsJson = () => {
    navigator.clipboard.writeText(generatePhysicsExportJson());
    setCopiedPhysics(true);
    setTimeout(() => setCopiedPhysics(false), 2200);
  };

  const handleApplyIkPreset = (preset: IkPresetConfig) => {
    onUpdateSettings({
      pickupAmplitude: preset.pickupAmplitude,
      pickupDuration: preset.pickupDuration,
      holdingArmSpread: preset.holdingArmSpread,
      holdingArmHeight: preset.holdingArmHeight,
      holdingArmReach: preset.holdingArmReach,
      testPickupTrigger: Date.now(),
    });
  };

  const handleResetIk = () => {
    onUpdateSettings({
      ...DEFAULT_IK_SETTINGS,
      testPickupTrigger: Date.now(),
    });
  };

  const handleTriggerTestPickup = () => {
    onUpdateSettings({
      testPickupTrigger: Date.now(),
    });
  };

  const generateIkExportJson = () => {
    return JSON.stringify(
      {
        animationSystem: 'Cocos 3.8 Animation Graph / Unity Animation Rigging',
        characterPose: 'Pickup & Holding Arms IK Profile',
        pickupAnimation: {
          amplitudeScale: settings.pickupAmplitude ?? DEFAULT_IK_SETTINGS.pickupAmplitude,
          durationSeconds: settings.pickupDuration ?? DEFAULT_IK_SETTINGS.pickupDuration,
          rightArmSweepTrajectory: {
            wideSpreadZ: Number((-1.15 * (settings.pickupAmplitude ?? 1.0)).toFixed(2)),
            pitchForwardX: Number((1.42 * (settings.pickupAmplitude ?? 1.0)).toFixed(2)),
            armExtensionReach: Number((-0.2 * (2.0 - (settings.pickupAmplitude ?? 1.0) * 0.5)).toFixed(2)),
          },
        },
        holdingHandsIK: {
          spreadOffsetX: settings.holdingArmSpread ?? DEFAULT_IK_SETTINGS.holdingArmSpread,
          heightOffsetY: settings.holdingArmHeight ?? DEFAULT_IK_SETTINGS.holdingArmHeight,
          reachOffsetZ: settings.holdingArmReach ?? DEFAULT_IK_SETTINGS.holdingArmReach,
          plankBundleMountOffset: {
            x: 0,
            y: Number((0.58 + (settings.holdingArmHeight ?? 0) * 0.45).toFixed(3)),
            z: Number((0.62 + (settings.holdingArmReach ?? 0) * 0.45).toFixed(3)),
          },
        },
      },
      null,
      2
    );
  };

  const handleCopyIkJson = () => {
    navigator.clipboard.writeText(generateIkExportJson());
    setCopiedIk(true);
    setTimeout(() => setCopiedIk(false), 2200);
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

        {/* 1.6. 拾取动作与抱物手部 IK 调优 (Pickup Animation & Holding IK Tuning) */}
        <div className="rounded-2xl bg-gradient-to-b from-teal-950/40 via-slate-900/90 to-slate-950/90 border border-teal-500/30 p-3.5 shadow-xl shadow-teal-950/20 space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
                <Hand className="w-4 h-4 text-teal-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-teal-100 flex items-center gap-1.5">
                  <span>拾取动作与抱物手部 IK</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                    骨骼动态微调
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  捞拾动作幅度 (Amplitude)、时长与双手抱垛 IK 偏移
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleTriggerTestPickup}
                title="立即触发单次捞拾木板动作预览"
                className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 hover:text-white transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1 shadow-sm active:scale-95"
              >
                <Play className="w-3 h-3 text-teal-400 fill-teal-400" />
                <span>预览动作</span>
              </button>

              <button
                onClick={handleResetIk}
                title="一键恢复标准默认手部姿态与拾取参数"
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px] flex items-center"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Quick Presets Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Move className="w-3 h-3 text-teal-400" />
                <span>手部姿态与拾取预设</span>
              </span>
              <span className="text-[9px] text-teal-300/80 font-mono">
                幅度: {(settings.pickupAmplitude ?? DEFAULT_IK_SETTINGS.pickupAmplitude).toFixed(2)}x
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {IK_ANIMATION_PRESETS.map((preset) => {
                const isSelected =
                  Math.abs((settings.pickupAmplitude ?? DEFAULT_IK_SETTINGS.pickupAmplitude) - preset.pickupAmplitude) < 0.05 &&
                  Math.abs((settings.pickupDuration ?? DEFAULT_IK_SETTINGS.pickupDuration) - preset.pickupDuration) < 0.05 &&
                  Math.abs((settings.holdingArmSpread ?? 0) - preset.holdingArmSpread) < 0.03;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyIkPreset(preset)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-teal-900/60 to-teal-950/80 border-teal-400 shadow-md shadow-teal-500/20 text-white'
                        : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-teal-500/40 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold truncate">{preset.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] px-1 py-0.2 rounded border bg-teal-500/20 text-teal-300 border-teal-500/40">
                        {preset.tag}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {preset.pickupDuration}s
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Real-time Sliders */}
          <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
            {/* 1. Pickup Amplitude */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">💪</span>
                  <span className="text-[11px] font-bold text-slate-200">拾取动作幅度 (Pickup Amplitude)</span>
                </div>
                <span className="text-xs font-mono font-bold text-teal-400">
                  {(settings.pickupAmplitude ?? DEFAULT_IK_SETTINGS.pickupAmplitude).toFixed(2)}x
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                控制探手下捞时手臂向外展开的宽度、向前下探深度以及躯干侧探微倾幅度
              </p>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.05}
                value={settings.pickupAmplitude ?? DEFAULT_IK_SETTINGS.pickupAmplitude}
                onChange={(e) =>
                  onUpdateSettings({
                    pickupAmplitude: parseFloat(e.target.value),
                    testPickupTrigger: Date.now(),
                  })
                }
                className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.40x 克制微捞</span>
                <span className="text-teal-400/80">1.00x 标准舒展</span>
                <span>2.00x 极限大甩弧</span>
              </div>
            </div>

            {/* 2. Pickup Duration */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">⏱️</span>
                  <span className="text-[11px] font-bold text-slate-200">拾取动画时长 (Pickup Duration)</span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {(settings.pickupDuration ?? DEFAULT_IK_SETTINGS.pickupDuration).toFixed(2)}s
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                控制拾取动作从展开、下捞到复位的时长。短时干脆利落，长时展示戏剧性捞拾轨迹
              </p>
              <input
                type="range"
                min={0.15}
                max={1.0}
                step={0.01}
                value={settings.pickupDuration ?? DEFAULT_IK_SETTINGS.pickupDuration}
                onChange={(e) =>
                  onUpdateSettings({
                    pickupDuration: parseFloat(e.target.value),
                    testPickupTrigger: Date.now(),
                  })
                }
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.15s 闪电点捞</span>
                <span className="text-amber-400/80">0.45s 经典节奏</span>
                <span>1.00s 夸张慢镜</span>
              </div>
            </div>

            {/* 3. Holding Arm Spread (IK X) */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">↔️</span>
                  <span className="text-[11px] font-bold text-slate-200">抱持手部横向间距 (Arm Spread, IK X)</span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {(settings.holdingArmSpread ?? DEFAULT_IK_SETTINGS.holdingArmSpread) >= 0 ? '+' : ''}
                  {(settings.holdingArmSpread ?? DEFAULT_IK_SETTINGS.holdingArmSpread).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                控制双手抱住物品时的左右合抱间距。负值紧扣内贴，正值双臂外展豪迈
              </p>
              <input
                type="range"
                min={-0.2}
                max={0.25}
                step={0.01}
                value={settings.holdingArmSpread ?? DEFAULT_IK_SETTINGS.holdingArmSpread}
                onChange={(e) =>
                  onUpdateSettings({
                    holdingArmSpread: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>-0.20 紧贴胸口</span>
                <span className="text-cyan-400/80">0.00 标准抱合</span>
                <span>+0.25 宽大展开</span>
              </div>
            </div>

            {/* 4. Holding Arm Height (IK Y) */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">↕️</span>
                  <span className="text-[11px] font-bold text-slate-200">抱持手部托举高度 (Arm Height, IK Y)</span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {(settings.holdingArmHeight ?? DEFAULT_IK_SETTINGS.holdingArmHeight) >= 0 ? '+' : ''}
                  {(settings.holdingArmHeight ?? DEFAULT_IK_SETTINGS.holdingArmHeight).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                调节双手托底掌心与木板垛底部的垂直高度（同时联动木板挂载点贴合无缝）
              </p>
              <input
                type="range"
                min={-0.2}
                max={0.25}
                step={0.01}
                value={settings.holdingArmHeight ?? DEFAULT_IK_SETTINGS.holdingArmHeight}
                onChange={(e) =>
                  onUpdateSettings({
                    holdingArmHeight: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>-0.20 沉腹托举</span>
                <span className="text-emerald-400/80">0.00 齐胸环抱</span>
                <span>+0.25 高位护胸</span>
              </div>
            </div>

            {/* 5. Holding Arm Reach (IK Z) */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">↗️</span>
                  <span className="text-[11px] font-bold text-slate-200">抱持手部纵深前伸 (Arm Reach, IK Z)</span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {(settings.holdingArmReach ?? DEFAULT_IK_SETTINGS.holdingArmReach) >= 0 ? '+' : ''}
                  {(settings.holdingArmReach ?? DEFAULT_IK_SETTINGS.holdingArmReach).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                调节手肘与手掌向前伸出的纵深距离（同步智能同步木板堆叠的前后距离）
              </p>
              <input
                type="range"
                min={-0.15}
                max={0.25}
                step={0.01}
                value={settings.holdingArmReach ?? DEFAULT_IK_SETTINGS.holdingArmReach}
                onChange={(e) =>
                  onUpdateSettings({
                    holdingArmReach: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>-0.15 紧贴衣襟</span>
                <span className="text-purple-400/80">0.00 适距前推</span>
                <span>+0.25 远距端抱</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            <button
              onClick={handleCopyIkJson}
              className="flex-1 py-1.5 px-2 rounded-lg bg-teal-950/60 hover:bg-teal-900/60 border border-teal-500/40 text-teal-200 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedIk ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">已复制手部 IK 骨骼配置 JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-teal-400" />
                  <span>复制 Cocos/Unity 手部 IK 配置</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowIkSpecs(!showIkSpecs)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{showIkSpecs ? '收起' : 'IK解算'}</span>
              {showIkSpecs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Collapsible IK solver specs */}
          {showIkSpecs && (
            <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 text-[9px] font-mono text-teal-300/90 space-y-1.5">
              <div className="text-slate-400 font-bold border-b border-slate-800 pb-1">
                🦴 手部 IK 动力学解算机制（Inverse Kinematics Solver）：
              </div>
              <p className="text-slate-300">
                1. 捞拾广角解算：<span className="text-amber-300">R_z = lerp(-0.22, -1.15 · amp, reach)</span> (向右大幅甩出划弧)
              </p>
              <p className="text-slate-300">
                2. 俯身拾取下探：<span className="text-teal-300">R_x = lerp(0.48, 1.42 · amp, reach)</span> (前倾下潜捞地)
              </p>
              <p className="text-slate-300">
                3. 手托挂载点同步：<span className="text-emerald-300">P_mount = (0, 0.58 + Y_ik · 0.45, 0.62 + Z_ik · 0.45)</span> (无缝贴合)
              </p>
              <p className="text-slate-300">
                4. 双肘合抱闭环：<span className="text-purple-300">LeftArm.R_z = 0.38 - X_ik · 0.85, RightArm.R_z = -0.22 + X_ik · 0.85</span>
              </p>
            </div>
          )}
        </div>

        {/* 1.8. 材质摩擦力与碰撞模拟 (VOODOO 核心手感调优专区) */}
        <div className="rounded-2xl bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-950/90 border border-indigo-500/30 p-3.5 shadow-xl shadow-indigo-950/20 space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                <Sliders className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-indigo-100 flex items-center gap-1.5">
                  <span>材质摩擦力与碰撞模拟</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                    VOODOO 手感调优
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  物理摩擦系数、转向惯性与木板水面漂浮阻尼精准微调
                </p>
              </div>
            </div>

            <button
              onClick={handleResetPhysics}
              title="一键恢复 VOODOO 原厂标杆物理参数"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px] flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">复位</span>
            </button>
          </div>

          {/* Quick Presets Grid (4 VOODOO Core Feel Presets) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>手感调优预设 (点击即时生效)</span>
              </span>
              <span className="text-[9px] text-indigo-300/80 font-mono">
                当前: {VOODOO_PHYSICS_PRESETS.find((p) => p.id === settings.feelPreset)?.name.split(' ')[0] || '自定义'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {VOODOO_PHYSICS_PRESETS.map((preset) => {
                const isSelected = settings.feelPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPhysicsPreset(preset)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-indigo-900/60 to-indigo-950/80 border-indigo-400 shadow-md shadow-indigo-500/20 text-white'
                        : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold truncate">{preset.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[8.5px] px-1 py-0.2 rounded border ${preset.badgeColor}`}>
                        {preset.tag}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {preset.runSpeed}m/s
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Preset VOODOO Tactile Secret Note */}
            {(() => {
              const activePreset = VOODOO_PHYSICS_PRESETS.find((p) => p.id === settings.feelPreset);
              if (!activePreset) return null;
              return (
                <div className="mt-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/25 text-[10px] text-indigo-200/90 leading-relaxed">
                  <span className="font-semibold text-amber-300 block mb-0.5">🎮 VOODOO 手感设计秘诀：</span>
                  {activePreset.voodooNote}
                </div>
              );
            })()}
          </div>

          {/* Detailed Real-time Physics Sliders */}
          <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
            {/* 1. Track Ground Friction */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🛣️</span>
                  <span className="text-[11px] font-bold text-slate-200">跑道地面摩擦系数 (Track Friction)</span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {(settings.trackFriction ?? 0.85).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                直接决定玩家左右轻扫变向时的<strong>地面抓地力与刹车咬合度</strong>（VOODOO 特征：高抓地不拖沓）
              </p>
              <input
                type="range"
                min={0.2}
                max={1.0}
                step={0.01}
                value={settings.trackFriction ?? 0.85}
                onChange={(e) =>
                  onUpdateSettings({
                    trackFriction: parseFloat(e.target.value),
                    feelPreset: 'custom',
                  })
                }
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.20 湿滑冰面</span>
                <span className="text-amber-400/80">0.85 官方黄金值</span>
                <span>1.00 极度咬合</span>
              </div>
            </div>

            {/* 2. Lateral Drift Inertia */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">💨</span>
                  <span className="text-[11px] font-bold text-slate-200">转向侧滑惯性系数 (Lateral Drift)</span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {(settings.lateralDrift ?? 0.20).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                大幅度甩盘与连续弯道时的<strong>侧向推背惯性保持</strong>，控制漂移弧度与超休闲推背感
              </p>
              <input
                type="range"
                min={0.0}
                max={0.8}
                step={0.01}
                value={settings.lateralDrift ?? 0.20}
                onChange={(e) =>
                  onUpdateSettings({
                    lateralDrift: parseFloat(e.target.value),
                    feelPreset: 'custom',
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.00 瞬间静止</span>
                <span className="text-cyan-400/80">0.20 适度侧倾</span>
                <span>0.80 极速漂移</span>
              </div>
            </div>

            {/* 3. Plank Floating Damping (木板水面漂浮阻尼) */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🌊</span>
                  <span className="text-[11px] font-bold text-slate-200">木板水面漂浮阻尼 (Water Damping)</span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {(settings.waterDamping ?? 0.75).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                木板落入水面时的<strong>流体阻尼系数</strong>：数值越高落水吸附越快越扎实，数值低则持续随浪浮动
              </p>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.01}
                value={settings.waterDamping ?? 0.75}
                onChange={(e) =>
                  onUpdateSettings({
                    waterDamping: parseFloat(e.target.value),
                    feelPreset: 'custom',
                  })
                }
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.10 涟漪激荡</span>
                <span className="text-emerald-400/80">0.75 快速吸附</span>
                <span>0.95 临界强阻尼</span>
              </div>
            </div>

            {/* 4. Buoyancy Spring Stiffness (木板浮力回弹刚度) */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🪵</span>
                  <span className="text-[11px] font-bold text-slate-200">木板浮力回弹刚度 (Buoyancy Spring)</span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {(settings.buoyancySpring ?? 1.20).toFixed(2)} k
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                铺桥踩踏木板瞬间的<strong>下沉回弹弹簧刚度</strong>，营造肉眼可见的木板下沉吸附与回浮微动
              </p>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.05}
                value={settings.buoyancySpring ?? 1.20}
                onChange={(e) =>
                  onUpdateSettings({
                    buoyancySpring: parseFloat(e.target.value),
                    feelPreset: 'custom',
                  })
                }
                className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.40 绵软微浮</span>
                <span className="text-purple-400/80">1.20 扎实有力</span>
                <span>2.00 高频Q弹</span>
              </div>
            </div>

            {/* 5. Collision Restitution (碰撞/边缘反弹) */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🛡️</span>
                  <span className="text-[11px] font-bold text-slate-200">边界碰撞弹性系数 (Collision Restitution)</span>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {(settings.collisionRestitution ?? 0.18).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                跑者蹭碰跑道边缘围栏时的<strong>反弹吸收系数</strong>（低反弹防镜头眩晕，高反弹具备街机撞墙反馈）
              </p>
              <input
                type="range"
                min={0.0}
                max={0.8}
                step={0.02}
                value={settings.collisionRestitution ?? 0.18}
                onChange={(e) =>
                  onUpdateSettings({
                    collisionRestitution: parseFloat(e.target.value),
                    feelPreset: 'custom',
                  })
                }
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>0.00 完全吸收</span>
                <span className="text-rose-400/80">0.18 VOODOO黄金值</span>
                <span>0.80 弹力球反冲</span>
              </div>
            </div>

            {/* 6. Cruising Speed */}
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">⚡</span>
                  <span className="text-[11px] font-bold text-slate-200">跑酷基准巡航速度 (Cruising Speed)</span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {(settings.runSpeed ?? 18).toFixed(1)} m/s
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-1.5">
                角色奔跑的前进基准初速度（跨入水面近道铺桥时自动享受 +8% 滑行冲刺推力）
              </p>
              <input
                type="range"
                min={12}
                max={26}
                step={0.5}
                value={settings.runSpeed ?? 18}
                onChange={(e) =>
                  onUpdateSettings({
                    runSpeed: parseFloat(e.target.value),
                    feelPreset: 'custom',
                  })
                }
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
                <span>12.0 舒适休闲</span>
                <span className="text-emerald-400/80">18.0 官方巡航</span>
                <span>26.0 极速冲刺</span>
              </div>
            </div>
          </div>

          {/* Action Row: Export Physics Material JSON / View Formulas */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            <button
              onClick={handleCopyPhysicsJson}
              className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-indigo-200 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedPhysics ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">已复制物理材质参数 JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  <span>复制 Cocos/Unity 物理材质配置</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowPhysicsFormula(!showPhysicsFormula)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{showPhysicsFormula ? '收起' : '公式'}</span>
              {showPhysicsFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Collapsible Math / Engine Specs */}
          {showPhysicsFormula && (
            <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 text-[9px] font-mono text-indigo-300/90 space-y-1.5">
              <div className="text-slate-400 font-bold border-b border-slate-800 pb-1">
                📐 物理引擎动力学方程（实时计算）：
              </div>
              <p className="text-slate-300">
                1. 转向动力学：<span className="text-amber-300">v_x = (x_target - x) · (10 + μ_track · 15)</span>
              </p>
              <p className="text-slate-300">
                2. 惯性混合：<span className="text-cyan-300">dv_x = (v_target - v_x) · 24 · (1 - k_drift · 0.68) · dt</span>
              </p>
              <p className="text-slate-300">
                3. 木板浮力阻尼：<span className="text-emerald-300">F_buoyant = (y_water - y) · k_spring - v_y · (γ_damp · 16 + 3.8)</span>
              </p>
              <p className="text-slate-300">
                4. 碰撞冲量恢复：<span className="text-rose-300">v_x' = -v_x · e_restitution (道沿碰撞)</span>
              </p>
            </div>
          )}
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

            {/* Auto-Pilot Continuous Tour */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
              <div className="flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <span className="text-xs text-emerald-300 font-medium block">全关卡自动巡航测试</span>
                  <span className="text-[10px] text-emerald-500/80">自动循道过弯、自动吃板、流畅跑完全程</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPilot}
                onChange={(e) => onUpdateSettings({ autoPilot: e.target.checked })}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Infinite Planks God Mode */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-950/20 border border-amber-800/40">
              <div className="flex items-center gap-2">
                <Box className="w-3.5 h-3.5 text-amber-400" />
                <div>
                  <span className="text-xs text-amber-300 font-medium block">无限木板 (开发不死模式)</span>
                  <span className="text-[10px] text-amber-500/80">木板不枯竭，避免反复卡死落水中断</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.infinitePlanks}
                onChange={(e) => onUpdateSettings({ infinitePlanks: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Auto Loop */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/20 border border-cyan-800/40">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <div>
                  <span className="text-xs text-cyan-300 font-medium block">冲刺终点自动循环</span>
                  <span className="text-[10px] text-cyan-500/80">冲线后自动进入下一轮测试</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoLoop}
                onChange={(e) => onUpdateSettings({ autoLoop: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
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

          <PerfMetricCards />

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

export const ArtStudioPanel = React.memo(ArtStudioPanelInner);
