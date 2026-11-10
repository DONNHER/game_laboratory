import React from 'react';
import { CloudFog, Zap, Wind, Flag, Shield, Rocket } from 'lucide-react';
import {
  GameMode,
  LevelConfig,
  StageMilestone,
  SHIELD_GEM_DURATION_SEC,
  FLY_GEM_DURATION_SEC,
} from '../types';
import { kphToMps } from '../game/levels';

export interface ActiveMilestoneHudState {
  milestone: StageMilestone;
  remainingSec: number;
}

interface RaceHudOverlayProps {
  level: LevelConfig;
  mode: GameMode;
  distance: number;
  coins: number;
  speedKph: number;
  speedMultiplier: number;
  isSlowed: boolean;
  shieldRemaining?: number;
  flyRemaining?: number;
  opponentName: string;
  opponentDist: number;
  opponentAlive: boolean;
  activeMilestone: ActiveMilestoneHudState | null;
  onPauseToggle: () => void;
}

export const RaceHudOverlay: React.FC<RaceHudOverlayProps> = ({
  level,
  mode,
  distance,
  coins,
  speedKph,
  speedMultiplier,
  isSlowed,
  shieldRemaining = 0,
  flyRemaining = 0,
  opponentName,
  opponentDist,
  opponentAlive,
  activeMilestone,
  onPauseToggle,
}) => {
  const isFlying = flyRemaining > 0.02;
  const isShielded = shieldRemaining > 0.02;
  const goalDistance = Math.max(100, level?.goalDistance ?? 800);
  const safeDist = Math.min(goalDistance, Math.max(0, Number.isFinite(distance) ? distance : 0));
  const progressPct = Math.min(100, Math.max(0, (safeDist / goalDistance) * 100));
  const oppProgressPct = Math.min(100, Math.max(0, ((opponentDist || 0) / goalDistance) * 100));

  const safeKph = Number.isFinite(speedKph) && speedKph >= 0 ? speedKph : 0;
  const safeMps = kphToMps(safeKph);

  const milestones = level?.milestones ?? [];
  const nextMilestone = milestones.find((m) => m.distance > safeDist) ?? null;

  const renderMilestoneIcon = (kind: StageMilestone['kind'], size = 11) => {
    if (kind === 'FOG') return <CloudFog size={size} className="text-sky-300 shrink-0" />;
    if (kind === 'FOG_SPEED') return <Wind size={size} className="text-violet-300 shrink-0" />;
    return <Zap size={size} className="text-emerald-300 shrink-0" />;
  };

  return (
    <div className="absolute top-0 left-0 right-0 p-2.5 sm:p-4 flex items-start justify-between gap-2 pointer-events-none z-10">
      {/* TOP-LEFT MAP BAR: Route Progress, Stage Milestones, Active Timers & Speed (km/h + m/s) */}
      <div className="w-[248px] sm:w-[320px] rounded-xl bg-slate-950/95 border border-slate-800 px-3 py-2.5 shadow-xl pointer-events-none">
        {/* Row 1: Stage Level & Distance Readout */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-slate-400 truncate">
            {level.difficultyLabel || level.name}
          </span>
          <div className="flex items-baseline space-x-1 shrink-0 tabular-nums">
            <span className="font-display font-extrabold text-base sm:text-lg text-cyan-400 leading-none">
              {Math.floor(safeDist)}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 leading-none">
              / {goalDistance} m
            </span>
          </div>
        </div>

        {/* Row 2: Visual Route Map Bar with Milestone Pins */}
        <div className="relative mt-2.5 mb-4">
          {/* Base Track */}
          <div className="relative h-2 w-full rounded-sm bg-slate-800 border border-slate-700/80 overflow-visible">
            {/* Player Covered Route Fill */}
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 rounded-l-sm"
              style={{ width: `${progressPct}%` }}
            />

            {/* Milestone Markers along Track */}
            {milestones.map((m) => {
              const pinPct = Math.min(96, Math.max(4, (m.distance / goalDistance) * 100));
              const isPassed = safeDist >= m.distance;
              const isActive = activeMilestone?.milestone.id === m.id;

              const colorClass =
                m.kind === 'FOG'
                  ? isActive
                    ? 'bg-sky-300 border-white scale-125'
                    : isPassed
                    ? 'bg-slate-600 border-slate-500'
                    : 'bg-sky-400 border-slate-950'
                  : m.kind === 'FOG_SPEED'
                  ? isActive
                    ? 'bg-violet-300 border-white scale-125'
                    : isPassed
                    ? 'bg-slate-600 border-slate-500'
                    : 'bg-violet-400 border-slate-950'
                  : isActive
                  ? 'bg-emerald-300 border-white scale-125'
                  : isPassed
                  ? 'bg-slate-600 border-slate-500'
                  : 'bg-emerald-400 border-slate-950';

              return (
                <div
                  key={m.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${pinPct}%` }}
                >
                  <div
                    className={`w-2.5 h-2.5 rotate-45 border transition-transform ${colorClass}`}
                  />
                  <span
                    className={`mt-1 text-[9px] font-mono tabular-nums leading-none whitespace-nowrap ${
                      isActive
                        ? 'text-white font-bold'
                        : isPassed
                        ? 'text-slate-500'
                        : 'text-slate-300'
                    }`}
                  >
                    {m.distance}m
                  </span>
                </div>
              );
            })}

            {/* Opponent Marker on Map Bar (if Rival / Online mode) */}
            {mode !== 'SOLO' && (
              <div
                className={`absolute -top-1 -translate-x-1/2 w-2 h-3.5 rounded-xs border ${
                  opponentAlive
                    ? 'bg-orange-400 border-slate-950'
                    : 'bg-rose-500/70 border-rose-950'
                }`}
                style={{ left: `${oppProgressPct}%` }}
              />
            )}

            {/* Player Current Position Cursor */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-300 border-2 border-slate-950 shadow"
              style={{ left: `${progressPct}%` }}
            />

            {/* Finish Flag Pin */}
            <div className="absolute right-0 -top-1.5 translate-x-1/2 text-amber-400">
              <Flag size={10} className="fill-amber-400" />
            </div>
          </div>
        </div>

        {/* Row 3: Active Milestone Countdown OR Next Milestone Preview */}
        {activeMilestone ? (
          <div
            className={`mt-1 rounded-lg px-2 py-1.5 border ${
              activeMilestone.milestone.kind === 'FOG'
                ? 'bg-sky-950/80 border-sky-500/50 text-sky-100'
                : activeMilestone.milestone.kind === 'FOG_SPEED'
                ? 'bg-violet-950/80 border-violet-500/50 text-violet-100'
                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-100'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5 text-[11px] leading-tight">
              <div className="flex items-center space-x-1.5 min-w-0">
                {renderMilestoneIcon(activeMilestone.milestone.kind, 12)}
                <span className="font-display font-bold truncate">
                  {activeMilestone.milestone.distance}m · {activeMilestone.milestone.label}
                </span>
              </div>
              <span className="font-mono font-bold tabular-nums shrink-0 text-white">
                {activeMilestone.remainingSec.toFixed(1)}s
              </span>
            </div>
            <div className="mt-1 h-1 w-full bg-slate-900/90 rounded-xs overflow-hidden">
              <div
                className={`h-full ${
                  activeMilestone.milestone.kind === 'FOG'
                    ? 'bg-sky-400'
                    : activeMilestone.milestone.kind === 'FOG_SPEED'
                    ? 'bg-violet-400'
                    : 'bg-emerald-400'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      (activeMilestone.remainingSec /
                        Math.max(1, activeMilestone.milestone.durationSec)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : nextMilestone ? (
          <div className="mt-1 rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1 flex items-center justify-between gap-1.5 text-[10px]">
            <div className="flex items-center space-x-1.5 min-w-0 text-slate-200">
              {renderMilestoneIcon(nextMilestone.kind, 11)}
              <span className="truncate">
                Next <strong className="font-mono tabular-nums text-cyan-300">{nextMilestone.distance}m</strong>
                {' · '}
                {nextMilestone.label}
              </span>
            </div>
            <span className="font-mono tabular-nums text-slate-400 shrink-0">
              {nextMilestone.durationSec}s
            </span>
          </div>
        ) : (
          <div className="mt-1 rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1 flex items-center justify-between text-[10px] text-emerald-300">
            <span className="font-semibold">All Milestones Cleared</span>
            <span className="font-mono tabular-nums text-slate-400">
              {Math.max(0, Math.ceil(goalDistance - safeDist))}m left
            </span>
          </div>
        )}

        {/* Active Power Gems Status (3s Shield / 2x Invincible Flight) */}
        {(isFlying || isShielded) && (
          <div className="mt-1.5 space-y-1">
            {isFlying && (
              <div className="rounded-lg bg-amber-950/85 border border-amber-400/60 px-2 py-1 text-amber-100">
                <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Rocket size={11} className="text-amber-300 shrink-0" />
                    <span className="font-display font-bold truncate">
                      2x Sky Flight · Invincible
                    </span>
                  </div>
                  <span className="font-mono font-bold tabular-nums shrink-0 text-amber-200">
                    {flyRemaining.toFixed(1)}s
                  </span>
                </div>
                <div className="mt-1 h-1 w-full bg-slate-900/90 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (flyRemaining / FLY_GEM_DURATION_SEC) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {isShielded && (
              <div className="rounded-lg bg-cyan-950/85 border border-cyan-400/60 px-2 py-1 text-cyan-100">
                <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Shield size={11} className="text-cyan-300 shrink-0" />
                    <span className="font-display font-bold truncate">
                      Shield Gem · Barrier
                    </span>
                  </div>
                  <span className="font-mono font-bold tabular-nums shrink-0 text-cyan-200">
                    {shieldRemaining.toFixed(1)}s
                  </span>
                </div>
                <div className="mt-1 h-1 w-full bg-slate-900/90 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (shieldRemaining / SHIELD_GEM_DURATION_SEC) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 4: Live Speed Readout (km/h · m/s · Multiplier) */}
        <div className="mt-2 pt-1.5 border-t border-slate-800/90 flex items-center justify-between gap-1.5 text-[11px] tabular-nums">
          <div className="flex items-baseline space-x-1.5">
            <span
              className={`font-display font-extrabold text-xs sm:text-sm ${
                isFlying
                  ? 'text-amber-300'
                  : isSlowed
                  ? 'text-amber-400'
                  : speedMultiplier > 1.05
                  ? 'text-emerald-300'
                  : 'text-cyan-300'
              }`}
            >
              {Math.round(safeKph)} km/h
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              · {safeMps.toFixed(1)} m/s
            </span>
          </div>

          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-tight border ${
              isFlying
                ? 'bg-amber-950/90 border-amber-400/60 text-amber-300'
                : isShielded
                ? 'bg-cyan-950/90 border-cyan-400/60 text-cyan-300'
                : isSlowed
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-300'
                : speedMultiplier > 1.05
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {isFlying
              ? '2.0x Fly'
              : isSlowed
              ? 'Slowed'
              : `${speedMultiplier.toFixed(1)}x`}
          </span>
        </div>
      </div>

      {/* TOP-RIGHT HUD: Challenger Distance, Cores & Pause */}
      <div className="flex items-center space-x-2 pointer-events-auto shrink-0">
        {mode !== 'SOLO' && (
          <div
            className={`px-2.5 py-1.5 rounded-xl flex flex-col items-end border ${
              opponentAlive
                ? 'bg-slate-950/95 border-orange-500/40'
                : 'bg-rose-950/95 border-rose-500/60'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold tracking-wider max-w-[84px] truncate ${
                opponentAlive ? 'text-orange-300' : 'text-rose-300'
              }`}
            >
              {opponentName}
            </span>
            <span
              className={`text-xs font-display font-bold tabular-nums ${
                opponentAlive ? 'text-orange-400' : 'text-rose-400'
              }`}
            >
              {opponentDist} m{opponentAlive ? '' : ' · Out'}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-1.5 px-3 min-h-[42px] rounded-xl bg-slate-950/95 border border-amber-500/35 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-display font-bold text-sm sm:text-base tabular-nums">{coins}</span>
        </div>

        <button
          onClick={onPauseToggle}
          className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-950/95 border border-slate-700 text-slate-200 flex items-center justify-center font-bold active:scale-95 hover:bg-slate-800 pointer-events-auto"
          aria-label="Pause Game"
        >
          ⏸
        </button>
      </div>
    </div>
  );
};
