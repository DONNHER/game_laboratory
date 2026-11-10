import React, { useEffect, useState } from 'react';
import { LevelConfig, GameMode } from '../types';
import { Star, RotateCcw, ArrowRight, ArrowLeft, Home, Trophy, Flame, Coins } from 'lucide-react';
import { gameStore } from '../store/gameStore';
import { saveGameRun } from '../services/neonAuth';

interface ResultScreenProps {
  won: boolean;
  distance: number;
  goalDistance: number;
  stars: number;
  coins: number;
  crashReason?: string;
  level: LevelConfig;
  mode: GameMode;
  opponentName?: string;
  opponentDistance?: number;
  opponentWon?: boolean;
  onBack: () => void;
  onGoHome: () => void;
  backLabel: string;
  onRetry: () => void;
  onNextLevel: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  won,
  distance,
  goalDistance,
  stars,
  coins,
  crashReason,
  level,
  mode,
  opponentName = 'Apex Rival',
  opponentDistance,
  opponentWon,
  onBack,
  onGoHome,
  backLabel,
  onRetry,
  onNextLevel,
}) => {
  const [cloudSaveMessage, setCloudSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (won && mode === 'SOLO') {
      gameStore.completeLevel(level.id, stars);
    }
    gameStore.updateHighDistance(distance);
    if (coins > 0) {
      gameStore.addCoins(coins);
    }

    const updatedProfile = gameStore.getState();
    void saveGameRun(
      {
        runId: crypto.randomUUID(),
        mode,
        levelId: level.id,
        distance: Math.floor(distance),
        coins,
        won,
        stars,
      },
      updatedProfile
    )
      .then((saved) => {
        if (saved) setCloudSaveMessage('Run saved to your Neon account.');
      })
      .catch((error: unknown) => {
        console.error('Could not save the game run to Neon:', error);
        setCloudSaveMessage(
          error instanceof Error ? `Cloud save failed: ${error.message}` : 'Cloud save failed.'
        );
      });
  }, [won, mode, level.id, stars, distance, coins]);

  const hasNextLevel = level.id < 5;

  return (
    <div className="relative w-full h-full flex flex-col justify-between px-6 py-6 md:px-10 md:py-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      <div className="w-full max-w-md mx-auto flex flex-col justify-between flex-1">
        {/* Status Header */}
        <div className="flex flex-col items-center text-center mt-2 z-10">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-3.5 border shadow-2xl ${
              won
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-emerald-500/15'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-rose-500/15'
            }`}
          >
            {won ? <Trophy size={40} /> : <Flame size={40} />}
          </div>

          <h1
            className={`font-display font-extrabold text-4xl md:text-5xl tracking-tight ${
              won
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-red-400 to-amber-400'
            }`}
          >
            {won
              ? mode !== 'SOLO' && !opponentWon
                ? 'VICTORY!'
                : 'STAGE CLEARED!'
              : 'WIPEOUT'}
          </h1>

          <p className="text-xs md:text-sm text-slate-400 mt-1.5 max-w-xs leading-relaxed">
            {won
              ? mode !== 'SOLO' && !opponentWon
                ? crashReason ||
                  (distance >= goalDistance
                    ? `Crossed the ${goalDistance.toLocaleString()} m finish line ahead of ${opponentName}!`
                    : opponentDistance !== undefined
                    ? `You outlasted ${opponentName}, who wiped out at ${opponentDistance.toLocaleString()} m.`
                    : `Finished ${level.name} ahead of ${opponentName}!`)
                : `Finished ${level.name} and cleared the ${goalDistance.toLocaleString()} m mark.`
              : crashReason || 'A collision brought your run to a halt.'}
          </p>
          {cloudSaveMessage && (
            <p
              role="status"
              className={`mt-2 text-xs ${cloudSaveMessage.startsWith('Cloud save failed') ? 'text-rose-300' : 'text-emerald-300'}`}
            >
              {cloudSaveMessage}
            </p>
          )}

          {won && (
            <div className="mt-4 flex items-center space-x-2.5 bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-2xl">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  size={28}
                  className={
                    s <= stars
                      ? 'text-amber-400 fill-amber-400 animate-bounce'
                      : 'text-slate-700'
                  }
                  style={{ animationDelay: `${s * 140}ms`, animationIterationCount: 2 }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary Metrics Card */}
        <div className="my-auto py-5 z-10">
          <div className="p-4 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  Distance
                </div>
                <div className="font-display font-extrabold text-2xl md:text-3xl text-cyan-400 tabular-nums mt-0.5">
                  {distance.toLocaleString()} m
                </div>
                <div className="text-xs text-slate-400 tabular-nums mt-0.5">
                  Goal: {goalDistance.toLocaleString()} m
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center justify-center space-x-1">
                  <Coins size={13} className="text-amber-400" />
                  <span>Cores</span>
                </div>
                <div className="font-display font-extrabold text-2xl md:text-3xl text-amber-400 tabular-nums mt-0.5">
                  +{coins}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Added to stash</div>
              </div>
            </div>

            {mode !== 'SOLO' && opponentDistance !== undefined && (
              <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">{opponentName}</span>
                <span
                  className={`font-display font-bold tabular-nums ${
                    opponentWon ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {opponentDistance.toLocaleString()} m ·{' '}
                  {opponentWon
                    ? 'Finished Ahead'
                    : won && distance >= goalDistance
                    ? 'Finished Behind'
                    : 'Out'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2.5 z-10">
          {won && hasNextLevel && mode === 'SOLO' && (
            <button
              onClick={onNextLevel}
              className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-display font-extrabold text-lg uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <span>Next District</span>
              <ArrowRight size={20} />
            </button>
          )}

          <button
            onClick={onRetry}
            className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-display font-extrabold text-lg uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <RotateCcw size={19} />
            <span>{mode === 'ONLINE_MATCH' ? 'Room Lobby' : 'Play Again'}</span>
          </button>

          {backLabel !== 'Home Page' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onBack}
                className="min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-800 text-slate-200 text-sm font-semibold flex items-center justify-center space-x-2 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="truncate">{backLabel}</span>
              </button>

              <button
                onClick={onGoHome}
                className="min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center space-x-2 transition-all"
              >
                <Home size={16} />
                <span>Home Page</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onGoHome}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center space-x-2 transition-all"
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
