import { useSyncExternalStore } from 'react';
import type { Lane } from '../types';

export interface OnlinePlayerSummary {
  id: string;
  name: string;
  characterId: string;
  isHost: boolean;
  connected: boolean;
  distance?: number;
  isAlive?: boolean;
}

export interface OnlineRoomSnapshot {
  connected: boolean;
  connecting: boolean;
  clientId: string;
  code: string | null;
  seed: number | null;
  goalDistance: number;
  status: 'IDLE' | 'WAITING' | 'RACING' | 'FINISHED';
  hostId: string | null;
  players: OnlinePlayerSummary[];
  error: string | null;
  closedNotice: string | null;
}

export interface PlayerUpdateTelemetry {
  distance: number;
  speed: number;
  lane: Lane;
  targetLane: Lane;
  xOffset: number;
  isJumping: boolean;
  jumpProgress: number;
  isSliding: boolean;
  slideProgress: number;
  slowTimer: number;
  shieldTimer?: number;
  flyTimer?: number;
  coins: number;
}

export type ServerGameEvent =
  | {
      type: 'match:started';
      code: string;
      seed: number;
      goalDistance: number;
      players: OnlinePlayerSummary[];
    }
  | {
      type: 'opponent:update';
      distance: number;
      speed: number;
      lane: Lane;
      targetLane: Lane;
      xOffset: number;
      isJumping: boolean;
      jumpProgress: number;
      isSliding: boolean;
      slideProgress: number;
      slowTimer: number;
      shieldTimer?: number;
      flyTimer?: number;
      coins: number;
    }
  | {
      type: 'opponent:crashed';
      playerId: string;
      playerName: string;
      distance: number;
      reason: string;
    }
  | {
      type: 'match:clinched';
      code: string;
      crashedName: string;
      crashedDistance: number;
    }
  | {
      type: 'opponent:left';
      code: string;
      playerName: string;
      distance: number;
    }
  | {
      type: 'match:result';
      code: string;
      winnerId: string;
      reason: string;
      yourDistance: number;
      opponentDistance: number;
      opponentFinished: boolean;
      opponentAlive: boolean;
    };

const TAB_CLIENT_KEY = 'MAZE_RUNNER_TAB_CLIENT_ID_V1';

function getOrCreateTabClientId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_CLIENT_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `RUN_${crypto.randomUUID().slice(0, 12).toUpperCase()}`
        : `RUN_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    sessionStorage.setItem(TAB_CLIENT_KEY, generated);
    return generated;
  } catch {
    return `RUN_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }
}

function resolveWebSocketUrl(): string {
  const raw = (
    (import.meta.env.VITE_WS_URL as string | undefined) ||
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
    ''
  ).trim();

  if (raw) {
    try {
      const normalized = raw
        .replace(/^https:\/\//i, 'wss://')
        .replace(/^http:\/\//i, 'ws://');
      const parsed = new URL(
        normalized.startsWith('ws://') || normalized.startsWith('wss://')
          ? normalized
          : `wss://${normalized}`
      );
      if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = '/ws';
      }
      return parsed.toString();
    } catch {
      return raw;
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

class MultiplayerSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private pendingQueue: string[] = [];
  private shouldStayConnected = false;
  private lastKnownProfile: { playerName: string; characterId: string } = {
    playerName: 'Striker',
    characterId: 'kai',
  };

  private snapshot: OnlineRoomSnapshot = {
    connected: false,
    connecting: false,
    clientId: getOrCreateTabClientId(),
    code: null,
    seed: null,
    goalDistance: 1500,
    status: 'IDLE',
    hostId: null,
    players: [],
    error: null,
    closedNotice: null,
  };

  private storeListeners = new Set<() => void>();
  private eventListeners = new Set<(event: ServerGameEvent) => void>();

  getSnapshot = (): OnlineRoomSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.storeListeners.add(listener);
    return () => {
      this.storeListeners.delete(listener);
    };
  };

  onEvent = (listener: (event: ServerGameEvent) => void): (() => void) => {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  };

  private emitStore(): void {
    this.storeListeners.forEach((fn) => fn());
  }

  private emitEvent(event: ServerGameEvent): void {
    this.eventListeners.forEach((fn) => fn(event));
  }

  private updateSnapshot(partial: Partial<OnlineRoomSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emitStore();
  }

  connect(): void {
    this.shouldStayConnected = true;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const wsUrl = resolveWebSocketUrl();

    this.updateSnapshot({ connecting: true });

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.updateSnapshot({ connected: true, connecting: false });

        // Reconcile room membership automatically on reconnect if client was in an active room
        if (this.snapshot.code && this.pendingQueue.length === 0) {
          this.sendRaw({
            type: 'room:join',
            code: this.snapshot.code,
            clientId: this.snapshot.clientId,
            playerName: this.lastKnownProfile.playerName,
            characterId: this.lastKnownProfile.characterId,
          });
        }

        while (this.pendingQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
          const msg = this.pendingQueue.shift();
          if (msg) socket.send(msg);
        }
      };

      socket.onmessage = (ev) => {
        if (this.ws !== socket) return;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = data.type;
        if (typeof type !== 'string') return;

        if (type === 'room:state') {
          const rawStatus = data.status;
          const status =
            rawStatus === 'WAITING' || rawStatus === 'RACING' || rawStatus === 'FINISHED'
              ? rawStatus
              : 'WAITING';
          this.updateSnapshot({
            code: typeof data.code === 'string' ? data.code : null,
            seed: typeof data.seed === 'number' ? data.seed : null,
            goalDistance: typeof data.goalDistance === 'number' ? data.goalDistance : 2000,
            status,
            hostId: typeof data.hostId === 'string' ? data.hostId : null,
            players: Array.isArray(data.players) ? (data.players as OnlinePlayerSummary[]) : [],
            error: null,
            closedNotice: null,
          });
          return;
        }

        if (type === 'room:error') {
          this.updateSnapshot({
            error:
              typeof data.message === 'string'
                ? data.message
                : 'Unable to join room. Please try again.',
          });
          return;
        }

        if (type === 'room:closed') {
          this.updateSnapshot({
            code: null,
            seed: null,
            status: 'IDLE',
            hostId: null,
            players: [],
            error: null,
            closedNotice:
              typeof data.message === 'string' ? data.message : 'The room was closed by the host.',
          });
          return;
        }

        if (type === 'match:started') {
          const players = Array.isArray(data.players)
            ? (data.players as OnlinePlayerSummary[])
            : this.snapshot.players;
          const seed = typeof data.seed === 'number' ? data.seed : this.snapshot.seed ?? 123456;
          const goalDistance =
            typeof data.goalDistance === 'number' ? data.goalDistance : 2000;
          const code = typeof data.code === 'string' ? data.code : this.snapshot.code ?? '';

          this.updateSnapshot({
            code,
            seed,
            goalDistance,
            status: 'RACING',
            players,
            error: null,
            closedNotice: null,
          });

          this.emitEvent({
            type: 'match:started',
            code,
            seed,
            goalDistance,
            players,
          });
          return;
        }

        if (
          type === 'opponent:update' ||
          type === 'opponent:crashed' ||
          type === 'match:clinched' ||
          type === 'opponent:left' ||
          type === 'match:result'
        ) {
          if (type === 'match:result') {
            this.updateSnapshot({ status: 'FINISHED' });
          }
          this.emitEvent(data as unknown as ServerGameEvent);
        }
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.ws = null;
        this.updateSnapshot({ connected: false, connecting: false });

        if (this.shouldStayConnected) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 1200);
        }
      };

      socket.onerror = () => {
        // Handled cleanly in onclose
      };
    } catch {
      this.updateSnapshot({
        connected: false,
        connecting: false,
        error: 'Unable to reach race server.',
      });
    }
  }

  private sendRaw(payload: Record<string, unknown>, queueIfConnecting = true): void {
    const serialized = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
      return;
    }
    if (queueIfConnecting) {
      if (this.pendingQueue.length < 32) {
        this.pendingQueue.push(serialized);
      }
      this.connect();
    }
  }

  clearNotices(): void {
    if (this.snapshot.error || this.snapshot.closedNotice) {
      this.updateSnapshot({ error: null, closedNotice: null });
    }
  }

  createRoom(playerName: string, characterId: string): void {
    this.lastKnownProfile = { playerName, characterId };
    this.updateSnapshot({ error: null, closedNotice: null });
    this.connect();
    this.sendRaw({
      type: 'room:create',
      clientId: this.snapshot.clientId,
      playerName,
      characterId,
    });
  }

  joinRoom(code: string, playerName: string, characterId: string): void {
    const cleanCode = code.trim().toUpperCase();
    this.lastKnownProfile = { playerName, characterId };
    this.updateSnapshot({ error: null, closedNotice: null });
    this.connect();
    this.sendRaw({
      type: 'room:join',
      code: cleanCode,
      clientId: this.snapshot.clientId,
      playerName,
      characterId,
    });
  }

  updateProfile(playerName: string, characterId: string): void {
    this.lastKnownProfile = { playerName, characterId };
    if (this.snapshot.code && this.snapshot.status === 'WAITING') {
      this.sendRaw(
        {
          type: 'player:profile',
          playerName,
          characterId,
        },
        false
      );
    }
  }

  startMatch(): void {
    this.updateSnapshot({ error: null });
    this.sendRaw({ type: 'match:start' });
  }

  resetRoomForRematch(): void {
    if (!this.snapshot.code) return;
    this.sendRaw({ type: 'room:reset' });
  }

  leaveRoom(): void {
    if (this.snapshot.code) {
      this.sendRaw({ type: 'room:leave' }, false);
    }
    this.pendingQueue = [];
    this.updateSnapshot({
      code: null,
      seed: null,
      status: 'IDLE',
      hostId: null,
      players: [],
      error: null,
      closedNotice: null,
    });
  }

  sendPlayerUpdate(telemetry: PlayerUpdateTelemetry): void {
    if (!this.snapshot.code) return;
    this.sendRaw(
      {
        type: 'player:update',
        ...telemetry,
      },
      false
    );
  }

  reportCrash(distance: number, reason: string): void {
    if (!this.snapshot.code) return;
    this.sendRaw({
      type: 'player:crashed',
      distance,
      reason,
    });
  }

  reportFinish(distance: number, coins: number): void {
    if (!this.snapshot.code) return;
    this.sendRaw({
      type: 'player:finished',
      distance,
      coins,
    });
  }
}

export const multiplayerClient = new MultiplayerSocketClient();

export function useOnlineRoom(): OnlineRoomSnapshot {
  return useSyncExternalStore(multiplayerClient.subscribe, multiplayerClient.getSnapshot);
}
