import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Home, Pause, ArrowLeft } from 'lucide-react';
import { useGameStore, gameStore } from '../store/gameStore';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onBack: () => void;
  onGoHome: () => void;
  backLabel: string;
  isOnlineMatch?: boolean;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onBack,
  onGoHome,
  backLabel,
  isOnlineMatch = false,
}) => {
  const store = useGameStore();
  const showSeparateBack = backLabel !== 'Home Page';

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-6">
      <div className="w-full max-w-xs p-6 rounded-3xl bg-slate-900 border border-slate-700/80 text-center shadow-2xl flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-500/30">
          <Pause size={22} />
        </div>

        <h2 className="font-display font-extrabold text-2xl text-slate-100 tracking-wide">
          {isOnlineMatch ? 'LIVE MATCH' : 'PAUSED'}
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          {isOnlineMatch
            ? 'Race stays live while this menu is open.'
            : 'Catch your breath and jump back in anytime.'}
        </p>

        <div className="w-full space-y-2.5">
          <button
            onClick={onResume}
            className="w-full min-h-[50px] py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-display font-extrabold text-base uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Play size={18} className="fill-slate-950" />
            <span>Resume</span>
          </button>

          {!isOnlineMatch && (
            <button
              onClick={onRestart}
              className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 font-display font-bold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all border border-slate-700"
            >
              <RotateCcw size={16} />
              <span>Restart</span>
            </button>
          )}

          <button
            onClick={() => gameStore.toggleSound()}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-slate-800/70 hover:bg-slate-800 active:scale-[0.98] text-slate-300 text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-700/70 transition-all"
          >
            {store.soundOn ? (
              <Volume2 size={16} className="text-cyan-400" />
            ) : (
              <VolumeX size={16} className="text-rose-400" />
            )}
            <span>Sound: {store.soundOn ? 'On' : 'Muted'}</span>
          </button>

          {showSeparateBack ? (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={onBack}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 active:scale-[0.98] text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-slate-700 transition-all"
              >
                <ArrowLeft size={15} />
                <span className="truncate">{backLabel}</span>
              </button>

              <button
                onClick={onGoHome}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 active:scale-[0.98] text-rose-300 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-rose-500/30 transition-all"
              >
                <Home size={15} />
                <span>Home Page</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onGoHome}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 active:scale-[0.98] text-rose-300 text-xs font-semibold flex items-center justify-center space-x-2 border border-rose-500/30 transition-all"
            >
              <Home size={16} />
              <span>Home Page</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
