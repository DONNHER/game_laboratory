import React from 'react';
import { ScreenState, LevelConfig } from '../types';
import { LEVELS, kphToMps } from '../game/levels';
import { useGameStore } from '../store/gameStore';
import { ArrowLeft, Lock, Star, Play, CheckCircle2, CloudFog, Zap, Wind } from 'lucide-react';

interface LevelSelectProps {
  onNavigate: (screen: ScreenState) => void;
  onBack: () => void;
  backLabel: string;
  onSelectLevel: (level: LevelConfig) => void;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({
  onNavigate,
  onBack,
  backLabel,
  onSelectLevel,
}) => {
  const store = useGameStore();
  const totalStars = Object.values(store.bestStars).reduce((a, b) => a + b, 0);

  return (
    <div className="relative w-full h-full flex flex-col px-5 py-5 md:px-8 md:py-7 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      <div className="w-full max-w-3xl mx-auto flex flex-col flex-1">
        {/* Top Header */}
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
            Solo Campaign
          </h1>

          <div className="justify-self-end flex items-center space-x-1.5 text-xs font-display font-bold text-amber-400 bg-slate-900 px-3 min-h-[44px] rounded-xl border border-slate-800 tabular-nums">
            <Star size={14} className="fill-amber-400" />
            <span>{totalStars} / 15</span>
          </div>
        </header>

        <div className="mt-5 mb-4 text-center">
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-slate-100 tracking-tight">
            SELECT DISTRICT
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Each stage scales milestone intensity — from 10s fog banks at 500m to 2x velocity zones.
          </p>
        </div>

        {/* Stages List */}
        <div className="flex flex-col space-y-3 flex-1">
          {LEVELS.map((level) => {
            const isUnlocked = level.id <= store.unlockedLevel;
            const starsEarned = store.bestStars[level.id] || 0;
            const isCompleted = starsEarned > 0;
            const baseMps = kphToMps(level.baseSpeed).toFixed(1);
            const maxMps = kphToMps(level.maxBaseSpeed).toFixed(1);

            return (
              <div
                key={level.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isUnlocked
                    ? 'bg-slate-900/95 border-slate-800 hover:border-cyan-400/70 shadow-md'
                    : 'bg-slate-950/60 border-slate-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-xl flex-shrink-0 mt-0.5 ${
                        isUnlocked
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {isUnlocked ? (
                        isCompleted ? (
                          <CheckCircle2 size={24} className="text-emerald-400" />
                        ) : (
                          level.id
                        )
                      ) : (
                        <Lock size={19} className="text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-display font-bold text-base md:text-lg text-slate-100 truncate">
                          {level.name}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          {level.difficultyLabel}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5">{level.subtitle}</div>

                      <div className="text-xs font-medium text-cyan-400 tabular-nums mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Goal: {level.goalDistance.toLocaleString()} m</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300">
                          {level.baseSpeed}–{level.maxBaseSpeed} km/h ({baseMps}–{maxMps} m/s)
                        </span>
                      </div>

                      {/* Route Milestones Preview */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono tabular-nums text-slate-300">
                        {level.milestones.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center space-x-1 text-slate-300"
                          >
                            {m.kind === 'FOG' ? (
                              <CloudFog size={11} className="text-sky-400" />
                            ) : m.kind === 'FOG_SPEED' ? (
                              <Wind size={11} className="text-violet-400" />
                            ) : (
                              <Zap size={11} className="text-emerald-400" />
                            )}
                            <span>
                              {m.distance}m {m.label} ({m.durationSec}s)
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Stars & Launch Button */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5 sm:gap-4 flex-shrink-0">
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3].map((starIdx) => (
                        <Star
                          key={starIdx}
                          size={15}
                          className={
                            starIdx <= starsEarned
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700'
                          }
                        />
                      ))}
                    </div>

                    <button
                      disabled={!isUnlocked}
                      onClick={() => {
                        if (isUnlocked) {
                          onSelectLevel(level);
                          onNavigate('PLAYING');
                        }
                      }}
                      className={`min-w-[96px] min-h-[44px] py-2 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                        isUnlocked
                          ? 'bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 shadow-sm'
                          : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isUnlocked ? (
                        <>
                          <Play size={14} className="fill-slate-950" />
                          <span>Run</span>
                        </>
                      ) : (
                        <span>Locked</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Bottom Back Button */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 md:hidden">
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
