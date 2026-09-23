import React from 'react';
import { Gamepad2, Sparkles, ExternalLink, RefreshCw, FileCode2 } from 'lucide-react';
import { ColorPalette } from '../types';

interface HeaderProps {
  currentPalette: ColorPalette;
  onOpenCocosModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPalette,
  onOpenCocosModal,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
          <Gamepad2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold text-slate-100 tracking-tight">
              Shortcut Run 3D
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
              Cocos 3.8 美术验证台
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            微信小游戏低模换皮 • 调色板映射 • 卡通水面 Shader 调参工作台
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Current Theme Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentPalette.plankColor }} />
          <span className="text-slate-400 font-medium">当前视觉：</span>
          <span className="text-slate-200 font-bold">{currentPalette.name}</span>
        </div>

        <button
          onClick={onOpenCocosModal}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-colors cursor-pointer"
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Cocos 资源导出</span>
        </button>

        <a
          href="https://github.com/chenmo980/ShortcutRun"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">原工程 Repo</span>
        </a>
      </div>
    </header>
  );
};
