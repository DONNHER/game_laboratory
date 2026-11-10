import { createAuthClient } from '@neon/neon-js/auth';
import type { GameMode, GameStoreState } from '../types';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

export const neonAuthClient = authUrl ? createAuthClient(authUrl) : null;

export async function getNeonAccessToken(): Promise<string | null> {
  if (!neonAuthClient) return null;

  const { data, error } = await neonAuthClient.getSession();
  if (error) throw new Error(error.message || 'Could not load a Neon session.');
  if (!data?.user || !data.session) return null;
  return data.session.token ?? null;
}

export async function neonApiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getNeonAccessToken();
  if (!token) throw new Error('Sign in before using your cloud profile.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function saveGameRun(
  run: {
    runId: string;
    mode: GameMode;
    levelId: number;
    distance: number;
    coins: number;
    won: boolean;
    stars: number;
  },
  profile: GameStoreState
): Promise<boolean> {
  if (!neonAuthClient) return false;
  const token = await getNeonAccessToken();
  if (!token) return false;

  const response = await fetch('/api/neon/game-runs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...run,
      displayName: profile.playerName,
      unlockedLevel: profile.unlockedLevel,
      bestStars: profile.bestStars,
      highDistance: profile.highDistance,
      totalCoins: profile.coins,
      selectedCharacterId: profile.selectedCharacterId,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Could not save your game run (${response.status}).`);
  }
  return true;
}
