import React, { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from '@neon/realtime-react';
import type { SealedLiveQuery } from '@neon/realtime/client';
import type { GameStoreState } from '../types';
import { gameStore } from '../store/gameStore';
import { Cloud } from 'lucide-react';
import {
  getNeonAccessToken,
  neonApiFetch,
  neonAuthClient,
} from '../services/neonAuth';
import { neonRealtimeClient } from '../services/neonRealtime';

interface GameProfile {
  display_name: string;
  unlocked_level: number;
  best_stars: Record<string, number>;
  high_distance: number;
  total_coins: number;
  selected_character_id: string;
  avatar_url: string | null;
  is_new?: boolean;
}

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  high_distance: number;
  total_coins: number;
}

interface NeonAccountProps {
  onClose: () => void;
}

export function NeonAccountButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
        aria-label="Neon account and cloud profile"
        title="Account and cloud profile"
      >
        <span className="sr-only">Account</span>
        <Cloud size={18} aria-hidden="true" />
      </button>
      {open && <NeonAccountDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NeonAccountDialog({ onClose }: NeonAccountProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="neon-account-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-cyan-950/40"
      >
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="neon-account-title" className="font-display text-xl font-extrabold">
              Neon account
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Cloud saves, profile image, and live leaderboard
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-10 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:text-white"
          >
            Close
          </button>
        </header>
        {!neonAuthClient ? (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-200">
            Neon Auth is not configured in this build. Set VITE_NEON_AUTH_URL and rebuild the frontend.
          </p>
        ) : (
          <AccountContent />
        )}
      </section>
    </div>
  );
}

function AccountContent() {
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [sessionPending, setSessionPending] = useState(true);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const result = await neonAuthClient!.getSession();
    if (result.error) {
      throw new Error(result.error.message || 'Could not load the Neon session.');
    }
    setUser(result.data?.user ?? null);
    setSessionPending(false);
  }, []);

  const loadProfile = useCallback(async () => {
    const response = await neonApiFetch('/api/neon/profile');
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Could not load cloud profile (${response.status}).`);
    }

    const loaded = (await response.json()) as GameProfile;
    const local = gameStore.getState();
    const profileToApply = loaded.is_new
      ? await saveLocalProfile(local)
      : loaded;
    setProfile(profileToApply);
    gameStore.applyCloudProfile({
      playerName: profileToApply.display_name,
      unlockedLevel: profileToApply.unlocked_level,
      bestStars: profileToApply.best_stars,
      highDistance: profileToApply.high_distance,
      coins: profileToApply.total_coins,
      selectedCharacterId: profileToApply.selected_character_id,
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    void loadProfile().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load cloud profile.');
    });
  }, [user?.id, loadProfile]);

  useEffect(() => {
    void refreshSession().catch((sessionError: unknown) => {
      setError(sessionError instanceof Error ? sessionError.message : 'Could not load the Neon session.');
      setSessionPending(false);
    });
  }, [refreshSession]);

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'sign-up'
          ? await neonAuthClient!.signUp.email({ email, password, name: name.trim() || 'Runner' })
          : await neonAuthClient!.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message || 'Neon Auth could not complete sign-in.');
      }
      await refreshSession();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Neon Auth could not complete sign-in.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await neonAuthClient!.signOut();
      if (result.error) throw new Error(result.error.message || 'Could not sign out.');
      setProfile(null);
      await refreshSession();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Profile images must be 3 MB or smaller.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await neonApiFetch('/api/neon/profile/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Image upload failed (${response.status}).`);
      }
      setProfile((await response.json()) as GameProfile);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
    } finally {
      setBusy(false);
    }
  };

  if (sessionPending) {
    return <p className="py-8 text-center text-sm text-slate-400">Checking Neon session…</p>;
  }

  if (!user) {
    return (
      <div>
        <form onSubmit={submitAuth} className="space-y-3">
          {mode === 'sign-up' && (
            <label className="block text-xs text-slate-300">
              Runner name
              <input
                autoComplete="nickname"
                maxLength={24}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="block text-xs text-slate-300">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-300">
            Password
            <input
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          onClick={() => {
            setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'));
            setError(null);
          }}
          className="mt-3 w-full text-sm text-cyan-300 hover:text-cyan-200"
        >
          {mode === 'sign-in' ? 'New runner? Create an account' : 'Already registered? Sign in'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/20 text-xl font-bold text-cyan-300">
            {(user.name || 'R').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
        </div>
        <button
          onClick={() => void signOut()}
          disabled={busy}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-50"
        >
          Sign out
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 p-3">
        <div>
          <p className="text-sm font-semibold">Profile image</p>
          <p className="text-xs text-slate-400">Private Neon bucket · PNG, JPEG, or WebP · max 3 MB</p>
        </div>
        <label className="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700">
          {busy ? 'Saving…' : 'Upload'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => void uploadAvatar(event)}
            className="sr-only"
          />
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

      {profile && neonRealtimeClient ? (
        <LiveLeaderboard />
      ) : (
        <p className="rounded-xl border border-slate-800 p-3 text-xs text-slate-400">
          {profile ? 'Realtime is not configured in this build.' : 'Loading cloud profile…'}
        </p>
      )}
    </div>
  );
}

function LiveLeaderboard() {
  const [sealedQuery, setSealedQuery] = useState<SealedLiveQuery<LeaderboardRow> | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const refreshQuery = useCallback(async () => {
    const response = await neonApiFetch('/api/neon/leaderboard/live-query');
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Could not start live leaderboard (${response.status}).`);
    }
    return (await response.json()) as SealedLiveQuery<LeaderboardRow>;
  }, []);

  useEffect(() => {
    let active = true;
    void refreshQuery()
      .then((query) => {
        if (active) setSealedQuery(query);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setQueryError(loadError instanceof Error ? loadError.message : 'Could not load live leaderboard.');
        }
      });
    return () => {
      active = false;
    };
  }, [refreshQuery]);

  if (queryError) {
    return <p role="alert" className="text-sm text-rose-300">{queryError}</p>;
  }
  if (!sealedQuery) {
    return <p className="py-3 text-sm text-slate-400">Connecting to live leaderboard…</p>;
  }
  return <LeaderboardRows query={sealedQuery} refreshQuery={refreshQuery} />;
}

function LeaderboardRows({
  query,
  refreshQuery,
}: {
  query: SealedLiveQuery<LeaderboardRow>;
  refreshQuery: () => Promise<SealedLiveQuery<LeaderboardRow>>;
}) {
  const { data, status, error } = useLiveQuery(query, { refreshQuery });
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">Live leaderboard</h3>
        <span className="text-[10px] uppercase tracking-wider text-emerald-300">{status}</span>
      </header>
      {error ? (
        <p role="alert" className="text-xs text-rose-300">Live updates stopped: {error.message}</p>
      ) : data === undefined ? (
        <p className="text-xs text-slate-400">Loading leaderboard…</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-slate-400">Finish a run to appear on the board.</p>
      ) : (
        <ol className="space-y-1.5">
          {data.map((row, index) => (
            <li
              key={row.user_id}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="min-w-0 truncate text-slate-300">
                <span className="mr-2 text-slate-500">{index + 1}.</span>
                {row.display_name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-cyan-300">
                {Number(row.high_distance).toLocaleString()} m
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

async function saveLocalProfile(local: GameStoreState): Promise<GameProfile> {
  const response = await neonApiFetch('/api/neon/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: local.playerName,
      unlockedLevel: local.unlockedLevel,
      bestStars: local.bestStars,
      highDistance: local.highDistance,
      totalCoins: local.coins,
      selectedCharacterId: local.selectedCharacterId,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Could not save your cloud profile (${response.status}).`);
  }
  return (await response.json()) as GameProfile;
}
