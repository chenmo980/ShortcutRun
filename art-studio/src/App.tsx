import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { GameCanvas } from './components/GameCanvas';
import { ArtStudioPanel } from './components/ArtStudioPanel';
import { CocosToolkitModal } from './components/CocosToolkitModal';
import { THEME_PALETTES } from './data/themes';
import { ColorPalette, VisualSettings, GameMetrics } from './types';

export default function App() {
  const [currentPalette, setCurrentPalette] = useState<ColorPalette>(THEME_PALETTES[0]);
  const [isCocosModalOpen, setIsCocosModalOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<VisualSettings>({
    paletteId: THEME_PALETTES[0].id,
    characterType: 'runner_boy',
    plankStyle: 'wood_plank',
    waterWaves: true,
    waterFoam: true,
    planarShadows: true,
    pickupVFX: true,
    soundEnabled: true,
    cameraTilt: 55,
    showOpponent: false,
  });

  const [metrics, setMetrics] = useState<GameMetrics>({
    score: 0,
    planksCarried: 12,
    planksPlaced: 0,
    multiplier: 1,
    state: 'running',
    drawCalls: 18,
    fps: 60,
  });

  const handleSelectPalette = useCallback((p: ColorPalette) => {
    setCurrentPalette(p);
    setSettings((s) => ({ ...s, paletteId: p.id }));
  }, []);

  const handleUpdateSettings = useCallback((newSettings: Partial<VisualSettings>) => {
    setSettings((s) => ({ ...s, ...newSettings }));
  }, []);

  const handleMetricsUpdate = useCallback((m: GameMetrics) => {
    setMetrics(m);
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Header */}
      <Header
        currentPalette={currentPalette}
        onOpenCocosModal={() => setIsCocosModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left: 3D Playable Shortcut Run Canvas */}
        <main className="flex-1 relative h-full bg-slate-900 overflow-hidden">
          <GameCanvas
            palette={currentPalette}
            settings={settings}
            onMetricsUpdate={handleMetricsUpdate}
          />
        </main>

        {/* Right: Art Studio & Shader Tuning Sidebar */}
        <aside className="w-80 md:w-96 h-full shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto">
          <ArtStudioPanel
            currentPalette={currentPalette}
            settings={settings}
            metrics={metrics}
            onSelectPalette={handleSelectPalette}
            onUpdateSettings={handleUpdateSettings}
            onOpenCocosModal={() => setIsCocosModalOpen(true)}
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
