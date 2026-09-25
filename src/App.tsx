import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { GameCanvas } from './components/GameCanvas';
import { ArtStudioPanel } from './components/ArtStudioPanel';
import { CocosToolkitModal } from './components/CocosToolkitModal';
import { THEME_PALETTES } from './data/themes';
import { ColorPalette, VisualSettings } from './types';
import { DEFAULT_PHYSICS_SETTINGS, DEFAULT_IK_SETTINGS } from './data/physicsPresets';

export default function App() {
  const [currentPalette, setCurrentPalette] = useState<ColorPalette>(THEME_PALETTES[0]);
  const [isCocosModalOpen, setIsCocosModalOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<VisualSettings>({
    paletteId: THEME_PALETTES[0].id,
    characterType: 'wukong',
    plankStyle: 'bamboo_raft',
    waterWaves: true,
    waterFoam: true,
    planarShadows: true,
    pickupVFX: true,
    soundEnabled: false, // 用户令 2026-09-24：默认关闭声音
    cameraTilt: 55,
    showOpponent: false,
    autoPilot: true,
    infinitePlanks: true,
    autoLoop: true,
    ...DEFAULT_PHYSICS_SETTINGS,
    ...DEFAULT_IK_SETTINGS,
  });

  const handleSelectPalette = useCallback((p: ColorPalette) => {
    setCurrentPalette(p);
    setSettings((s) => ({ ...s, paletteId: p.id }));
  }, []);

  const handleUpdateSettings = useCallback((newSettings: Partial<VisualSettings>) => {
    setSettings((s) => ({ ...s, ...newSettings }));
  }, []);

  const handleOpenCocosModal = useCallback(() => setIsCocosModalOpen(true), []);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Header */}
      <Header
        currentPalette={currentPalette}
        onOpenCocosModal={() => setIsCocosModalOpen(true)}
      />

      {/* Main Workspace Body — 轮66登记/72落地: 窄屏(小游戏竖屏)上下分栏, 桌面md+保持左右分栏零回归 */}
      <div className="flex flex-col md:flex-row flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left: 3D Playable Shortcut Run Canvas */}
        <main className="flex-1 relative h-1/2 md:h-full bg-slate-900 overflow-hidden">
          <GameCanvas
            palette={currentPalette}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        </main>

        {/* Right: Art Studio & Shader Tuning Sidebar */}
        <aside className="w-full h-1/2 md:h-full shrink-0 border-t md:border-t-0 md:w-96 md:border-l border-slate-800 bg-slate-900 overflow-y-auto">
          <ArtStudioPanel
            currentPalette={currentPalette}
            settings={settings}
            onSelectPalette={handleSelectPalette}
            onUpdateSettings={handleUpdateSettings}
            onOpenCocosModal={handleOpenCocosModal}
          />
        </aside>
      </div>

      {/* Cocos 3.8 Code & Asset Export Modal */}
      <CocosToolkitModal
        palette={currentPalette}
        isOpen={isCocosModalOpen}
        onClose={() => setIsCocosModalOpen(false)}
      />
    </div>
  );
}
