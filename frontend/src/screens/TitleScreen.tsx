import React from 'react';
import { ScreenState } from '../types';
import { useGameStore, gameStore } from '../store/gameStore';
import { Volume2, VolumeX, Play, Settings, User, LayoutGrid } from 'lucide-react';
import { getCharacterMeta } from '../game/characters';

interface TitleScreenProps {
  onNavigate: (screen: ScreenState) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onNavigate }) => {
  const store = useGameStore();
  const activeRunner = getCharacterMeta(store.selectedCharacterId || 'kai');

  return (
    <div className="relative w-full h-full flex flex-col justify-between px-6 py-6 md:px-10 md:py-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      {/* Ambient Radial Accent */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-cyan-500/20 blur-3xl" />

      {/* Top Header Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between z-10">
        <div className="font-display font-bold text-xs uppercase tracking-[0.22em] text-slate-400">
          ARCADE SPRINT
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => gameStore.toggleSound()}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
            aria-label={store.soundOn ? 'Mute sound' : 'Enable sound'}
          >
            {store.soundOn ? (
              <Volume2 size={19} />
            ) : (
              <VolumeX size={19} className="text-rose-400" />
            )}
          </button>

          <button
            onClick={() => onNavigate('SETTINGS')}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
            aria-label="Settings"
          >
            <Settings size={19} />
          </button>
        </div>
      </header>

      {/* Hero Centerpiece */}
      <main className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center my-auto py-8 text-center z-10">
        <p className="font-display font-bold text-xs md:text-sm uppercase tracking-[0.28em] text-cyan-400 mb-3">
          HIGH-SPEED NEON CIRCUIT
        </p>

        <h1 className="font-display font-extrabold text-6xl sm:text-7xl md:text-8xl text-slate-50 tracking-tight leading-[0.92]">
          MAZE
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
            RUNNER
          </span>
        </h1>

        <p className="mt-4 text-slate-400 text-sm md:text-base max-w-md leading-relaxed">
          Weave through shifting barriers, clear plasma gates, and outrun rivals across five high-velocity districts.
        </p>

        {/* Clean Unboxed Career Summary */}
        <div className="mt-8 w-full max-w-md grid grid-cols-3 divide-x divide-slate-800 rounded-2xl bg-slate-900/80 border border-slate-800/90 py-3.5 px-2">
          <div className="px-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Campaign
            </div>
            <div className="font-display font-bold text-base md:text-lg text-emerald-400 tabular-nums mt-0.5">
              Stage {store.unlockedLevel}/5
            </div>
          </div>

          <div className="px-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Best Run
            </div>
            <div className="font-display font-bold text-base md:text-lg text-cyan-400 tabular-nums mt-0.5">
              {store.highDistance.toLocaleString()} m
            </div>
          </div>

          <div className="px-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Runner
            </div>
            <div
              className={`font-display font-bold text-base md:text-lg truncate mt-0.5 ${activeRunner.textColorClass}`}
            >
              {activeRunner.name}
            </div>
          </div>
        </div>
      </main>

      {/* Primary & Secondary Actions */}
      <footer className="w-full max-w-sm mx-auto flex flex-col space-y-2.5 z-10 pb-1">
        <button
          onClick={() => onNavigate('MODE_SELECT')}
          className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-display font-extrabold text-xl uppercase tracking-wider flex items-center justify-center space-x-2.5 shadow-lg shadow-cyan-500/25 transition-all"
        >
          <Play size={22} className="fill-slate-950" />
          <span>Play Now</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => onNavigate('CHARACTER_SELECT')}
            className="min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-800 text-slate-200 text-sm font-semibold flex items-center justify-center space-x-2 transition-all"
          >
            <User size={16} className="text-cyan-400" />
            <span>Runners</span>
          </button>

          <button
            onClick={() => onNavigate('MAIN_MENU')}
            className="min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-800 text-slate-200 text-sm font-semibold flex items-center justify-center space-x-2 transition-all"
          >
            <LayoutGrid size={16} className="text-indigo-400" />
            <span>Main Hub</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
