export type ScreenState = 
  | 'TITLE'
  | 'MAIN_MENU'
  | 'MODE_SELECT'
  | 'LEVEL_SELECT'
  | 'CHARACTER_SELECT'
  | 'PLAYING'
  | 'RESULT'
  | 'LOBBY'
  | 'SETTINGS';

export type GameMode = 'SOLO' | 'AI_RIVAL' | 'ONLINE_MATCH';

export type MilestoneKind = 'FOG' | 'SPEED' | 'FOG_SPEED';

export interface StageMilestone {
  id: string;
  distance: number; // trigger mark in meters (e.g. 500)
  kind: MilestoneKind;
  label: string; // e.g. 'Dense Fog', '2x Speed'
  durationSec: number; // active duration in seconds (e.g. 10)
  speedMultiplier: number; // e.g. 1.0, 1.5, 2.0
  fogIntensity: number; // 0 (clear) to 1 (thickest stage fog)
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  difficultyLabel: string;
  goalDistance: number; // in meters
  baseSpeed: number; // starting speed in km/h (1 km/h = 0.2778 m/s)
  maxBaseSpeed: number; // capped cruise speed in km/h before milestone multipliers
  speedIncrement: number; // km/h ramp per 100m up to maxBaseSpeed
  obstacleInterval: number; // distance between hazard clusters (meters)
  gapSize: 'WIDE' | 'MEDIUM' | 'NARROW' | 'TIGHT';
  traps: Array<'WALL' | 'MOVING_BLOCK' | 'NARROW_GAP' | 'LASER' | 'SLOW_BUMP'>;
  accentColor: string;
  milestones: StageMilestone[];
}

export type Lane = -1 | 0 | 1; // Left: -1, Center: 0, Right: 1

export type ObstacleType =
  | 'WALL'
  | 'MOVING_BLOCK'
  | 'NARROW_GAP'
  | 'LASER'
  | 'SLOW_BUMP'
  | 'COIN'
  | 'SHIELD_GEM'
  | 'FLY_GEM';

export type PowerGemKind = 'SHIELD' | 'FLY';

export const SHIELD_GEM_DURATION_SEC = 3.0;
export const FLY_GEM_DURATION_SEC = 4.0;
export const FLY_GEM_SPEED_MULTIPLIER = 2.0;

export interface Obstacle {
  id: string;
  type: ObstacleType;
  distance: number; // distance along road where it spawns (meters)
  lane: Lane;
  widthRatio?: number; // for moving blocks
  moveSpeed?: number;
  phase?: number;
  isPassed?: boolean;
  collected?: boolean;
  triggered?: boolean; // true once visually compressed
  triggeredByPlayer?: boolean;
  triggeredByOpponent?: boolean;
}

export interface PlayerRunnerState {
  lane: Lane;
  targetLane: Lane;
  xOffset: number; // smooth interpolation from -1 to 1
  isJumping: boolean;
  jumpProgress: number; // 0 to 1
  isSliding: boolean;
  slideProgress: number; // 0 to 1
  distance: number; // current distance in meters
  coins: number;
  isAlive: boolean;
  crashReason: string | null;
  crashTime?: number;
  slowTimer?: number; // remaining seconds of non-lethal speed reduction
  shieldTimer?: number; // remaining seconds of 3s energy shield
  flyTimer?: number; // remaining seconds of 2x invincible jet-flight
  flyLandingGrace?: number; // brief touchdown safety cushion after flight ends
}

export interface AIRunnerState {
  lane: Lane;
  targetLane: Lane;
  xOffset: number;
  distance: number;
  isAlive: boolean;
  crashDistance: number;
  reactionDelay: number;
  isJumping?: boolean;
  jumpProgress?: number;
  isSliding?: boolean;
  slideProgress?: number;
  crashReason?: string | null;
  crashTime?: number;
  slowTimer?: number;
  shieldTimer?: number;
  flyTimer?: number;
}

export interface MatchRoom {
  code: string;
  seed: number;
  hostName: string;
  guestName: string | null;
  status: 'WAITING' | 'COUNTDOWN' | 'RACING' | 'FINISHED' | 'OPPONENT_LEFT';
  createdAt: number;
  winner: 'HOST' | 'GUEST' | 'TIE' | null;
}

export interface GameStoreState {
  unlockedLevel: number;
  bestStars: Record<number, number>; // level -> stars (1-3)
  highDistance: number;
  coins: number;
  soundOn: boolean;
  musicOn: boolean;
  hapticOn: boolean;
  playerName: string;
  deviceId: string;
  selectedCharacterId: string;
}
