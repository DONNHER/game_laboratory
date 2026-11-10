import { useSyncExternalStore } from 'react';
import { GameStoreState } from '../types';
import { soundEngine } from '../game/audio';

const STORAGE_KEY = 'MAZE_RUNNER_PROGRESS_V1';

const DEFAULT_STATE: GameStoreState = {
  unlockedLevel: 1,
  bestStars: { 1: 0 },
  highDistance: 0,
  coins: 0,
  soundOn: true,
  musicOn: false,
  hapticOn: true,
  playerName: 'Striker',
  deviceId: 'DEV_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  selectedCharacterId: 'kai',
};

function loadStoredState(): GameStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    const cleanName =
      !parsed.playerName || parsed.playerName === 'Runner_One'
        ? 'Striker'
        : parsed.playerName;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      playerName: cleanName,
      unlockedLevel: Math.max(1, parsed.unlockedLevel || 1),
      selectedCharacterId: parsed.selectedCharacterId || 'kai',
    };
  } catch (err) {
    console.warn('Failed to read localStorage:', err);
    return DEFAULT_STATE;
  }
}

let currentState: GameStoreState = loadStoredState();
soundEngine.enabled = currentState.soundOn;

const listeners = new Set<() => void>();

function emitChange() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
  listeners.forEach((listener) => listener());
}

export const gameStore = {
  getState: () => currentState,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Completes a level with awarded stars (1-3).
   * Unlocks level n + 1 if level n was successfully cleared with at least 1 star!
   */
  completeLevel: (levelId: number, stars: number) => {
    if (stars < 1) return;

    const currentBest = currentState.bestStars[levelId] || 0;
    const newBest = Math.max(currentBest, stars);
    
    // Unlock next level up to max 5
    const nextUnlocked = Math.max(
      currentState.unlockedLevel,
      Math.min(5, levelId + 1)
    );

    currentState = {
      ...currentState,
      unlockedLevel: nextUnlocked,
      bestStars: {
        ...currentState.bestStars,
        [levelId]: newBest,
      },
    };
    emitChange();
  },

  addCoins: (amount: number) => {
    currentState = {
      ...currentState,
      coins: currentState.coins + amount,
    };
    emitChange();
  },

  updateHighDistance: (dist: number) => {
    if (dist > currentState.highDistance) {
      currentState = {
        ...currentState,
        highDistance: Math.floor(dist),
      };
      emitChange();
    }
  },

  toggleSound: () => {
    const next = !currentState.soundOn;
    soundEngine.enabled = next;
    currentState = {
      ...currentState,
      soundOn: next,
    };
    emitChange();
  },

  toggleMusic: () => {
    const next = !currentState.musicOn;
    if (next) {
      soundEngine.startMusic();
    } else {
      soundEngine.stopMusic();
    }
    currentState = {
      ...currentState,
      musicOn: next,
    };
    emitChange();
  },

  setPlayerName: (name: string) => {
    currentState = {
      ...currentState,
      playerName: name.trim() || 'Striker',
    };
    emitChange();
  },

  applyCloudProfile: (
    profile: Pick<
      GameStoreState,
      'playerName' | 'unlockedLevel' | 'bestStars' | 'highDistance' | 'coins' | 'selectedCharacterId'
    >
  ) => {
    currentState = { ...currentState, ...profile };
    emitChange();
  },

  selectCharacter: (characterId: string) => {
    currentState = {
      ...currentState,
      selectedCharacterId: characterId,
    };
    emitChange();
  },

  resetProgress: () => {
    currentState = {
      ...DEFAULT_STATE,
      deviceId: currentState.deviceId,
    };
    emitChange();
  },
};

export function useGameStore(): GameStoreState {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getState);
}
