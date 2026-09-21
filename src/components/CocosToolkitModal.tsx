import React, { useState, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileCode2,
  Sparkles,
  Bot,
  Layers,
  Palette,
} from 'lucide-react';
import {
  COCOS_WATER_SHADER_CODE,
  MIXAMO_GUIDE,
  AI_PROMPTS,
} from '../data/themes';
import { ColorPalette } from '../types';

interface CocosToolkitModalProps {
  palette: ColorPalette;
  isOpen: boolean;
  onClose: () => void;
}

export const CocosToolkitModal: React.FC<CocosToolkitModalProps> = ({
  palette,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'shader' | 'palette_texture' | 'mixamo' | 'ai_prompts'>('shader');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate and download Palette PNG
  const downloadPaletteTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = [
      palette.waterDeep,
      palette.waterShallow,
      palette.waterFoam,
      palette.trackColor,
      palette.trackBorder,
      palette.plankColor,
      palette.playerColor,
      palette.accentColor,
      palette.finishColor,
      '#FFD166',
      '#06D6A0',
      '#EF476F',
      '#118AB2',
      '#073B4C',
      palette.skyTop,
      palette.skyBottom,
    ];

    const blockSize = 64; // 4x4 grid of 64px blocks = 256x256
    colors.forEach((col, idx) => {
      const row = Math.floor(idx / 4);
      const colIdx = idx % 4;
      ctx.fillStyle = col;
      ctx.fillRect(colIdx * blockSize, row * blockSize, blockSize, blockSize);
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `palette_${palette.id}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Cocos Creator 3.8 资源与着色器工具箱</h3>
              <p className="text-[11px] text-slate-400">专为微信小游戏轻量化运行优化的代码与工程方案</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-800 px-4 bg-slate-950/20 gap-2">
          <button
            onClick={() => setActiveTab('shader')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'shader'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>水面着色器 (Shader)</span>
          </button>

          <button
            onClick={() => setActiveTab('palette_texture')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'palette_texture'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>调色板贴图导出</span>
          </button>

          <button
            onClick={() => setActiveTab('mixamo')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'mixamo'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Mixamo 动作对照</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_prompts')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ai_prompts'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 角色与 UI 提示词</span>
          </button>
        </div>

        {/* Tab content area */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* TAB 1: Cocos 3.8 Shader */}
          {activeTab === 'shader' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">water-toon.effect (Cocos 3.8.x)</h4>
                  <p className="text-[11px] text-slate-400">
                    在 Cocos 的 <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded">assets/</code> 目录下新建 Effect 文件并粘贴以下代码：
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(COCOS_WATER_SHADER_CODE, 'shader')}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer border border-slate-700"
                >
                  {copiedKey === 'shader' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>复制源码</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-3 bg-slate-950 text-slate-300 rounded-xl text-xs font-mono overflow-x-auto max-h-[380px] border border-slate-800/80 leading-relaxed">
                  {COCOS_WATER_SHADER_CODE}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: Palette Texture */}
          {activeTab === 'palette_texture' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-200">当前风格色彩调色板贴图 (256x256 PNG)</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  低模（Low-Poly）的核心在于：所有模型公用单张调色板贴图。在 Blender 或 Cocos 中将模型面 UV 映射在色块上，即可实现无缝贴图、DrawCall 从上百次骤降为 1 次！
                </p>
              </div>

              <div className="flex items-center gap-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="w-32 h-32 rounded-lg border border-slate-700 overflow-hidden shadow-inner flex flex-wrap">
                  {[
                    palette.waterDeep,
                    palette.waterShallow,
                    palette.waterFoam,
                    palette.trackColor,
                    palette.trackBorder,
                    palette.plankColor,
                    palette.playerColor,
                    palette.accentColor,
                    palette.finishColor,
                    '#FFD166',
                    '#06D6A0',
                    '#EF476F',
                    '#118AB2',
                    '#073B4C',
                    palette.skyTop,
                    palette.skyBottom,
                  ].map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 flex items-center justify-center text-[8px] text-black/50 font-bold"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="text-xs font-medium text-slate-300">
                    当前主题：<span className="text-amber-400 font-bold">{palette.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    分辨率：256×256 像素 | 格式：PNG | 占用包体：仅 4KB
                  </p>
                  <button
                    onClick={downloadPaletteTexture}
                    className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>下载当前调色板贴图 (.png)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Mixamo */}
          {activeTab === 'mixamo' && (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Mixamo 免商用动作标准清单</h4>
                <p className="text-[11px] text-slate-400">
                  访问 mixamo.com，上传任意 T-Pose 角色低模，搜索并下载以下对应动作（FBX for Unity / Cocos）：
                </p>
              </div>

              <div className="space-y-2">
                {MIXAMO_GUIDE.map((g, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-200">{g.action}</span>
                      <code className="text-amber-400 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {g.mixamoName}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-400">{g.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AI Prompts */}
          {activeTab === 'ai_prompts' && (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">生成式 AI 角色与小游戏封面提示词</h4>
                <p className="text-[11px] text-slate-400">
                  复制以下经过微调的专属 Prompt，可直接在 Meshy / Tripo3D / Midjourney 生成契合风格的资产：
                </p>
              </div>

              <div className="space-y-3">
                {AI_PROMPTS.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-amber-400">{p.tool}</span>
                      <button
                        onClick={() => copyToClipboard(p.prompt, `prompt_${idx}`)}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {copiedKey === `prompt_${idx}` ? (
                          <span className="text-emerald-400">已复制</span>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>复制 Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800/80 leading-relaxed">
                      {p.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
