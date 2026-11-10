import { Lane, Obstacle, ObstacleType, StageMilestone } from '../types';
import { createMulberry32 } from './mulberry32';

export interface RoadGeneratorOptions {
  seed: number;
  interval?: number; // baseline distance in meters between obstacle clusters
  allowedTraps?: ObstacleType[];
  speed?: number;
  milestones?: StageMilestone[];
}

interface OccupiedSlot {
  lane: Lane;
  distance: number;
  radius: number;
}

const ALL_LANES: readonly Lane[] = [-1, 0, 1];

export class RoadGenerator {
  private rng: () => number;
  private currentDistance: number = 18;
  private obstacleCount: number = 0;
  private initialized: boolean = false;
  private nextGemDistance: number = 64;
  private lastSpawnedGemDist: number = -999;
  private lastGemType: 'SHIELD_GEM' | 'FLY_GEM' = 'SHIELD_GEM';
  private gemStreak: number = 0;
  private lastTrapType: ObstacleType | null = null;
  private trapStreak: number = 0;
  private lastPrimaryLane: Lane | null = null;
  private recentOccupied: OccupiedSlot[] = [];
  private options: Required<RoadGeneratorOptions>;

  constructor(options: RoadGeneratorOptions) {
    this.rng = createMulberry32(options.seed);
    this.options = {
      seed: options.seed,
      interval: options.interval ?? 27,
      allowedTraps: options.allowedTraps ?? ['WALL', 'MOVING_BLOCK', 'NARROW_GAP'],
      speed: options.speed ?? 52,
      milestones: options.milestones ?? [],
    };
    this.lastGemType = this.rng() < 0.5 ? 'SHIELD_GEM' : 'FLY_GEM';
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomRange(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  private pickRandom<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private shuffledLanes(): Lane[] {
    const copy: Lane[] = [-1, 0, 1];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  private pruneOccupied(minDistance: number): void {
    if (this.recentOccupied.length > 64) {
      this.recentOccupied = this.recentOccupied.filter((s) => s.distance >= minDistance);
    }
  }

  private canPlaceAt(lane: Lane, distance: number, radius = 2.4): boolean {
    if (distance < 7) return false;
    for (const slot of this.recentOccupied) {
      if (slot.lane === lane && Math.abs(slot.distance - distance) < slot.radius + radius) {
        return false;
      }
    }
    return true;
  }

  private pushSegment(
    segments: Obstacle[],
    obs: Obstacle,
    occupyRadius = 2.4
  ): void {
    const roundedDist = Math.round(obs.distance * 10) / 10;
    obs.distance = roundedDist;
    segments.push(obs);
    this.recentOccupied.push({
      lane: obs.lane,
      distance: roundedDist,
      radius: occupyRadius,
    });
  }

  private getActiveMilestoneZone(dist: number): StageMilestone | null {
    for (const m of this.options.milestones) {
      const zoneSpan = Math.max(110, Math.round(15.5 * m.speedMultiplier * m.durationSec));
      if (dist >= m.distance - 6 && dist <= m.distance + zoneSpan) {
        return m;
      }
    }
    return null;
  }

  private isNearMilestoneGate(dist: number, margin = 8.5): StageMilestone | null {
    for (const m of this.options.milestones) {
      if (Math.abs(dist - m.distance) <= margin) {
        return m;
      }
    }
    return null;
  }

  private pickNextGemType(): 'SHIELD_GEM' | 'FLY_GEM' {
    // Allow natural randomness (including occasional doubles) while preventing >2 identical gems in a row
    let chosen: 'SHIELD_GEM' | 'FLY_GEM';
    if (this.gemStreak >= 2) {
      chosen = this.lastGemType === 'SHIELD_GEM' ? 'FLY_GEM' : 'SHIELD_GEM';
    } else {
      chosen = this.rng() < 0.5 ? 'SHIELD_GEM' : 'FLY_GEM';
    }

    if (chosen === this.lastGemType) {
      this.gemStreak += 1;
    } else {
      this.lastGemType = chosen;
      this.gemStreak = 1;
    }
    return chosen;
  }

  private pickNextTrapType(pool: ObstacleType[]): ObstacleType {
    if (pool.length === 0) return 'WALL';
    let candidate = this.pickRandom(pool);
    // Re-roll once if repeating the exact same trap consecutively so runs feel varied
    if (pool.length > 1 && candidate === this.lastTrapType && (this.trapStreak >= 2 || this.rng() < 0.65)) {
      const others = pool.filter((t) => t !== this.lastTrapType);
      candidate = this.pickRandom(others);
    }

    if (candidate === this.lastTrapType) {
      this.trapStreak += 1;
    } else {
      this.lastTrapType = candidate;
      this.trapStreak = 1;
    }
    return candidate;
  }

  private pickPrimaryLane(): Lane {
    let lane = this.pickRandom(ALL_LANES);
    if (lane === this.lastPrimaryLane && this.rng() < 0.55) {
      const others = ALL_LANES.filter((l) => l !== lane);
      lane = this.pickRandom(others);
    }
    this.lastPrimaryLane = lane;
    return lane;
  }

  private trySpawnCoin(segments: Obstacle[], lane: Lane, distance: number): boolean {
    if (this.isNearMilestoneGate(distance, 3.5)) return false;
    if (!this.canPlaceAt(lane, distance, 1.9)) return false;
    this.pushSegment(
      segments,
      {
        id: `coin_${++this.obstacleCount}`,
        type: 'COIN',
        distance,
        lane,
      },
      1.7
    );
    return true;
  }

  private spawnRandomCoinFormation(
    segments: Obstacle[],
    anchorDist: number,
    openSafeLanes: Lane[],
    nextStepSpan: number
  ): void {
    const safePool = openSafeLanes.length > 0 ? openSafeLanes : [...ALL_LANES];
    const patternRoll = this.rng();

    if (patternRoll < 0.28) {
      // Pattern 1: Single Core at a randomized lane & offset
      const lane = this.rng() < 0.75 ? this.pickRandom(safePool) : this.pickRandom(ALL_LANES);
      const offset =
        safePool.includes(lane)
          ? this.randomRange(-3.5, Math.min(8, nextStepSpan * 0.4))
          : this.randomRange(5.5, Math.max(7, nextStepSpan * 0.55));
      this.trySpawnCoin(segments, lane, anchorDist + offset);
    } else if (patternRoll < 0.64) {
      // Pattern 2: 2-to-4 Coin Sprint Ribbon along a randomly chosen safe lane
      const lane = this.pickRandom(safePool);
      const count = this.randomInt(2, 4);
      const spacing = this.randomRange(2.9, 3.6);
      const startDist = anchorDist + this.randomRange(-3.2, 4.5);
      for (let i = 0; i < count; i++) {
        this.trySpawnCoin(segments, lane, startDist + i * spacing);
      }
    } else if (patternRoll < 0.84 && nextStepSpan >= 21) {
      // Pattern 3: Diagonal Switch Trail across open space after the hazard
      const startLane = this.pickRandom(safePool);
      const dir: -1 | 1 =
        startLane === -1 ? 1 : startLane === 1 ? -1 : this.rng() < 0.5 ? -1 : 1;
      const midLane = Math.max(-1, Math.min(1, startLane + dir)) as Lane;
      const endLane =
        this.rng() < 0.65
          ? (Math.max(-1, Math.min(1, midLane + dir)) as Lane)
          : midLane;
      const base = anchorDist + this.randomRange(4.8, 7.2);
      const step = this.randomRange(3.2, 3.9);
      this.trySpawnCoin(segments, startLane, base);
      this.trySpawnCoin(segments, midLane, base + step);
      this.trySpawnCoin(segments, endLane, base + step * 2);
    } else {
      // Pattern 4: Twin Parallel Pockets in two distinct lanes
      const shuffled = this.shuffledLanes();
      const candidateLanes =
        safePool.length >= 2 ? safePool.slice(0, 2) : shuffled.slice(0, 2);
      const base =
        safePool.length >= 2
          ? anchorDist + this.randomRange(-2.2, 3.5)
          : anchorDist + this.randomRange(5.5, 9.0);
      const stagger = this.rng() < 0.5 ? 0 : this.randomRange(1.6, 3.0);
      this.trySpawnCoin(segments, candidateLanes[0], base);
      this.trySpawnCoin(segments, candidateLanes[1], base + stagger);
    }
  }

  private trySpawnPowerGem(
    segments: Obstacle[],
    anchorDist: number,
    openSafeLanes: Lane[],
    nextStepSpan: number
  ): boolean {
    const gemType = this.pickNextGemType();
    const safePool = openSafeLanes.length > 0 ? openSafeLanes : [...ALL_LANES];
    const placementRoll = this.rng();

    let gemLane: Lane;
    let gemDist: number;

    if (placementRoll < 0.36) {
      // Parallel Risk/Reward: directly beside the obstacle in an open lane
      gemLane = this.pickRandom(safePool);
      gemDist = anchorDist + this.randomRange(-1.6, 1.8);
    } else if (placementRoll < 0.76) {
      // Open-Pocket Spawn: in the stretch after the obstacle in any lane (-1, 0, or 1)
      gemLane = this.pickRandom(ALL_LANES);
      const maxOffset = Math.max(7.5, Math.min(14, nextStepSpan - 6.5));
      gemDist = anchorDist + this.randomRange(6.0, maxOffset);
    } else {
      // Lead-In Spawn: ahead of the obstacle in an open safe lane
      gemLane = this.pickRandom(safePool);
      gemDist = anchorDist - this.randomRange(5.2, 8.2);
    }

    if (this.isNearMilestoneGate(gemDist, 6.5)) {
      return false;
    }

    if (!this.canPlaceAt(gemLane, gemDist, 3.2)) {
      // Fallback: try another shuffled lane in the open pocket after the obstacle
      const fallbackDist = anchorDist + Math.max(6.5, nextStepSpan * 0.45);
      if (this.isNearMilestoneGate(fallbackDist, 6.5)) return false;
      const fallbackLane = this.shuffledLanes().find((l) =>
        this.canPlaceAt(l, fallbackDist, 3.2)
      );
      if (fallbackLane === undefined) return false;
      gemLane = fallbackLane;
      gemDist = fallbackDist;
    }

    this.pushSegment(
      segments,
      {
        id: `gem_${++this.obstacleCount}`,
        type: gemType,
        distance: gemDist,
        lane: gemLane,
      },
      3.4
    );

    this.lastSpawnedGemDist = gemDist;
    this.nextGemDistance = gemDist + this.randomInt(56, 136);
    return true;
  }

  /**
   * Generates freshly randomized, fair, sight-readable obstacle formations,
   * Power Gems, and energy core trails up to targetDistance.
   */
  public generateUntil(targetDistance: number): Obstacle[] {
    const segments: Obstacle[] = [];

    // Randomized Opening Sequence so every run starts differently right from meter 9!
    if (!this.initialized) {
      this.initialized = true;

      // 1. Opening first hazard at a randomized distance (18m–29m) & random lane (-1, 0, or 1)
      const firstHazardDist = this.randomRange(18, 29);
      const firstHazardLane = this.pickPrimaryLane();
      const introPool = this.options.allowedTraps.filter((t) => t !== 'NARROW_GAP');
      const firstHazardType: ObstacleType =
        introPool.length > 0 ? this.pickRandom(introPool) : 'WALL';

      if (firstHazardType === 'MOVING_BLOCK') {
        this.pushSegment(segments, {
          id: `obs_${++this.obstacleCount}`,
          type: 'MOVING_BLOCK',
          distance: firstHazardDist,
          lane: firstHazardLane,
          moveSpeed: this.randomRange(1.3, 2.2),
          phase: this.rng() * Math.PI * 2,
        });
      } else {
        this.pushSegment(segments, {
          id: `obs_${++this.obstacleCount}`,
          type: firstHazardType,
          distance: firstHazardDist,
          lane: firstHazardLane,
        });
      }

      // Optional staggered secondary bump in a different lane on 38% of runs
      const openingOpenLanes = ALL_LANES.filter((l) => l !== firstHazardLane);
      if (this.options.allowedTraps.includes('SLOW_BUMP') && this.rng() < 0.38) {
        const bumpLane = this.pickRandom(openingOpenLanes);
        const bumpDist = firstHazardDist + this.randomRange(4.5, 8.5);
        if (this.canPlaceAt(bumpLane, bumpDist, 2.4)) {
          this.pushSegment(segments, {
            id: `obs_${++this.obstacleCount}`,
            type: 'SLOW_BUMP',
            distance: bumpDist,
            lane: bumpLane,
          });
        }
      }

      // 2. Randomized opening coin formation (8.5m–16m) in any lane
      if (this.rng() < 0.85) {
        const startCoinLane =
          this.rng() < 0.65 ? this.pickRandom(openingOpenLanes) : this.pickRandom(ALL_LANES);
        const coinStart = this.randomRange(8.5, Math.max(10.5, firstHazardDist - 7.5));
        const coinCount = this.randomInt(1, 3);
        for (let i = 0; i < coinCount; i++) {
          const d = coinStart + i * 2.9;
          if (d < firstHazardDist - 3.2) {
            this.trySpawnCoin(segments, startCoinLane, d);
          }
        }
      }

      // 3. Randomize first Power Gem window (anywhere between 36m and 96m!)
      this.nextGemDistance = this.randomInt(36, 96);
      this.currentDistance =
        firstHazardDist + Math.max(19, this.options.interval * this.randomRange(0.78, 1.12));
    }

    while (this.currentDistance < targetDistance) {
      this.pruneOccupied(this.currentDistance - 45);

      // Keep milestone checkpoint gates clear of lethal clutter, with randomized gate coin rewards
      const nearGate = this.isNearMilestoneGate(this.currentDistance, 8.5);
      if (nearGate) {
        const gateRewardRoll = this.rng();
        if (gateRewardRoll < 0.36) {
          // 3-lane celebration row across the gate
          for (const l of ALL_LANES) {
            this.trySpawnCoin(segments, l, nearGate.distance);
          }
        } else if (gateRewardRoll < 0.74) {
          // Randomized single-lane 3-coin dash through the gate
          const gateLane = this.pickRandom(ALL_LANES);
          this.trySpawnCoin(segments, gateLane, nearGate.distance - 3.0);
          this.trySpawnCoin(segments, gateLane, nearGate.distance);
          this.trySpawnCoin(segments, gateLane, nearGate.distance + 3.0);
        } else {
          // Twin outer-lane cores
          this.trySpawnCoin(segments, -1, nearGate.distance);
          this.trySpawnCoin(segments, 1, nearGate.distance);
        }

        this.currentDistance =
          nearGate.distance + Math.max(21, this.options.interval * this.randomRange(0.84, 1.14));
        continue;
      }

      const activeZone = this.getActiveMilestoneZone(this.currentDistance);
      const isHighSpeedZone = activeZone !== null && activeZone.speedMultiplier >= 1.5;
      const isFogZone = activeZone !== null && activeZone.fogIntensity >= 0.5;

      // Filter out overly tight blind combos during high-speed milestones
      let pool = this.options.allowedTraps;
      if (isHighSpeedZone) {
        const filtered = pool.filter((t) => t !== 'NARROW_GAP');
        if (filtered.length > 0) pool = filtered;
      }

      // Compute dynamic next-step interval first so coin/gem pockets know the exact open span ahead
      let effectiveInterval = this.options.interval;
      if (activeZone) {
        if (activeZone.speedMultiplier > 1.05) {
          effectiveInterval *= 1 + (activeZone.speedMultiplier - 1) * 0.72;
        }
        if (activeZone.fogIntensity >= 0.5) {
          effectiveInterval *= 1.1;
        }
      }

      const tempoRoll = this.rng();
      let stepSpan: number;
      if (!isHighSpeedZone && !isFogZone && tempoRoll < 0.24) {
        // Brisk two-beat tempo
        stepSpan = Math.max(19, effectiveInterval * this.randomRange(0.74, 0.88));
      } else if (tempoRoll < 0.78) {
        // Varied natural rhythm
        stepSpan = Math.max(20, effectiveInterval * this.randomRange(0.88, 1.18));
      } else {
        // Open breather stretch
        stepSpan = Math.max(24, effectiveInterval * this.randomRange(1.2, 1.54));
      }

      const trapType = this.pickNextTrapType(pool);
      const primaryLane = this.pickPrimaryLane();
      let openSafeLanes: Lane[] = ALL_LANES.filter((l) => l !== primaryLane);

      if (trapType === 'NARROW_GAP') {
        // Leaves 1 randomly chosen lane open, blocks the other 2 (sometimes slightly staggered!)
        const openLane = primaryLane;
        openSafeLanes = [openLane];
        const blockedLanes = ALL_LANES.filter((l) => l !== openLane);
        const staggerSecond = !isHighSpeedZone && this.rng() < 0.42 ? this.randomRange(1.6, 3.2) : 0;
        const canMixLaser = pool.includes('LASER') && this.rng() < 0.3;

        blockedLanes.forEach((l, idx) => {
          const d = this.currentDistance + (idx === 1 ? staggerSecond : 0);
          const subType: ObstacleType = idx === 1 && canMixLaser ? 'LASER' : 'WALL';
          if (this.canPlaceAt(l, d, 2.2)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: subType,
              distance: d,
              lane: l,
            });
          }
        });

        if (!isFogZone && pool.includes('SLOW_BUMP') && this.rng() < 0.22) {
          const bumpDist = this.currentDistance + this.randomRange(-1.5, 2.0);
          if (this.canPlaceAt(openLane, bumpDist, 2.0)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'SLOW_BUMP',
              distance: bumpDist,
              lane: openLane,
            });
          }
        }
      } else if (trapType === 'MOVING_BLOCK') {
        this.pushSegment(segments, {
          id: `obs_${++this.obstacleCount}`,
          type: 'MOVING_BLOCK',
          distance: this.currentDistance,
          lane: primaryLane,
          moveSpeed: isHighSpeedZone
            ? this.randomRange(1.15, 1.95)
            : this.randomRange(1.3, 2.55),
          phase: this.rng() * Math.PI * 2,
        });

        if (!isHighSpeedZone && pool.includes('SLOW_BUMP') && this.rng() < 0.26) {
          const bumpLane = this.pickRandom(openSafeLanes);
          const bumpDist = this.currentDistance + this.randomRange(4.8, 7.5);
          if (!this.isNearMilestoneGate(bumpDist, 5) && this.canPlaceAt(bumpLane, bumpDist, 2.2)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'SLOW_BUMP',
              distance: bumpDist,
              lane: bumpLane,
            });
          }
        }
      } else if (trapType === 'LASER') {
        this.pushSegment(segments, {
          id: `obs_${++this.obstacleCount}`,
          type: 'LASER',
          distance: this.currentDistance,
          lane: primaryLane,
        });

        const comboRoll = this.rng();
        if (!isHighSpeedZone && comboRoll < 0.26) {
          // Dual-laser gate across 2 random lanes (leaves 1 open lane + slide/jump options)
          const secondLaserLane = this.pickRandom(openSafeLanes);
          const stagger = this.rng() < 0.45 ? this.randomRange(1.5, 2.8) : 0;
          if (this.canPlaceAt(secondLaserLane, this.currentDistance + stagger, 2.2)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'LASER',
              distance: this.currentDistance + stagger,
              lane: secondLaserLane,
            });
            openSafeLanes = openSafeLanes.filter((l) => l !== secondLaserLane);
          }
        } else if (!isHighSpeedZone && pool.includes('SLOW_BUMP') && comboRoll < 0.56) {
          const bumpLane = this.pickRandom(openSafeLanes);
          const bumpDist = this.currentDistance + this.randomRange(-2.0, 2.8);
          if (this.canPlaceAt(bumpLane, bumpDist, 2.0)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'SLOW_BUMP',
              distance: bumpDist,
              lane: bumpLane,
            });
          }
        }
      } else if (trapType === 'SLOW_BUMP') {
        this.pushSegment(segments, {
          id: `obs_${++this.obstacleCount}`,
          type: 'SLOW_BUMP',
          distance: this.currentDistance,
          lane: primaryLane,
        });

        const bumpVariant = this.rng();
        if (bumpVariant < 0.38) {
          // Side-by-side rumble strips leaving 1 clean lane
          const secondLane = this.pickRandom(openSafeLanes);
          if (this.canPlaceAt(secondLane, this.currentDistance, 2.0)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'SLOW_BUMP',
              distance: this.currentDistance,
              lane: secondLane,
            });
            openSafeLanes = openSafeLanes.filter((l) => l !== secondLane);
          }
        } else if (bumpVariant < 0.62) {
          // Staggered diagonal bumps 3.2m–5.0m apart
          const secondLane = this.pickRandom(openSafeLanes);
          const staggerDist = this.currentDistance + this.randomRange(3.2, 5.0);
          if (!this.isNearMilestoneGate(staggerDist, 4) && this.canPlaceAt(secondLane, staggerDist, 2.0)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'SLOW_BUMP',
              distance: staggerDist,
              lane: secondLane,
            });
          }
        }
      } else {
        // WALL (with occasional staggered chicane or companion bump)
        this.pushSegment(segments, {
          id: `obs_${++this.obstacleCount}`,
          type: 'WALL',
          distance: this.currentDistance,
          lane: primaryLane,
        });

        const wallCombo = this.rng();
        if (!isHighSpeedZone && !isFogZone && wallCombo < 0.22 && stepSpan >= 24) {
          // Staggered two-wall chicane with generous gap so player weaves left-right
          const secondWallLane = this.pickRandom(openSafeLanes);
          const chicaneOffset = this.randomRange(8.5, Math.min(12.5, stepSpan * 0.48));
          const secondDist = this.currentDistance + chicaneOffset;
          if (!this.isNearMilestoneGate(secondDist, 6) && this.canPlaceAt(secondWallLane, secondDist, 2.4)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'WALL',
              distance: secondDist,
              lane: secondWallLane,
            });
          }
        } else if (!isHighSpeedZone && pool.includes('SLOW_BUMP') && wallCombo < 0.54) {
          const bumpLane = this.pickRandom(openSafeLanes);
          const bumpOffset = this.randomRange(-2.2, 2.6);
          if (this.canPlaceAt(bumpLane, this.currentDistance + bumpOffset, 2.0)) {
            this.pushSegment(segments, {
              id: `obs_${++this.obstacleCount}`,
              type: 'SLOW_BUMP',
              distance: this.currentDistance + bumpOffset,
              lane: bumpLane,
            });
          }
        }
      }

      // Randomized Power Gem spawning (scheduled window OR lucky bonus surge with >= 46m spacing)
      const dueForGem = this.currentDistance >= this.nextGemDistance;
      const luckyBonusGem =
        !dueForGem &&
        this.currentDistance - this.lastSpawnedGemDist >= 46 &&
        this.rng() < 0.08;

      let spawnedGem = false;
      if (dueForGem || luckyBonusGem) {
        spawnedGem = this.trySpawnPowerGem(
          segments,
          this.currentDistance,
          openSafeLanes,
          stepSpan
        );
      }

      // Randomized Energy Core (Coin) formations when not colliding with a Power Gem
      if (!spawnedGem && this.rng() < 0.72) {
        this.spawnRandomCoinFormation(
          segments,
          this.currentDistance,
          openSafeLanes,
          stepSpan
        );
      } else if (spawnedGem && stepSpan >= 28 && this.rng() < 0.45) {
        // Bonus coins on wider breather stretches even when a Power Gem appeared
        this.spawnRandomCoinFormation(
          segments,
          this.currentDistance,
          openSafeLanes,
          stepSpan
        );
      }

      this.currentDistance += stepSpan;
    }

    // Keep segments sorted in ascending distance order for streaming checks and deterministic rendering
    segments.sort((a, b) => a.distance - b.distance);
    return segments;
  }
}
