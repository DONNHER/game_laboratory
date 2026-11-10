import React, { useEffect, useRef } from 'react';
import {
  ensureGodotGlobalBridge,
  godotBridge,
  GodotHostWindow,
  useGodotBootState,
} from './godotBridge';
import { RotateCcw } from 'lucide-react';

// Ensure parent message/mount listeners are attached before the iframe begins loading
ensureGodotGlobalBridge();

interface PersistentGodotViewportProps {
  visible: boolean;
}

export const PersistentGodotViewport: React.FC<PersistentGodotViewportProps> = ({
  visible,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { bootAttempt } = useGodotBootState();

  useEffect(() => {
    ensureGodotGlobalBridge();
    if (iframeRef.current?.contentWindow) {
      godotBridge.attachHostWindow(
        iframeRef.current.contentWindow as GodotHostWindow
      );
    }
  }, [bootAttempt]);

  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const hostSrc = `${normalizedBase}godot/host.html?v=${bootAttempt}`;

  return (
    <iframe
      key={`godot_host_${bootAttempt}`}
      ref={iframeRef}
      src={hostSrc}
      data-godot-host="true"
      title="Maze Runner Godot 4.7 Persistent 3D Engine"
      tabIndex={-1}
      onLoad={() => {
        godotBridge.attachHostWindow(
          iframeRef.current?.contentWindow as GodotHostWindow | null
        );
      }}
      className={`absolute inset-0 w-full h-full border-0 pointer-events-none z-0 transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
};

interface EngineBootScreenProps {
  progressPct: number;
  stageLabel: string;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export const EngineBootScreen: React.FC<EngineBootScreenProps> = ({
  progressPct,
  stageLabel,
  errorMessage,
  onRetry,
}) => {
  const clampedPct = Math.max(0, Math.min(100, Math.round(progressPct)));

  return (
    <div className="relative z-30 w-full h-full flex flex-col items-center justify-center px-6 py-8 bg-slate-950/92 cyber-grid text-center">
      {/* Ambient Radial Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center">
        <p className="font-display font-bold text-[11px] uppercase tracking-[0.28em] text-cyan-400 mb-2">
          HIGH-SPEED NEON CIRCUIT
        </p>

        <h1 className="font-display font-extrabold text-5xl sm:text-6xl text-slate-50 tracking-tight leading-[0.92]">
          MAZE
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
            RUNNER
          </span>
        </h1>

        {/* Progress Bar Container */}
        <div className="mt-9 w-full">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-display font-bold uppercase tracking-wider text-slate-300">
              Godot Engine 4.7 3D
            </span>
            <span className="font-display font-extrabold text-cyan-400 tabular-nums">
              {clampedPct}%
            </span>
          </div>

          <progress
            value={clampedPct}
            max={100}
            className="w-full h-2.5 rounded-full overflow-hidden bg-slate-800 accent-cyan-400 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-cyan-400 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-150 [&::-moz-progress-bar]:bg-cyan-400"
          />

          <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
            {errorMessage || stageLabel}
          </p>

          {errorMessage && onRetry && (
            <button
              onClick={onRetry}
              className="mt-5 w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
            >
              <RotateCcw size={15} />
              <span>Retry 3D Engine Load</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
