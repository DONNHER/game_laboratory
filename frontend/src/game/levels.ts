import { LevelConfig } from '../types';

/**
 * Exact SI speed conversion constants:
 * 1 km/h = 1,000 meters / 3,600 seconds = 1 / 3.6 m/s ≈ 0.2778 m/s
 * 1 m/s  = 3.6 km/h
 */
export const MPS_PER_KPH = 1 / 3.6;
export const KPH_PER_MPS = 3.6;

export function kphToMps(speedKph: number): number {
  const safe = Number.isFinite(speedKph) && speedKph > 0 ? speedKph : 0;
  return safe * MPS_PER_KPH;
}

export function mpsToKph(speedMps: number): number {
  const safe = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
  return safe * KPH_PER_MPS;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'Level 1: Neon Alley',
    subtitle: 'Wide lanes, gentle pace & intro fog bank at 500m',
    difficultyLabel: 'Stage 1 · Rookie',
    goalDistance: 800,
    baseSpeed: 46, // 12.8 m/s
    maxBaseSpeed: 62, // 17.2 m/s cap
    speedIncrement: 2.2,
    obstacleInterval: 31,
    gapSize: 'WIDE',
    traps: ['WALL', 'SLOW_BUMP'],
    accentColor: '#06b6d4', // Cyan
    milestones: [
      {
        id: 's1_m1',
        distance: 250,
        kind: 'SPEED',
        label: '1.5x Boost',
        durationSec: 8,
        speedMultiplier: 1.5,
        fogIntensity: 0,
      },
      {
        id: 's1_m2',
        distance: 500,
        kind: 'FOG',
        label: 'Light Fog',
        durationSec: 10,
        speedMultiplier: 1.0,
        fogIntensity: 0.55,
      },
    ],
  },
  {
    id: 2,
    name: 'Level 2: Cyber Strip',
    subtitle: 'Moving hazards, 500m fog bank & 2x sprint zone',
    difficultyLabel: 'Stage 2 · Runner',
    goalDistance: 1000,
    baseSpeed: 50, // 13.9 m/s
    maxBaseSpeed: 68, // 18.9 m/s cap
    speedIncrement: 2.4,
    obstacleInterval: 29,
    gapSize: 'MEDIUM',
    traps: ['WALL', 'MOVING_BLOCK', 'SLOW_BUMP'],
    accentColor: '#10b981', // Emerald
    milestones: [
      {
        id: 's2_m1',
        distance: 250,
        kind: 'SPEED',
        label: '1.5x Boost',
        durationSec: 8,
        speedMultiplier: 1.5,
        fogIntensity: 0,
      },
      {
        id: 's2_m2',
        distance: 500,
        kind: 'FOG',
        label: 'Dense Fog',
        durationSec: 10,
        speedMultiplier: 1.0,
        fogIntensity: 0.72,
      },
      {
        id: 's2_m3',
        distance: 750,
        kind: 'SPEED',
        label: '2x Speed',
        durationSec: 8,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
    ],
  },
  {
    id: 3,
    name: 'Level 3: Tech Tunnel',
    subtitle: 'Narrow gaps, 2x overdrive & thick tunnel fog',
    difficultyLabel: 'Stage 3 · Skilled',
    goalDistance: 1300,
    baseSpeed: 54, // 15.0 m/s
    maxBaseSpeed: 74, // 20.6 m/s cap
    speedIncrement: 2.5,
    obstacleInterval: 27,
    gapSize: 'NARROW',
    traps: ['WALL', 'MOVING_BLOCK', 'NARROW_GAP', 'SLOW_BUMP'],
    accentColor: '#f59e0b', // Amber
    milestones: [
      {
        id: 's3_m1',
        distance: 280,
        kind: 'SPEED',
        label: '2x Speed',
        durationSec: 8,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
      {
        id: 's3_m2',
        distance: 500,
        kind: 'FOG',
        label: 'Tunnel Fog',
        durationSec: 10,
        speedMultiplier: 1.0,
        fogIntensity: 0.82,
      },
      {
        id: 's3_m3',
        distance: 820,
        kind: 'SPEED',
        label: '1.8x Surge',
        durationSec: 9,
        speedMultiplier: 1.8,
        fogIntensity: 0,
      },
      {
        id: 's3_m4',
        distance: 1060,
        kind: 'FOG_SPEED',
        label: 'Mist + 1.3x',
        durationSec: 9,
        speedMultiplier: 1.3,
        fogIntensity: 0.78,
      },
    ],
  },
  {
    id: 4,
    name: 'Level 4: Grid Collapse',
    subtitle: 'Laser gates, 12s blackout fog & dual 2x speed zones',
    difficultyLabel: 'Stage 4 · Veteran',
    goalDistance: 1600,
    baseSpeed: 58, // 16.1 m/s
    maxBaseSpeed: 78, // 21.7 m/s cap
    speedIncrement: 2.6,
    obstacleInterval: 26,
    gapSize: 'TIGHT',
    traps: ['WALL', 'MOVING_BLOCK', 'NARROW_GAP', 'LASER', 'SLOW_BUMP'],
    accentColor: '#ec4899', // Pink
    milestones: [
      {
        id: 's4_m1',
        distance: 300,
        kind: 'SPEED',
        label: '2x Speed',
        durationSec: 9,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
      {
        id: 's4_m2',
        distance: 500,
        kind: 'FOG',
        label: 'Blackout Fog',
        durationSec: 12,
        speedMultiplier: 1.0,
        fogIntensity: 0.9,
      },
      {
        id: 's4_m3',
        distance: 900,
        kind: 'SPEED',
        label: '2x Speed',
        durationSec: 9,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
      {
        id: 's4_m4',
        distance: 1250,
        kind: 'FOG_SPEED',
        label: 'Storm Fog + 1.5x',
        durationSec: 10,
        speedMultiplier: 1.5,
        fogIntensity: 0.88,
      },
    ],
  },
  {
    id: 5,
    name: 'Level 5: Quantum Core',
    subtitle: 'Apex gauntlet: abyssal fog, storm surges & 2x warp',
    difficultyLabel: 'Stage 5 · Master',
    goalDistance: 2000,
    baseSpeed: 62, // 17.2 m/s
    maxBaseSpeed: 84, // 23.3 m/s cap
    speedIncrement: 2.8,
    obstacleInterval: 25,
    gapSize: 'TIGHT',
    traps: ['WALL', 'MOVING_BLOCK', 'NARROW_GAP', 'LASER', 'SLOW_BUMP'],
    accentColor: '#8b5cf6', // Violet
    milestones: [
      {
        id: 's5_m1',
        distance: 300,
        kind: 'SPEED',
        label: '2x Warp',
        durationSec: 9,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
      {
        id: 's5_m2',
        distance: 500,
        kind: 'FOG',
        label: 'Abyssal Fog',
        durationSec: 12,
        speedMultiplier: 1.1,
        fogIntensity: 0.95,
      },
      {
        id: 's5_m3',
        distance: 900,
        kind: 'SPEED',
        label: '2x Speed',
        durationSec: 10,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
      {
        id: 's5_m4',
        distance: 1300,
        kind: 'FOG_SPEED',
        label: 'Storm Fog + 1.6x',
        durationSec: 11,
        speedMultiplier: 1.6,
        fogIntensity: 0.92,
      },
      {
        id: 's5_m5',
        distance: 1680,
        kind: 'SPEED',
        label: '2x Final Blitz',
        durationSec: 10,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
    ],
  },
];

export function createOnlineMatchLevel(roomCode: string, goalDistance = 1500): LevelConfig {
  return {
    ...LEVELS[2],
    id: 99,
    name: `Room ${roomCode}`,
    subtitle: 'Live head-to-head race with synced track milestones',
    difficultyLabel: 'Online Duel',
    goalDistance,
    baseSpeed: 54,
    maxBaseSpeed: 74,
    speedIncrement: 2.4,
    obstacleInterval: 27,
    milestones: [
      {
        id: 'mp_m1',
        distance: 280,
        kind: 'SPEED',
        label: '1.6x Boost',
        durationSec: 8,
        speedMultiplier: 1.6,
        fogIntensity: 0,
      },
      {
        id: 'mp_m2',
        distance: 500,
        kind: 'FOG',
        label: 'Dense Fog',
        durationSec: 10,
        speedMultiplier: 1.0,
        fogIntensity: 0.8,
      },
      {
        id: 'mp_m3',
        distance: 850,
        kind: 'SPEED',
        label: '2x Speed',
        durationSec: 9,
        speedMultiplier: 2.0,
        fogIntensity: 0,
      },
      {
        id: 'mp_m4',
        distance: 1180,
        kind: 'FOG_SPEED',
        label: 'Mist + 1.4x',
        durationSec: 9,
        speedMultiplier: 1.4,
        fogIntensity: 0.78,
      },
    ],
  };
}

/**
 * Calculates capped, physically-grounded cruise speed in km/h (before milestone multipliers).
 * Smoothly accelerates from baseSpeed up to maxBaseSpeed so obstacles always remain reactable.
 */
export function calculateRunnerSpeed(level: LevelConfig, distanceMeters: number): number {
  const startSpeed = Number.isFinite(level?.baseSpeed) ? level.baseSpeed : 48;
  const maxSpeed = Number.isFinite(level?.maxBaseSpeed) ? level.maxBaseSpeed : startSpeed + 18;
  const safeDistance = Math.max(0, Number.isFinite(distanceMeters) ? distanceMeters : 0);
  const increment = Number.isFinite(level?.speedIncrement) ? level.speedIncrement : 2.4;

  // Smooth linear-to-eased ramp per 100m, strictly capped at maxSpeed
  const gainedKph = (safeDistance / 100) * increment;
  const clamped = Math.min(maxSpeed, startSpeed + gainedKph);
  return Math.round(clamped * 10) / 10;
}
