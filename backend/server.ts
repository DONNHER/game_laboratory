import express from 'express';
import { config as loadDotenv } from 'dotenv';
import { randomInt, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { mountNeonRoutes } from './neon-routes.js';
import { Redis } from '@upstash/redis';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(backendDirectory, '.env.local') });

type Lane = -1 | 0 | 1;
type RoomStatus = 'WAITING' | 'RACING' | 'FINISHED';

interface RoomPlayer {
  id: string;
  name: string;
  characterId: string;
  isHost: boolean;
  connected: boolean;
  ws: WebSocket | null;
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
  shieldTimer: number;
  flyTimer: number;
  coins: number;
  isAlive: boolean;
  crashReason: string | null;
  crashedAt: number | null;
  finished: boolean;
  finishedAt: number | null;
  notifiedResult: boolean;
  notifiedClinched: boolean;
}

interface GameRoom {
  code: string;
  seed: number;
  goalDistance: number;
  status: RoomStatus;
  hostId: string;
  players: Map<string, RoomPlayer>;
  winnerId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface TrackedSocket extends WebSocket {
  isAliveSocket?: boolean;
  clientId?: string;
  roomCode?: string;
}

const PORT = Number(process.env.PORT) || 3000;
const GOAL_DISTANCE = 1500;
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VALID_CHARACTERS = new Set(['kai', 'blaze', 'nova', 'luna', 'zephyr']);
const CUSTOM_CHARACTER_ID_RE = /^[a-z0-9_-]{2,32}$/;

const rooms = new Map<string, GameRoom>();
const localSockets = new Map<string, TrackedSocket>();
const instanceId = randomUUID();
const roomEventChannel = 'maze-runner:room-events';
const roomKeyPrefix = 'maze-runner:room:';
const roomLockPrefix = 'maze-runner:room-lock:';
const hasRedisCredentials =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const sharedRedis = hasRedisCredentials
  ? Redis.fromEnv({ enableTelemetry: false })
  : null;

interface StoredRoom extends Omit<GameRoom, 'players'> {
  players: Array<Omit<RoomPlayer, 'ws'>>;
}

type RoomRelayEvent =
  | { type: 'room-updated'; origin: string; room: StoredRoom }
  | { type: 'room-removed'; origin: string; code: string }
  | { type: 'player-message'; recipientId: string; payload: Record<string, unknown> };

function serializeRoom(room: GameRoom): StoredRoom {
  return {
    ...room,
    players: Array.from(room.players.values(), ({ ws: _ws, ...player }) => player),
  };
}

function hydrateRoom(room: StoredRoom): GameRoom {
  return {
    ...room,
    players: new Map(
      room.players.map((player) => [
        player.id,
        { ...player, ws: localSockets.get(player.id) ?? null },
      ])
    ),
  };
}

function publishRoomEvent(event: RoomRelayEvent): void {
  if (!sharedRedis) return;
  void sharedRedis.publish(roomEventChannel, event).catch((error: unknown) => {
    console.error('Could not publish a multiplayer room event:', error);
  });
}

async function saveRoom(room: GameRoom): Promise<void> {
  rooms.set(room.code, room);
  if (!sharedRedis) return;
  const storedRoom = serializeRoom(room);
  await sharedRedis.set(`${roomKeyPrefix}${room.code}`, storedRoom, { ex: 1800 });
  publishRoomEvent({ type: 'room-updated', origin: instanceId, room: storedRoom });
}

async function removeSharedRoom(code: string): Promise<void> {
  rooms.delete(code);
  if (!sharedRedis) return;
  await sharedRedis.del(`${roomKeyPrefix}${code}`);
  publishRoomEvent({ type: 'room-removed', origin: instanceId, code });
}

async function startRoomRelay(): Promise<void> {
  if (!sharedRedis) {
    if (process.env.VERCEL) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required on Vercel.');
    }
    return;
  }

  const subscriber = sharedRedis.subscribe<RoomRelayEvent>(roomEventChannel);
  subscriber.on('message', ({ message }) => {
    if ('origin' in message && message.origin === instanceId) return;
    if (message.type === 'room-updated') {
      rooms.set(message.room.code, hydrateRoom(message.room));
      return;
    }
    if (message.type === 'room-removed') {
      rooms.delete(message.code);
      return;
    }
    const socket = localSockets.get(message.recipientId);
    if (socket) sendJson(socket, message.payload);
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out while connecting the multiplayer Redis relay.'));
    }, 10000);
    subscriber.on('subscribe', () => {
      clearTimeout(timeout);
      resolve();
    });
    subscriber.on('error', (error) => {
      console.error('Multiplayer Redis relay error:', error);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function withRoomLock<T>(code: string, operation: () => Promise<T> | T): Promise<T> {
  if (!sharedRedis) return operation();

  const lockKey = `${roomLockPrefix}${code}`;
  const token = randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await sharedRedis.set(lockKey, token, { nx: true, ex: 15 });
    if (result === 'OK') {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!acquired) {
    throw new Error(`Could not acquire the multiplayer room lock for ${code}.`);
  }

  try {
    if (code !== '__create__') {
      const room = await sharedRedis.get<StoredRoom>(`${roomKeyPrefix}${code}`);
      if (room) rooms.set(code, hydrateRoom(room));
      else rooms.delete(code);
    }
    return await operation();
  } finally {
    await sharedRedis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      [lockKey],
      [token]
    );
  }
}

function generateSeed(): number {
  return randomInt(100000, 2147483647);
}

async function generateRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ROOM_CHARS.charAt(Math.floor(Math.random() * ROOM_CHARS.length));
    }
    const exists = sharedRedis
      ? await sharedRedis.exists(`${roomKeyPrefix}${code}`)
      : rooms.has(code);
    if (!exists) {
      return code;
    }
  }
  throw new Error('Could not generate an available multiplayer room code.');
}

function sanitizeName(raw: unknown, fallback = 'Runner'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, 16);
  return cleaned || fallback;
}

function sanitizeCharacter(raw: unknown): string {
  if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase();
    if (VALID_CHARACTERS.has(cleaned) || CUSTOM_CHARACTER_ID_RE.test(cleaned)) {
      return cleaned;
    }
  }
  return 'kai';
}

function clampLane(val: unknown): Lane {
  if (val === -1 || val === 0 || val === 1) return val;
  return 0;
}

function createFreshPlayer(
  id: string,
  name: string,
  characterId: string,
  isHost: boolean,
  ws: WebSocket
): RoomPlayer {
  return {
    id,
    name,
    characterId,
    isHost,
    connected: true,
    ws,
    distance: 0,
    speed: 0,
    lane: 0,
    targetLane: 0,
    xOffset: 0,
    isJumping: false,
    jumpProgress: 0,
    isSliding: false,
    slideProgress: 0,
    slowTimer: 0,
    shieldTimer: 0,
    flyTimer: 0,
    coins: 0,
    isAlive: true,
    crashReason: null,
    crashedAt: null,
    finished: false,
    finishedAt: null,
    notifiedResult: false,
    notifiedClinched: false,
  };
}

function resetPlayerMetrics(player: RoomPlayer): void {
  player.distance = 0;
  player.speed = 0;
  player.lane = 0;
  player.targetLane = 0;
  player.xOffset = 0;
  player.isJumping = false;
  player.jumpProgress = 0;
  player.isSliding = false;
  player.slideProgress = 0;
  player.slowTimer = 0;
  player.shieldTimer = 0;
  player.flyTimer = 0;
  player.coins = 0;
  player.isAlive = true;
  player.crashReason = null;
  player.crashedAt = null;
  player.finished = false;
  player.finishedAt = null;
  player.notifiedResult = false;
  player.notifiedClinched = false;
}

function sendJson(ws: WebSocket | null, payload: Record<string, unknown>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore transient socket write errors
  }
}

function sendPlayer(player: RoomPlayer, payload: Record<string, unknown>): void {
  const socket = localSockets.get(player.id) ?? player.ws;
  if (socket) {
    sendJson(socket, payload);
    return;
  }
  publishRoomEvent({ type: 'player-message', recipientId: player.id, payload });
}

function serializeRoomState(room: GameRoom) {
  return {
    type: 'room:state',
    code: room.code,
    seed: room.seed,
    goalDistance: room.goalDistance,
    status: room.status,
    hostId: room.hostId,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      characterId: p.characterId,
      isHost: p.isHost,
      connected: p.connected,
      distance: Math.floor(p.distance),
      isAlive: p.isAlive,
    })),
  };
}

function broadcastRoomState(room: GameRoom): void {
  const stateMsg = serializeRoomState(room);
  for (const player of room.players.values()) {
    sendPlayer(player, stateMsg);
  }
}

function getOtherPlayer(room: GameRoom, playerId: string): RoomPlayer | undefined {
  for (const [id, player] of room.players.entries()) {
    if (id !== playerId) return player;
  }
  return undefined;
}

function sendMatchResultToPlayer(
  room: GameRoom,
  recipient: RoomPlayer,
  winnerId: string,
  reason: string
): void {
  if (recipient.notifiedResult) return;
  recipient.notifiedResult = true;
  const opponent = getOtherPlayer(room, recipient.id);
  sendPlayer(recipient, {
    type: 'match:result',
    code: room.code,
    winnerId,
    reason,
    yourDistance: Math.max(0, Math.floor(recipient.distance)),
    opponentDistance: opponent ? Math.max(0, Math.floor(opponent.distance)) : 0,
    opponentFinished: opponent ? opponent.finished : false,
    opponentAlive: opponent ? opponent.isAlive : false,
  });
}

function evaluateCrashResolution(room: GameRoom): void {
  if (room.status !== 'RACING') return;
  const players = Array.from(room.players.values());
  if (players.length < 2) return;

  const [p1, p2] = players;

  // Case 1: Both players have crashed -> higher distance wins (tie-breaker: who crashed later)
  if (!p1.isAlive && !p2.isAlive) {
    let winner = p1;
    let loser = p2;
    if (p2.distance > p1.distance) {
      winner = p2;
      loser = p1;
    } else if (
      p2.distance === p1.distance &&
      (p2.crashedAt ?? 0) > (p1.crashedAt ?? 0)
    ) {
      winner = p2;
      loser = p1;
    }

    room.winnerId = winner.id;
    room.status = 'FINISHED';
    room.updatedAt = Date.now();

    sendMatchResultToPlayer(
      room,
      winner,
      winner.id,
      `You outlasted ${loser.name}, who wiped out at ${Math.floor(loser.distance).toLocaleString()} m.`
    );
    sendMatchResultToPlayer(
      room,
      loser,
      winner.id,
      loser.crashReason || 'A collision brought your run to a halt.'
    );
    return;
  }

  // Case 2: One player crashed, the other is still alive and already strictly ahead
  const crashed = !p1.isAlive ? p1 : !p2.isAlive ? p2 : null;
  const alive = p1.isAlive ? p1 : p2.isAlive ? p2 : null;

  if (crashed && alive && alive.distance > crashed.distance) {
    room.winnerId = alive.id;

    // Immediately release the crashed player to their ResultScreen so they don't wait
    sendMatchResultToPlayer(
      room,
      crashed,
      alive.id,
      crashed.crashReason || `${alive.name} passed your ${Math.floor(crashed.distance).toLocaleString()} m mark!`
    );

    // Notify surviving player once that victory is mathematically clinched while they keep running
    if (!alive.notifiedClinched) {
      alive.notifiedClinched = true;
      sendPlayer(alive, {
        type: 'match:clinched',
        code: room.code,
        crashedName: crashed.name,
        crashedDistance: Math.max(0, Math.floor(crashed.distance)),
      });
    }
  }
}

function removeClientFromCurrentRoom(ws: TrackedSocket, explicitLeave: boolean): void {
  const code = ws.roomCode;
  const clientId = ws.clientId;
  if (!code || !clientId) return;

  ws.roomCode = undefined;
  const room = rooms.get(code);
  if (!room) return;

  const leavingPlayer = room.players.get(clientId);
  if (!leavingPlayer) return;

  // Guard against stale socket closing after client already reconnected with a newer socket
  if (!explicitLeave && leavingPlayer.ws && leavingPlayer.ws !== ws) {
    return;
  }

  const remainingPlayer = getOtherPlayer(room, clientId);

  if (room.status === 'RACING') {
    leavingPlayer.connected = false;
    leavingPlayer.ws = null;
    leavingPlayer.isAlive = false;
    leavingPlayer.crashReason = 'Left the race';
    leavingPlayer.crashedAt = Date.now();
    room.players.delete(clientId);
    room.updatedAt = Date.now();

    if (remainingPlayer && remainingPlayer.connected) {
      room.winnerId = remainingPlayer.id;
      room.status = 'FINISHED';
      room.hostId = remainingPlayer.id;
      remainingPlayer.isHost = true;

      sendPlayer(remainingPlayer, {
        type: 'opponent:left',
        code: room.code,
        playerName: leavingPlayer.name,
        distance: Math.max(0, Math.floor(leavingPlayer.distance)),
      });

      sendMatchResultToPlayer(
        room,
        remainingPlayer,
        remainingPlayer.id,
        `${leavingPlayer.name} left the race — victory awarded!`
      );
    } else {
      rooms.delete(code);
    }
    return;
  }

  // Room is WAITING or FINISHED
  room.players.delete(clientId);
  room.updatedAt = Date.now();

  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }

  if (leavingPlayer.isHost && room.status === 'WAITING') {
    // Host closed the waiting room: notify challenger and close room cleanly
    if (remainingPlayer) {
      if (remainingPlayer.ws) {
        (remainingPlayer.ws as TrackedSocket).roomCode = undefined;
      }
      sendPlayer(remainingPlayer, {
        type: 'room:closed',
        code: room.code,
        message: `${leavingPlayer.name} closed the room.`,
      });
    }
    rooms.delete(code);
    return;
  }

  // Remaining player becomes host in waiting state with fresh seed
  if (remainingPlayer) {
    room.hostId = remainingPlayer.id;
    remainingPlayer.isHost = true;
    room.status = 'WAITING';
    room.seed = generateSeed();
    room.winnerId = null;
    resetPlayerMetrics(remainingPlayer);
    broadcastRoomState(room);
  }
}

function leaveSocketRoom(ws: TrackedSocket): void {
  const code = ws.roomCode;
  const clientId = ws.clientId;
  if (!code || !clientId) {
    if (clientId && localSockets.get(clientId) === ws) localSockets.delete(clientId);
    return;
  }

  void withRoomLock(code, async () => {
    removeClientFromCurrentRoom(ws, false);
    if (localSockets.get(clientId) === ws) localSockets.delete(clientId);
    const room = rooms.get(code);
    if (room) await saveRoom(room);
    else await removeSharedRoom(code);
  }).catch((error: unknown) => {
    console.error('Could not remove a disconnected player from its room:', error);
    if (localSockets.get(clientId) === ws) localSockets.delete(clientId);
  });
}

function attachWebSocketHandlers(wss: WebSocketServer): void {
  wss.on('connection', (rawWs: WebSocket, _req: IncomingMessage) => {
    const ws = rawWs as TrackedSocket;
    ws.isAliveSocket = true;

    ws.on('pong', () => {
      ws.isAliveSocket = true;
    });

    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(rawData)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type;
      if (typeof type !== 'string') return;

      const requestedRoomCode = type === 'room:join' && typeof msg.code === 'string'
        ? msg.code.trim().toUpperCase()
        : null;
      const roomLockCode = type === 'room:create'
        ? '__create__'
        : requestedRoomCode ?? ws.roomCode;
      if (!roomLockCode) return;

      const processMessage = async () => {
        const previousRoomCode = ws.roomCode;
        if (
          previousRoomCode &&
          previousRoomCode !== roomLockCode &&
          (type === 'room:create' || type === 'room:join')
        ) {
          await withRoomLock(previousRoomCode, async () => {
            removeClientFromCurrentRoom(ws, true);
            const previousRoom = rooms.get(previousRoomCode);
            if (previousRoom) await saveRoom(previousRoom);
            else await removeSharedRoom(previousRoomCode);
          });
        }

        await withRoomLock(roomLockCode, async () => {
          try {
      if (type === 'room:create') {
        const clientId =
          typeof msg.clientId === 'string' && msg.clientId.trim()
            ? msg.clientId.trim().slice(0, 64)
            : `P_${Math.random().toString(36).slice(2, 10)}`;
        const playerName = sanitizeName(msg.playerName, 'Striker');
        const characterId = sanitizeCharacter(msg.characterId);

        const code = await generateRoomCode();
        const seed = generateSeed();
        const hostPlayer = createFreshPlayer(clientId, playerName, characterId, true, ws);

        const room: GameRoom = {
          code,
          seed,
          goalDistance: GOAL_DISTANCE,
          status: 'WAITING',
          hostId: clientId,
          players: new Map([[clientId, hostPlayer]]),
          winnerId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        localSockets.set(clientId, ws);
        rooms.set(code, room);
        ws.clientId = clientId;
        ws.roomCode = code;

        broadcastRoomState(room);
        return;
      }

      if (type === 'room:join') {
        const rawCode = requestedRoomCode ?? '';
        const clientId =
          typeof msg.clientId === 'string' && msg.clientId.trim()
            ? msg.clientId.trim().slice(0, 64)
            : `P_${Math.random().toString(36).slice(2, 10)}`;
        const rawName = sanitizeName(msg.playerName, 'Challenger');
        const characterId = sanitizeCharacter(msg.characterId);

        if (rawCode.length !== 4) {
          sendJson(ws, {
            type: 'room:error',
            message: 'Enter a valid 4-character invite code.',
          });
          return;
        }

        const room = rooms.get(rawCode);
        if (!room) {
          sendJson(ws, {
            type: 'room:error',
            message: `Room ${rawCode} was not found. Check the invite code and try again.`,
          });
          return;
        }

        // Idempotent reconnect: if this exact clientId is already in the room, rebind socket
        const existingPlayer = room.players.get(clientId);
        if (existingPlayer) {
          localSockets.set(clientId, ws);
          existingPlayer.ws = ws;
          existingPlayer.connected = true;
          ws.clientId = clientId;
          ws.roomCode = room.code;
          room.updatedAt = Date.now();
          broadcastRoomState(room);
          return;
        }

        if (room.players.size >= 2) {
          sendJson(ws, {
            type: 'room:error',
            message: `Room ${rawCode} already has 2 runners.`,
          });
          return;
        }

        if (room.status !== 'WAITING') {
          sendJson(ws, {
            type: 'room:error',
            message: `Room ${rawCode} is already in the middle of a race.`,
          });
          return;
        }

        // Ensure host and challenger never display identical names when testing across tabs
        const hostPlayer = room.players.get(room.hostId);
        const distinctName =
          hostPlayer && hostPlayer.name.toLowerCase() === rawName.toLowerCase()
            ? `${rawName.slice(0, 13)} II`
            : rawName;

        const guestPlayer = createFreshPlayer(clientId, distinctName, characterId, false, ws);
        localSockets.set(clientId, ws);
        room.players.set(clientId, guestPlayer);
        room.updatedAt = Date.now();

        ws.clientId = clientId;
        ws.roomCode = room.code;

        broadcastRoomState(room);
        return;
      }

      if (type === 'player:profile') {
        const code = ws.roomCode;
        const clientId = ws.clientId;
        if (!code || !clientId) return;
        const room = rooms.get(code);
        if (!room || room.status !== 'WAITING') return;
        const player = room.players.get(clientId);
        if (!player) return;

        const desiredName = sanitizeName(msg.playerName, player.name);
        const other = getOtherPlayer(room, clientId);
        player.name =
          other && other.name.toLowerCase() === desiredName.toLowerCase()
            ? `${desiredName.slice(0, 13)} II`
            : desiredName;
        player.characterId = sanitizeCharacter(msg.characterId);
        room.updatedAt = Date.now();
        broadcastRoomState(room);
        return;
      }

      if (type === 'room:leave') {
        removeClientFromCurrentRoom(ws, true);
        return;
      }

      if (type === 'room:reset') {
        const code = ws.roomCode;
        const clientId = ws.clientId;
        if (!code || !clientId) return;
        const room = rooms.get(code);
        if (!room) return;

        if (room.status === 'FINISHED') {
          room.status = 'WAITING';
          room.seed = generateSeed();
          room.winnerId = null;
          room.updatedAt = Date.now();
          for (const p of room.players.values()) {
            resetPlayerMetrics(p);
          }
        }
        broadcastRoomState(room);
        return;
      }

      if (type === 'match:start') {
        const code = ws.roomCode;
        const clientId = ws.clientId;
        if (!code || !clientId) return;
        const room = rooms.get(code);
        if (!room) return;

        if (room.hostId !== clientId) {
          sendJson(ws, {
            type: 'room:error',
            message: 'Only the room host can launch the race.',
          });
          return;
        }

        if (room.players.size < 2) {
          sendJson(ws, {
            type: 'room:error',
            message: 'Waiting for a challenger to join before starting.',
          });
          return;
        }

        room.status = 'RACING';
        room.seed = generateSeed();
        room.winnerId = null;
        room.updatedAt = Date.now();

        for (const p of room.players.values()) {
          resetPlayerMetrics(p);
        }

        const playersSummary = Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          characterId: p.characterId,
          isHost: p.isHost,
        }));

        for (const p of room.players.values()) {
          sendPlayer(p, {
            type: 'match:started',
            code: room.code,
            seed: room.seed,
            goalDistance: room.goalDistance,
            players: playersSummary,
          });
        }
        return;
      }

      if (type === 'player:update') {
        const code = ws.roomCode;
        const clientId = ws.clientId;
        if (!code || !clientId) return;
        const room = rooms.get(code);
        if (!room || room.status !== 'RACING') return;

        const player = room.players.get(clientId);
        if (!player || !player.isAlive) return;

        const rawDist = Number(msg.distance);
        if (Number.isFinite(rawDist) && rawDist >= 0) {
          player.distance = Math.min(room.goalDistance, Math.max(player.distance, rawDist));
        }
        const rawSpeed = Number(msg.speed);
        if (Number.isFinite(rawSpeed) && rawSpeed >= 0) {
          player.speed = Math.min(900, rawSpeed);
        }
        player.lane = clampLane(msg.lane);
        player.targetLane = clampLane(msg.targetLane);
        const rawX = Number(msg.xOffset);
        if (Number.isFinite(rawX)) {
          player.xOffset = Math.max(-1.2, Math.min(1.2, rawX));
        }
        player.isJumping = Boolean(msg.isJumping);
        const rawJump = Number(msg.jumpProgress);
        player.jumpProgress = Number.isFinite(rawJump) ? Math.max(0, Math.min(1, rawJump)) : 0;
        player.isSliding = Boolean(msg.isSliding);
        const rawSlide = Number(msg.slideProgress);
        player.slideProgress = Number.isFinite(rawSlide) ? Math.max(0, Math.min(1, rawSlide)) : 0;
        const rawSlow = Number(msg.slowTimer);
        player.slowTimer = Number.isFinite(rawSlow) ? Math.max(0, Math.min(5, rawSlow)) : 0;
        const rawShield = Number(msg.shieldTimer);
        player.shieldTimer = Number.isFinite(rawShield) ? Math.max(0, Math.min(10, rawShield)) : 0;
        const rawFly = Number(msg.flyTimer);
        player.flyTimer = Number.isFinite(rawFly) ? Math.max(0, Math.min(10, rawFly)) : 0;
        const rawCoins = Number(msg.coins);
        if (Number.isFinite(rawCoins) && rawCoins >= 0) {
          player.coins = Math.floor(rawCoins);
        }

        room.updatedAt = Date.now();

        const opponent = getOtherPlayer(room, clientId);
        if (opponent) {
          sendPlayer(opponent, {
            type: 'opponent:update',
            distance: player.distance,
            speed: player.speed,
            lane: player.lane,
            targetLane: player.targetLane,
            xOffset: player.xOffset,
            isJumping: player.isJumping,
            jumpProgress: player.jumpProgress,
            isSliding: player.isSliding,
            slideProgress: player.slideProgress,
            slowTimer: player.slowTimer,
            shieldTimer: player.shieldTimer,
            flyTimer: player.flyTimer,
            coins: player.coins,
          });

          // If opponent already crashed earlier and this live runner just passed their wreck, resolve!
          if (!opponent.isAlive) {
            evaluateCrashResolution(room);
          }
        }
        return;
      }

      if (type === 'player:crashed') {
        const code = ws.roomCode;
        const clientId = ws.clientId;
        if (!code || !clientId) return;
        const room = rooms.get(code);
        if (!room || room.status !== 'RACING') return;

        const player = room.players.get(clientId);
        if (!player || !player.isAlive) return;

        const rawDist = Number(msg.distance);
        if (Number.isFinite(rawDist) && rawDist >= 0) {
          player.distance = Math.min(room.goalDistance, Math.max(player.distance, rawDist));
        }
        player.isAlive = false;
        player.speed = 0;
        player.crashReason =
          typeof msg.reason === 'string' && msg.reason.trim()
            ? msg.reason.trim().slice(0, 80)
            : 'Hit an obstacle';
        player.crashedAt = Date.now();
        room.updatedAt = Date.now();

        const opponent = getOtherPlayer(room, clientId);
        if (opponent) {
          sendPlayer(opponent, {
            type: 'opponent:crashed',
            playerId: player.id,
            playerName: player.name,
            distance: Math.max(0, Math.floor(player.distance)),
            reason: player.crashReason,
          });
        }

        evaluateCrashResolution(room);
        return;
      }

      if (type === 'player:finished') {
        const code = ws.roomCode;
        const clientId = ws.clientId;
        if (!code || !clientId) return;
        const room = rooms.get(code);
        if (!room || room.status !== 'RACING') return;

        const player = room.players.get(clientId);
        if (!player || !player.isAlive) return;

        player.distance = room.goalDistance;
        player.finished = true;
        player.finishedAt = Date.now();
        const rawCoins = Number(msg.coins);
        if (Number.isFinite(rawCoins) && rawCoins >= 0) {
          player.coins = Math.floor(rawCoins);
        }

        room.winnerId = player.id;
        room.status = 'FINISHED';
        room.updatedAt = Date.now();

        const opponent = getOtherPlayer(room, clientId);
        sendMatchResultToPlayer(
          room,
          player,
          player.id,
          opponent
            ? `Crossed the ${room.goalDistance.toLocaleString()} m finish line ahead of ${opponent.name}!`
            : `Cleared the ${room.goalDistance.toLocaleString()} m course!`
        );

        if (opponent) {
          sendMatchResultToPlayer(
            room,
            opponent,
            player.id,
            `${player.name} crossed the ${room.goalDistance.toLocaleString()} m finish line first!`
          );
        }
      }
          } finally {
            const updatedRoomCode = ws.roomCode ?? roomLockCode;
            if (updatedRoomCode !== '__create__') {
              const updatedRoom = rooms.get(updatedRoomCode);
              if (updatedRoom) await saveRoom(updatedRoom);
              else await removeSharedRoom(updatedRoomCode);
            } else if (ws.roomCode) {
              const createdRoom = rooms.get(ws.roomCode);
              if (createdRoom) await saveRoom(createdRoom);
            }
            if (
              roomLockCode !== '__create__' &&
              updatedRoomCode !== roomLockCode &&
              !rooms.has(roomLockCode)
            ) {
              await removeSharedRoom(roomLockCode);
            }
          }
        });
      };

      void processMessage().catch((error: unknown) => {
        console.error('Could not process multiplayer message:', error);
        sendJson(ws, {
          type: 'room:error',
          message: 'The multiplayer service is temporarily unavailable. Please try again.',
        });
      });
    });

    ws.on('close', () => {
      leaveSocketRoom(ws);
    });

    ws.on('error', () => {
      leaveSocketRoom(ws);
    });
  });

  // Heartbeat ping/pong & stale room sweep every 25s
  const interval = setInterval(() => {
    wss.clients.forEach((rawClient) => {
      const client = rawClient as TrackedSocket;
      if (client.isAliveSocket === false) {
        removeClientFromCurrentRoom(client, false);
        client.terminate();
        return;
      }
      client.isAliveSocket = false;
      try {
        client.ping();
      } catch {
        // Ignore ping errors
      }
    });

    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (now - room.updatedAt > 30 * 60 * 1000) {
        rooms.delete(code);
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

let cachedGodotWasmGz: Buffer | null = null;
let cachedGodotWasmRaw: Buffer | null = null;

function loadGodotWasmGz(): Buffer | null {
  if (cachedGodotWasmGz) return cachedGodotWasmGz;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(moduleDir, '..');
  const candidateDirs = [
    path.join(projectRoot, 'frontend', 'dist', 'godot', 'wasm'),
    path.join(projectRoot, 'dist', 'godot', 'wasm'),
    path.join(projectRoot, 'frontend', 'public', 'godot', 'wasm'),
  ];

  for (const wasmDir of candidateDirs) {
    const manifestPath = path.join(wasmDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        chunks?: string[];
      };
      if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) continue;
      const buffers: Buffer[] = [];
      for (const chunkName of manifest.chunks) {
        const safeName = path.basename(chunkName);
        const fullChunkPath = path.join(wasmDir, safeName);
        if (safeName.endsWith('.js')) {
          const jsContent = fs.readFileSync(fullChunkPath, 'utf8');
          const match = jsContent.match(/"([A-Za-z0-9+/=]+)"/);
          if (match) {
            buffers.push(Buffer.from(match[1], 'base64'));
          }
        } else {
          buffers.push(fs.readFileSync(fullChunkPath));
        }
      }
      cachedGodotWasmGz = Buffer.concat(buffers);
      return cachedGodotWasmGz;
    } catch (err) {
      console.error('Failed to assemble Godot WASM chunks:', err);
    }
  }

  return null;
}

export async function createMazeRunnerServer(options: {
  serveFrontend?: boolean;
  useVite?: boolean;
} = {}): Promise<ReturnType<typeof createServer>> {
  await startRoomRelay();
  const app = express();
  app.use(express.json());

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  mountNeonRoutes(app);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
    });
  });

  const serverProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const distGodotDir = path.join(serverProjectRoot, 'frontend', 'dist', 'godot');
  const publicGodotDir = path.join(serverProjectRoot, 'frontend', 'public', 'godot');
  const activeGodotDir =
    process.env.NODE_ENV === 'production' && fs.existsSync(distGodotDir)
      ? distGodotDir
      : publicGodotDir;

  app.use('/godot', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.path.endsWith('.pck') || req.path.endsWith('.bin')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400, no-transform');
    } else if (req.path.endsWith('manifest.json') || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-transform');
    }
    next();
  });

  if (fs.existsSync(activeGodotDir)) {
    app.use(
      '/godot',
      express.static(activeGodotDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'public, max-age=3600, no-transform');
          } else if (filePath.endsWith('.pck') || filePath.endsWith('.bin')) {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=86400, no-transform');
          } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            if (/chunk_\d+\.js$/.test(filePath)) {
              res.setHeader('Cache-Control', 'public, max-age=86400, no-transform');
            } else {
              res.setHeader('Cache-Control', 'no-cache, no-transform');
            }
          } else if (filePath.endsWith('manifest.json') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-transform');
          }
        },
      })
    );
  }

  app.get('/godot/maze_runner.wasm', (req, res) => {
    const gzBuf = loadGodotWasmGz();
    if (!gzBuf) {
      res.status(404).type('text/plain').send('Godot WASM binary chunks not found');
      return;
    }

    const acceptEncoding = String(req.headers['accept-encoding'] ?? '');
    res.setHeader('Content-Type', 'application/wasm');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=86400, no-transform');

    if (acceptEncoding.includes('gzip') && req.query.raw !== '1') {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(gzBuf.length));
      res.status(200).end(gzBuf);
      return;
    }

    if (!cachedGodotWasmRaw) {
      cachedGodotWasmRaw = zlib.gunzipSync(gzBuf);
    }
    res.setHeader('Content-Length', String(cachedGodotWasmRaw.length));
    res.status(200).end(cachedGodotWasmRaw);
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  attachWebSocketHandlers(wss);

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (parsedUrl.pathname === '/ws' || parsedUrl.pathname === '/api/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  if (options.useVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.join(projectRoot, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (options.serveFrontend !== false) {
    const frontendDist = path.join(projectRoot, 'frontend', 'dist');
    const rootDist = path.join(projectRoot, 'dist');
    const distPath = fs.existsSync(frontendDist) ? frontendDist : rootDist;
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'public, max-age=3600, no-transform');
          } else if (filePath.endsWith('.pck') || filePath.endsWith('.bin')) {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=86400, no-transform');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use('/api', (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API request failed:', error);
    if (!res.headersSent) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error.status === 400 || error.status === 413)
          ? error.status
          : 500;
      res.status(status).json({
        error:
          status === 413
            ? 'The uploaded file exceeds the 3 MB limit.'
            : status === 400
              ? 'The request could not be parsed.'
              : 'The backend could not complete the request.',
      });
    }
  });

  return httpServer;
}

async function startServer(): Promise<void> {
  const server = await createMazeRunnerServer({
    useVite: process.env.NODE_ENV !== 'production',
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Maze Runner server + WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
