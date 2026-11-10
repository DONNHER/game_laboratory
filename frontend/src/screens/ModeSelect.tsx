import React from 'react';
import { ScreenState, GameMode } from '../types';
import { ArrowLeft, Trophy, Swords, Users, AlertTriangle, ChevronRight, Home } from 'lucide-react';

interface ModeSelectProps {
  onNavigate: (screen: ScreenState) => void;
  onBack: () => void;
  onGoHome: () => void;
  backLabel: string;
  onSelectMode: (mode: GameMode) => void;
  serverError?: string | null;
  onClearServerError?: () => void;
}

export const ModeSelect: React.FC<ModeSelectProps> = ({
  onNavigate,
  onBack,
  onGoHome,
  backLabel,
  onSelectMode,
  serverError,
  onClearServerError,
}) => {
  const showHomeShortcut = backLabel !== 'Home Page';

  return (
    <div className="relative w-full h-full flex flex-col px-5 py-5 md:px-8 md:py-7 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1">
        {/* Top Bar */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-4 border-b border-slate-800/80">
          <button
            onClick={onBack}
            title={`Back to ${backLabel}`}
            className="justify-self-start min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center space-x-1.5 text-slate-300 hover:text-white active:scale-95 transition-all"
            aria-label={`Back to ${backLabel}`}
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-semibold">Back</span>
          </button>

          <h1 className="font-display font-extrabold text-base md:text-lg text-cyan-400 tracking-wider uppercase text-center">
            Select Mode
          </h1>

          <div className="justify-self-end">
            {showHomeShortcut && (
              <button
                onClick={onGoHome}
                title="Home Page"
                aria-label="Home Page"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
              >
                <Home size={18} />
              </button>
            )}
          </div>
        </header>

        {/* Connection Notice Banner */}
        {serverError && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-100 text-xs flex items-start space-x-3">
            <AlertTriangle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-rose-200 text-sm">Connection Unavailable</div>
              <p className="mt-0.5 text-rose-200/85 leading-relaxed">{serverError}</p>
            </div>
            {onClearServerError && (
              <button
                onClick={onClearServerError}
                className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-rose-900/50 text-rose-300 hover:text-white font-bold flex items-center justify-center"
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="mt-6 mb-5 text-center">
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-slate-100 tracking-tight">
            CHOOSE YOUR CHALLENGE
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
            Take on the solo campaign, race an agile rival, or challenge a friend in a private room.
          </p>
        </div>

        {/* Mode Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-auto">
          {/* Solo Campaign */}
          <button
            onClick={() => {
              onSelectMode('SOLO');
              onNavigate('LEVEL_SELECT');
            }}
            className="p-5 rounded-2xl bg-slate-900/95 border border-cyan-500/30 hover:border-cyan-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between shadow-lg group min-h-[210px]"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30 mb-4 group-hover:scale-105 transition-transform">
                <Trophy size={24} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-100 group-hover:text-cyan-300">
                Solo Campaign
              </h3>
              <p className="text-xs md:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Sprint across 5 progressively faster districts, collect energy cores, and earn up to 15 stars.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-cyan-400">
              <span>5 Districts</span>
              <span className="flex items-center space-x-1">
                <span>Select Stage</span>
                <ChevronRight size={16} />
              </span>
            </div>
          </button>

          {/* Rival Race */}
          <button
            onClick={() => {
              onSelectMode('AI_RIVAL');
              onNavigate('PLAYING');
            }}
            className="p-5 rounded-2xl bg-slate-900/95 border border-emerald-500/30 hover:border-emerald-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between shadow-lg group min-h-[210px]"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 mb-4 group-hover:scale-105 transition-transform">
                <Swords size={24} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-100 group-hover:text-emerald-300">
                Rival Race
              </h3>
              <p className="text-xs md:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Go lane-to-lane against a fast challenger on the same course. Stay upright and reach the finish first.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-emerald-400">
              <span>Head-to-Head</span>
              <span className="flex items-center space-x-1">
                <span>Start Race</span>
                <ChevronRight size={16} />
              </span>
            </div>
          </button>

          {/* Online Match */}
          <button
            onClick={() => {
              onSelectMode('ONLINE_MATCH');
              onNavigate('LOBBY');
            }}
            className="p-5 rounded-2xl bg-slate-900/95 border border-indigo-500/30 hover:border-indigo-400 active:scale-[0.98] transition-all text-left flex flex-col justify-between shadow-lg group min-h-[210px]"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 mb-4 group-hover:scale-105 transition-transform">
                <Users size={24} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-100 group-hover:text-indigo-300">
                Online Match
              </h3>
              <p className="text-xs md:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Create a private 2-player race room or enter a friend’s 4-letter invite code to compete on an identical track.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-indigo-400">
              <span>2 Players</span>
              <span className="flex items-center space-x-1">
                <span>Enter Lobby</span>
                <ChevronRight size={16} />
              </span>
            </div>
          </button>
        </div>

        {/* Bottom Back CTA for Mobile Ergonomics */}
        <div className="mt-6 pt-3 border-t border-slate-800/80 md:hidden">
          <button
            onClick={onBack}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            <span>Back to {backLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
