CREATE TABLE IF NOT EXISTS game_profiles (
  user_id text PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Runner',
  unlocked_level integer NOT NULL DEFAULT 1 CHECK (unlocked_level BETWEEN 1 AND 5),
  best_stars jsonb NOT NULL DEFAULT '{}'::jsonb,
  high_distance integer NOT NULL DEFAULT 0 CHECK (high_distance >= 0),
  total_coins integer NOT NULL DEFAULT 0 CHECK (total_coins >= 0),
  selected_character_id text NOT NULL DEFAULT 'kai',
  avatar_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_runs (
  run_id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES game_profiles(user_id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('SOLO', 'AI_RIVAL', 'ONLINE_MATCH')),
  level_id integer NOT NULL CHECK (level_id BETWEEN 1 AND 5),
  distance integer NOT NULL CHECK (distance >= 0),
  coins integer NOT NULL CHECK (coins >= 0),
  won boolean NOT NULL,
  stars integer NOT NULL CHECK (stars BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_runs_user_created_idx
  ON game_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS game_profiles_leaderboard_idx
  ON game_profiles (high_distance DESC, updated_at DESC);
