import { useSyncExternalStore } from 'react';

export interface GodotHostWindow extends Window {
  __attachReactBridge?: (listener: (envelopeStr: string) => void) => void;
  __sendToGodot?: (jsonStr: string) => void;
}

declare global {
  interface Window {
    __onGodotHostMounted?: (hostWin: GodotHostWindow) => void;
  }
}

export interface GodotBootSnapshot {
  status: 'booting' | 'ready' | 'error';
  progressPct: number;
  stageLabel: string;
  errorMessage: string | null;
  engineVersion: string;
  bootAttempt: number;
}

type GameEventListener = (ev: Record<string, unknown>) => void;

let snapshot: GodotBootSnapshot = {
  status: 'booting',
  progressPct: 0,
  stageLabel: 'Downloading Godot 4.7 3D Engine...',
  errorMessage: null,
  engineVersion: '4.7.2-stable',
  bootAttempt: 1,
};

const stateListeners = new Set<() => void>();
const gameEventListeners = new Set<GameEventListener>();

let hostWin: GodotHostWindow | null = null;
let lastReceivedSeq = 0;
let queuedLifecycleCmd: string | null = null;
let bridgeInitialized = false;
let handshakeTimer: number | null = null;

function emitStateChange(): void {
  stateListeners.forEach((fn) => fn());
}

function updateSnapshot(partial: Partial<GodotBootSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  emitStateChange();
}

function clearHandshakeWatchdog(): void {
  if (handshakeTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(handshakeTimer);
    handshakeTimer = null;
  }
}

function armHandshakeWatchdog(): void {
  if (typeof window === 'undefined') return;
  clearHandshakeWatchdog();

  if (window.location.protocol === 'file:') {
    updateSnapshot({
      status: 'error',
      errorMessage:
        'Cannot load Godot 4.7 WebAssembly over file://. Run "pnpm run dev" and open http://localhost:3000 (or install the built APK).',
      stageLabel: 'Local Server Required',
    });
    return;
  }

  handshakeTimer = window.setTimeout(() => {
    if (snapshot.status === 'booting' && snapshot.progressPct === 0) {
      updateSnapshot({
        status: 'error',
        errorMessage:
          'Godot 4.7 host did not respond at /godot/host.html. Ensure the server is running ("pnpm run dev") and refresh or tap Retry.',
        stageLabel: 'Unable to Reach 3D Engine Assets',
      });
    }
  }, 12000);
}

function processGodotPayload(ev: Record<string, unknown>, seq?: number): void {
  if (typeof seq === 'number' && seq > 0) {
    if (seq <= lastReceivedSeq) return;
    lastReceivedSeq = seq;
  }

  const type = ev.type;
  if (typeof type !== 'string') return;

  if (type === 'boot_progress') {
    clearHandshakeWatchdog();
    if (snapshot.status === 'ready') return;
    const phase = typeof ev.phase === 'string' ? ev.phase : 'download';
    const explicitPct = typeof ev.pct === 'number' && Number.isFinite(ev.pct) ? ev.pct : null;

    let pct = snapshot.progressPct;
    let label = 'Downloading Godot 4.7 3D Engine...';

    if (phase === 'connect') {
      pct = Math.max(snapshot.progressPct, Math.min(10, Math.round(explicitPct ?? 2)));
      label = 'Initializing Godot 4.7 Runtime...';
    } else if (phase === 'decompress') {
      pct = Math.max(snapshot.progressPct, Math.min(90, Math.round(explicitPct ?? 86)));
      label = 'Unpacking 3D Engine Binary...';
    } else if (phase === 'compile') {
      pct = Math.max(snapshot.progressPct, Math.min(94, Math.round(explicitPct ?? 91)));
      label = 'Compiling WebAssembly Runtime...';
    } else if (phase === 'scene') {
      pct = Math.max(snapshot.progressPct, Math.min(99, Math.round(explicitPct ?? 96)));
      label = 'Loading 3D Scenes & Shaders...';
    } else {
      if (explicitPct !== null && explicitPct > 0) {
        pct = Math.max(snapshot.progressPct, Math.min(88, Math.round(explicitPct)));
      } else {
        const current = Math.max(0, Number(ev.current) || 0);
        const total = Math.max(1, Number(ev.total) || 39722166);
        const ratio = Math.min(1, current / total);
        const computed = current > 0 ? Math.max(1, Math.round(ratio * 84)) : 0;
        pct = Math.max(snapshot.progressPct, Math.min(88, computed));
      }
      if (pct >= 82) {
        label = 'Finalizing Engine Download...';
      }
    }

    updateSnapshot({
      status: 'booting',
      errorMessage: null,
      progressPct: pct,
      stageLabel: label,
    });
    return;
  }

  if (type === 'boot_error') {
    clearHandshakeWatchdog();
    const message =
      typeof ev.message === 'string' && ev.message.trim()
        ? ev.message.trim()
        : '3D Engine initialization interrupted';
    updateSnapshot({
      status: 'error',
      errorMessage: message,
      stageLabel: 'Unable to finish loading 3D Engine',
    });
    return;
  }

  if (type === 'ready') {
    clearHandshakeWatchdog();
    const ver =
      typeof ev.engineVersion === 'string' && ev.engineVersion.trim()
        ? ev.engineVersion
        : '4.7.2-stable';
    updateSnapshot({
      status: 'ready',
      progressPct: 100,
      errorMessage: null,
      engineVersion: ver,
      stageLabel: '3D Circuit Ready',
    });

    if (queuedLifecycleCmd && hostWin && typeof hostWin.__sendToGodot === 'function') {
      const cmdToSend = queuedLifecycleCmd;
      queuedLifecycleCmd = null;
      hostWin.__sendToGodot(cmdToSend);
    }
    return;
  }

  gameEventListeners.forEach((listener) => listener(ev));
}

function handleEnvelopeString(rawStr: string): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawStr) as Record<string, unknown>;
  } catch {
    return;
  }

  if (
    parsed &&
    parsed.__envelope === true &&
    typeof parsed.payload === 'object' &&
    parsed.payload !== null
  ) {
    processGodotPayload(
      parsed.payload as Record<string, unknown>,
      typeof parsed.seq === 'number' ? parsed.seq : undefined
    );
    return;
  }

  processGodotPayload(parsed);
}

export function ensureGodotGlobalBridge(): void {
  if (bridgeInitialized || typeof window === 'undefined') return;
  bridgeInitialized = true;

  armHandshakeWatchdog();

  window.__onGodotHostMounted = (win: GodotHostWindow) => {
    godotBridge.attachHostWindow(win);
  };

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const record = data as Record<string, unknown>;
    if (record.source !== 'maze_runner_godot') return;

    if (event.source && !hostWin) {
      godotBridge.attachHostWindow(event.source as GodotHostWindow);
    }

    if (typeof record.envelope === 'string') {
      handleEnvelopeString(record.envelope);
    } else if (typeof record.payload === 'object' && record.payload !== null) {
      processGodotPayload(
        record.payload as Record<string, unknown>,
        typeof record.seq === 'number' ? record.seq : undefined
      );
    }
  });
}

export const godotBridge = {
  getSnapshot: (): GodotBootSnapshot => snapshot,

  subscribe: (listener: () => void): (() => void) => {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  },

  onGameEvent: (listener: GameEventListener): (() => void) => {
    gameEventListeners.add(listener);
    return () => gameEventListeners.delete(listener);
  },

  retryBoot: (): void => {
    hostWin = null;
    lastReceivedSeq = 0;
    updateSnapshot({
      status: 'booting',
      progressPct: 0,
      stageLabel: 'Downloading Godot 4.7 3D Engine...',
      errorMessage: null,
      bootAttempt: snapshot.bootAttempt + 1,
    });
    armHandshakeWatchdog();
  },

  attachHostWindow: (win: GodotHostWindow | null): void => {
    if (!win) return;
    if (hostWin !== win) {
      hostWin = win;
      lastReceivedSeq = 0;
    }
    try {
      if (typeof win.__attachReactBridge === 'function') {
        win.__attachReactBridge(handleEnvelopeString);
      }
      if (
        snapshot.status === 'ready' &&
        queuedLifecycleCmd &&
        typeof win.__sendToGodot === 'function'
      ) {
        const cmd = queuedLifecycleCmd;
        queuedLifecycleCmd = null;
        win.__sendToGodot(cmd);
      }
    } catch {
      // Ignore transient iframe access timing; postMessage handles fallback
    }
  },

  sendCommand: (payload: Record<string, unknown>): void => {
    const serialized = JSON.stringify(payload);
    if (
      payload.type === 'start_race' ||
      payload.type === 'stop_race' ||
      payload.type === 'start_showcase' ||
      payload.type === 'stop_showcase'
    ) {
      queuedLifecycleCmd = serialized;
    }

    if (hostWin && typeof hostWin.__sendToGodot === 'function') {
      hostWin.__sendToGodot(serialized);
      if (snapshot.status === 'ready') {
        queuedLifecycleCmd = null;
      }
    }
  },
};

export function useGodotBootState(): GodotBootSnapshot {
  return useSyncExternalStore(godotBridge.subscribe, godotBridge.getSnapshot);
}
