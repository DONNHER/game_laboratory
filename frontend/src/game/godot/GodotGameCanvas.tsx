import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GameMode,
  LevelConfig,
  StageMilestone,
  PowerGemKind,
} from '../../types';
import { RoadGenerator } from '../RoadGenerator';
import { createRandomSeed } from '../mulberry32';
import { soundEngine } from '../audio';
import { gameStore } from '../../store/gameStore';
import { multiplayerClient, PlayerUpdateTelemetry } from '../../services/multiplayerClient';
import { RaceHudOverlay, ActiveMilestoneHudState } from '../../components/RaceHudOverlay';
import { godotBridge, useGodotBootState } from './godotBridge';

interface GodotGameCanvasProps {
  runId: number;
  level: LevelConfig;
  mode: GameMode;
  roomSeed?: number;
  opponentName?: string;
  opponentCharacterId?: string;
  onGameOver: (result: {
    won: boolean;
    distance: number;
    goalDistance: number;
    stars: number;
    coins: number;
    crashReason?: string;
    opponentDistance?: number;
    opponentWon?: boolean;
  }) => void;
  onPauseToggle: () => void;
  isPaused: boolean;
}

export const GodotGameCanvas: React.FC<GodotGameCanvasProps> = ({
  runId,
  level,
  mode,
  roomSeed,
  opponentName = 'Apex Rival',
  opponentCharacterId,
  onGameOver,
  onPauseToggle,
  isPaused,
}) => {
  const godotBoot = useGodotBootState();

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const onPauseToggleRef = useRef(onPauseToggle);
  onPauseToggleRef.current = onPauseToggle;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [hasAuthResult, setHasAuthResult] = useState<boolean>(false);

  const [hudStats, setHudStats] = useState<{
    distance: number;
    coins: number;
    speed: number;
    speedMultiplier: number;
    isSlowed: boolean;
    shieldRemaining: number;
    flyRemaining: number;
    opponentDist: number;
    opponentAlive: boolean;
    activeMilestone: ActiveMilestoneHudState | null;
  }>({
    distance: 0,
    coins: 0,
    speed: level.baseSpeed,
    speedMultiplier: 1.0,
    isSlowed: false,
    shieldRemaining: 0,
    flyRemaining: 0,
    opponentDist: 0,
    opponentAlive: true,
    activeMilestone: null,
  });

  const [milestoneBanner, setMilestoneBanner] = useState<{
    title: string;
    subtitle: string;
    kind: StageMilestone['kind'];
  } | null>(null);

  const [powerBanner, setPowerBanner] = useState<{
    title: string;
    subtitle: string;
    kind: PowerGemKind;
  } | null>(null);

  const [playerCrashAlert, setPlayerCrashAlert] = useState<{
    reason: string;
  } | null>(null);

  const [botCrashAlert, setBotCrashAlert] = useState<{
    distance: number;
    name: string;
    subtitle?: string;
  } | null>(null);

  const milestoneTimeoutRef = useRef<number | null>(null);
  const powerTimeoutRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; handled: boolean } | null>(null);

  const sendToGodot = useCallback((payload: Record<string, unknown>) => {
    godotBridge.sendCommand(payload);
  }, []);

  // Subscribe to live events from the persistent Godot 4.7 instance
  useEffect(() => {
    const unsubscribe = godotBridge.onGameEvent((ev) => {
      const type = ev.type;
      if (typeof type !== 'string') return;

      if (type === 'hud') {
        const rawMs = ev.activeMilestone as
          | { milestone?: StageMilestone; remainingSec?: number }
          | null
          | undefined;
        const parsedMs: ActiveMilestoneHudState | null =
          rawMs && rawMs.milestone && typeof rawMs.remainingSec === 'number'
            ? { milestone: rawMs.milestone, remainingSec: rawMs.remainingSec }
            : null;

        setHudStats({
          distance: Number(ev.distance) || 0,
          coins: Number(ev.coins) || 0,
          speed: Number(ev.speed) || 0,
          speedMultiplier: Number(ev.speedMultiplier) || 1.0,
          isSlowed: Boolean(ev.isSlowed),
          shieldRemaining: Number(ev.shieldRemaining) || 0,
          flyRemaining: Number(ev.flyRemaining) || 0,
          opponentDist: Number(ev.opponentDist) || 0,
          opponentAlive: ev.opponentAlive !== false,
          activeMilestone: parsedMs,
        });
        return;
      }

      if (type === 'sfx') {
        const name = String(ev.name || '');
        if (name === 'lane') soundEngine.playLaneSwitch();
        else if (name === 'jump') soundEngine.playJump();
        else if (name === 'slide') soundEngine.playSlide();
        else if (name === 'coin') soundEngine.playCoin();
        else if (name === 'gem_shield') soundEngine.playPowerGem('SHIELD');
        else if (name === 'gem_fly') soundEngine.playPowerGem('FLY');
        else if (name === 'shield_deflect') soundEngine.playShieldDeflect();
        else if (name === 'slow_hit') soundEngine.playSlowHit();
        else if (name === 'crash' || name === 'bot_crash') soundEngine.playCrash();
        else if (name === 'win') soundEngine.playWin();
        else if (name === 'milestone') {
          const kind = (ev.arg as StageMilestone['kind']) || 'SPEED';
          soundEngine.playMilestone(kind);
        }
        return;
      }

      if (type === 'milestone_banner') {
        setMilestoneBanner({
          title: String(ev.title || ''),
          subtitle: String(ev.subtitle || ''),
          kind: (ev.kind as StageMilestone['kind']) || 'SPEED',
        });
        if (milestoneTimeoutRef.current !== null) {
          window.clearTimeout(milestoneTimeoutRef.current);
        }
        milestoneTimeoutRef.current = window.setTimeout(() => {
          setMilestoneBanner(null);
        }, 2400);
        return;
      }

      if (type === 'power_banner') {
        setPowerBanner({
          title: String(ev.title || ''),
          subtitle: String(ev.subtitle || ''),
          kind: ev.kind === 'FLY' ? 'FLY' : 'SHIELD',
        });
        if (powerTimeoutRef.current !== null) {
          window.clearTimeout(powerTimeoutRef.current);
        }
        powerTimeoutRef.current = window.setTimeout(() => {
          setPowerBanner(null);
        }, 1850);
        return;
      }

      if (type === 'player_crash') {
        const reason = String(ev.reason || 'Hit an obstacle');
        const dist = Math.max(0, Math.floor(Number(ev.distance) || 0));
        setPlayerCrashAlert({ reason });
        if (modeRef.current === 'ONLINE_MATCH') {
          multiplayerClient.reportCrash(dist, reason);
        }
        return;
      }

      if (type === 'bot_crash') {
        const subtitle =
          typeof ev.subtitle === 'string' && ev.subtitle.trim() ? ev.subtitle : undefined;
        setBotCrashAlert({
          distance: Math.max(0, Math.floor(Number(ev.distance) || 0)),
          name: String(ev.name || 'Apex Rival'),
          subtitle,
        });
        return;
      }

      if (type === 'net_update') {
        if (modeRef.current === 'ONLINE_MATCH') {
          const telemetry: PlayerUpdateTelemetry = {
            distance: Number(ev.distance) || 0,
            speed: Number(ev.speed) || 0,
            lane: (Number(ev.lane) || 0) as -1 | 0 | 1,
            targetLane: (Number(ev.targetLane) || 0) as -1 | 0 | 1,
            xOffset: Number(ev.xOffset) || 0,
            isJumping: Boolean(ev.isJumping),
            jumpProgress: Number(ev.jumpProgress) || 0,
            isSliding: Boolean(ev.isSliding),
            slideProgress: Number(ev.slideProgress) || 0,
            slowTimer: Number(ev.slowTimer) || 0,
            shieldTimer: Number(ev.shieldTimer) || 0,
            flyTimer: Number(ev.flyTimer) || 0,
            coins: Number(ev.coins) || 0,
          };
          multiplayerClient.sendPlayerUpdate(telemetry);
        }
        return;
      }

      if (type === 'player_finished_online') {
        if (modeRef.current === 'ONLINE_MATCH') {
          multiplayerClient.reportFinish(
            Number(ev.distance) || 1500,
            Number(ev.coins) || 0
          );
        }
        return;
      }

      if (type === 'game_over') {
        const rawReason =
          typeof ev.crashReason === 'string' && ev.crashReason.trim()
            ? ev.crashReason
            : undefined;
        onGameOverRef.current({
          won: Boolean(ev.won),
          distance: Math.max(0, Math.floor(Number(ev.distance) || 0)),
          goalDistance: Math.max(100, Math.floor(Number(ev.goalDistance) || 800)),
          stars: Number(ev.stars) || 0,
          coins: Number(ev.coins) || 0,
          crashReason: rawReason,
          opponentDistance: Number(ev.opponentDistance) || 0,
          opponentWon: Boolean(ev.opponentWon),
        });
      }
    });

    return () => {
      unsubscribe();
      godotBridge.sendCommand({ type: 'stop_race' });
      if (milestoneTimeoutRef.current !== null) {
        window.clearTimeout(milestoneTimeoutRef.current);
      }
      if (powerTimeoutRef.current !== null) {
        window.clearTimeout(powerTimeoutRef.current);
      }
    };
  }, []);

  // Start / Restart race immediately whenever runId, level, mode, or seed changes
  useEffect(() => {
    if (godotBoot.status === 'error') return;

    setPlayerCrashAlert(null);
    setBotCrashAlert(null);
    setMilestoneBanner(null);
    setPowerBanner(null);
    setHasAuthResult(false);
    setHudStats({
      distance: 0,
      coins: 0,
      speed: level.baseSpeed,
      speedMultiplier: 1.0,
      isSlowed: false,
      shieldRemaining: 0,
      flyRemaining: 0,
      opponentDist: 0,
      opponentAlive: true,
      activeMilestone: null,
    });

    const effectiveSeed =
      mode === 'ONLINE_MATCH'
        ? roomSeed ?? 123456
        : roomSeed ?? createRandomSeed();

    const roadGen = new RoadGenerator({
      seed: effectiveSeed,
      interval: level.obstacleInterval,
      allowedTraps: level.traps,
      speed: level.baseSpeed,
      milestones: level.milestones,
    });
    const obstacles = roadGen.generateUntil(level.goalDistance + 120);

    const playerCharacterId = gameStore.getState().selectedCharacterId || 'kai';

    sendToGodot({
      type: 'start_race',
      mode,
      level,
      seed: effectiveSeed,
      playerCharacterId,
      opponentCharacterId: opponentCharacterId || '',
      opponentName,
      isPaused,
      obstacles,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, level, mode, roomSeed, opponentName, opponentCharacterId, godotBoot.status, sendToGodot]);

  // Sync Pause state to Godot 4.7
  useEffect(() => {
    if (godotBoot.status === 'error') return;
    sendToGodot({
      type: 'pause',
      paused: isPaused,
    });
  }, [isPaused, godotBoot.status, sendToGodot]);

  // Subscribe to Online Match WebSocket events and forward into Godot 4.7
  useEffect(() => {
    if (mode !== 'ONLINE_MATCH' || godotBoot.status === 'error') return;

    const myClientId = multiplayerClient.getSnapshot().clientId;
    const unsubscribe = multiplayerClient.onEvent((event) => {
      if (event.type === 'opponent:update') {
        sendToGodot({
          ...event,
          type: 'online_opponent_update',
        });
        return;
      }

      if (event.type === 'opponent:crashed') {
        sendToGodot({
          type: 'online_opponent_crashed',
          distance: event.distance,
          reason: event.reason,
        });
        return;
      }

      if (event.type === 'match:clinched') {
        sendToGodot({
          type: 'online_match_clinched',
          crashedName: event.crashedName,
          crashedDistance: event.crashedDistance,
        });
        return;
      }

      if (event.type === 'opponent:left') {
        sendToGodot({
          type: 'online_opponent_left',
          distance: event.distance,
          playerName: event.playerName,
        });
        return;
      }

      if (event.type === 'match:result') {
        const iWon = event.winnerId === myClientId;
        setHasAuthResult(true);
        sendToGodot({
          type: 'online_match_result',
          won: iWon,
          reason: event.reason,
          opponentDistance: event.opponentDistance,
          opponentWon: !iWon,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [mode, runId, godotBoot.status, sendToGodot]);

  const triggerAction = useCallback(
    (action: 'left' | 'right' | 'jump' | 'slide') => {
      sendToGodot({ type: 'input', action });
    },
    [sendToGodot]
  );

  // Keyboard controls on parent window
  useEffect(() => {
    if (godotBoot.status === 'error') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        triggerAction('left');
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        triggerAction('right');
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key === ' ') {
        e.preventDefault();
        triggerAction('jump');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerAction('slide');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onPauseToggleRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [godotBoot.status, triggerAction]);

  // Touch swipe controls
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      handled: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start || start.handled || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.hypot(dx, dy) > 26) {
      start.handled = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        triggerAction(dx > 0 ? 'right' : 'left');
      } else {
        triggerAction(dy < 0 ? 'jump' : 'slide');
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden touch-none bg-transparent flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top-Left Milestone Map Bar, Power Gem Timers & Live Speed HUD Overlay */}
      <RaceHudOverlay
        level={level}
        mode={mode}
        distance={hudStats.distance}
        coins={hudStats.coins}
        speedKph={hudStats.speed}
        speedMultiplier={hudStats.speedMultiplier}
        isSlowed={hudStats.isSlowed}
        shieldRemaining={hudStats.shieldRemaining}
        flyRemaining={hudStats.flyRemaining}
        opponentName={opponentName}
        opponentDist={hudStats.opponentDist}
        opponentAlive={hudStats.opponentAlive}
        activeMilestone={hudStats.activeMilestone}
        onPauseToggle={onPauseToggle}
      />

      {/* Power Gem Pickup Callout */}
      {powerBanner && !playerCrashAlert && (
        <div
          className={`absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border shadow-xl flex flex-col items-center text-center z-20 pointer-events-none ${
            powerBanner.kind === 'SHIELD'
              ? 'bg-slate-950/95 border-cyan-400/65 text-cyan-200'
              : 'bg-slate-950/95 border-amber-400/65 text-amber-200'
          }`}
        >
          <div className="font-display font-extrabold text-xs uppercase tracking-wider">
            {powerBanner.title}
          </div>
          <div className="text-[11px] text-slate-300 tabular-nums mt-0.5">
            {powerBanner.subtitle}
          </div>
        </div>
      )}

      {/* Milestone Activation Callout */}
      {milestoneBanner && !powerBanner && !playerCrashAlert && (
        <div
          className={`absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border shadow-xl flex flex-col items-center text-center z-20 pointer-events-none ${
            milestoneBanner.kind === 'FOG'
              ? 'bg-slate-950/95 border-sky-400/60 text-sky-200'
              : milestoneBanner.kind === 'FOG_SPEED'
              ? 'bg-slate-950/95 border-violet-400/60 text-violet-200'
              : 'bg-slate-950/95 border-emerald-400/60 text-emerald-200'
          }`}
        >
          <div className="font-display font-extrabold text-xs uppercase tracking-wider">
            {milestoneBanner.title}
          </div>
          <div className="text-[11px] text-slate-300 tabular-nums mt-0.5">
            {milestoneBanner.subtitle}
          </div>
        </div>
      )}

      {/* Player Crash Banner */}
      {playerCrashAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-3 bg-rose-950/95 border border-rose-500 rounded-2xl shadow-2xl flex flex-col items-center text-center z-30 pointer-events-none">
          <div className="font-display font-extrabold text-sm uppercase tracking-wider text-rose-300">
            Wipeout ·{' '}
            <span className="font-sans font-medium text-slate-200 normal-case">
              {playerCrashAlert.reason}
            </span>
          </div>
          {mode === 'ONLINE_MATCH' && !hasAuthResult && hudStats.opponentAlive && (
            <div className="text-[11px] text-rose-200/85 tabular-nums mt-0.5">
              Watching {opponentName} ({hudStats.opponentDist} m)...
            </div>
          )}
        </div>
      )}

      {/* Impact Vignette */}
      {playerCrashAlert && (
        <div className="absolute inset-0 pointer-events-none z-20 bg-rose-950/25" />
      )}

      {/* Rival Crash Banner */}
      {botCrashAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-3 bg-slate-900/95 border border-emerald-500/60 rounded-2xl shadow-2xl flex flex-col items-center text-center z-30 pointer-events-none">
          <div className="text-xs font-display font-extrabold uppercase tracking-wider text-emerald-400">
            {botCrashAlert.name} {botCrashAlert.subtitle ? 'Out!' : 'Wiped Out!'}
          </div>
          <div className="text-[11px] text-slate-300 tabular-nums mt-0.5">
            {botCrashAlert.subtitle ||
              `Stopped at ${botCrashAlert.distance} m · Pass that mark to win`}
          </div>
        </div>
      )}

      {/* Zero-Delay Touch Action Controls */}
      <div className="absolute bottom-4 left-0 right-0 px-4 md:px-6 flex justify-between items-center pointer-events-auto z-10">
        <div className="flex space-x-2.5">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerAction('left');
            }}
            className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 border border-cyan-500/50 active:bg-cyan-500/30 active:scale-95 text-cyan-300 font-display font-extrabold text-xl flex items-center justify-center shadow-lg"
            aria-label="Move Left"
          >
            ◀
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerAction('right');
            }}
            className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 border border-cyan-500/50 active:bg-cyan-500/30 active:scale-95 text-cyan-300 font-display font-extrabold text-xl flex items-center justify-center shadow-lg"
            aria-label="Move Right"
          >
            ▶
          </button>
        </div>

        <div className="flex space-x-2.5">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerAction('slide');
            }}
            className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 border border-amber-500/50 active:bg-amber-500/30 active:scale-95 text-amber-300 font-display font-extrabold text-xs flex flex-col items-center justify-center shadow-lg"
            aria-label="Slide"
          >
            <span>▼</span>
            <span className="text-[10px] font-bold mt-0.5">SLIDE</span>
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerAction('jump');
            }}
            className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 border border-emerald-500/50 active:bg-emerald-500/30 active:scale-95 text-emerald-300 font-display font-extrabold text-xs flex flex-col items-center justify-center shadow-lg"
            aria-label="Jump"
          >
            <span>▲</span>
            <span className="text-[10px] font-bold mt-0.5">JUMP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
