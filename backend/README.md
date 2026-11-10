# Maze Runner 3D — Backend (`backend/`)

Contains the server-authoritative multiplayer matchmaking, room-code synchronization, and Godot 4.7 WebAssembly streaming services:

- **`backend/server.ts`**: Active Node.js (`Express` + `ws`) server running on port `3000`. Hosts 4-character room codes, 25Hz player telemetry sync, winner/crash resolution, and Godot 4.7 WASM/PCK asset delivery.
- **`backend/laravel/`**: Optional Laravel 11 + Laravel Reverb PHP WebSocket backend (`app/`, `database/`, `routes/`, `composer.json`).
- **`api/[...path].ts`**: Vercel Node.js function entrypoint for the Express API and multiplayer WebSocket.

## Commands (run from repository root)

```bash
# Development server (Express + WebSocket + Vite middleware on port 3000)
pnpm run dev

# Production server (serves frontend/dist + WebSocket rooms on port 3000)
pnpm run build
pnpm run start
```

## Neon services

The Express server uses the Neon project configured in `backend/neon.ts`:

- **Auth** protects `/api/neon/*` routes. The browser sends a Neon Auth JWT; the backend verifies it against the configured JWKS URL.
- **Postgres** stores `game_profiles` and `game_runs`.
- **Object Storage** stores private profile avatars in the `assets` bucket. Uploads are proxied through the backend.
- **Realtime** provides a sealed live leaderboard query. The existing multiplayer WebSocket remains separate and unchanged.
- **Upstash Redis** shares multiplayer rooms and relays messages between Vercel function instances. Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; Vercel deployments fail to start without them.

`neon init`/`neon deploy` create `backend/.env.local` for local development. Keep that file private; it contains server credentials. Apply schema changes from the repository root with:

```bash
pnpm run db:migrate
```

The migration uses `DATABASE_URL_UNPOOLED` when present, otherwise `DATABASE_URL`. Start the app locally with `pnpm run dev`; the frontend is served by Vite middleware while Express serves the API and multiplayer WebSocket.

## Deploying on Vercel

The repository-root `vercel.json` builds the Vite app into `frontend/dist`, routes the multiplayer socket through `/api/ws`, and sends the remaining app routes to the SPA. Vercel's Node.js function entrypoint exports the same Express HTTP server for API requests and WebSocket upgrades.

1. Import the repository in Vercel with the **repository root** as the project root.
2. Install Upstash Redis from the Vercel Marketplace and connect it to the project. Its REST URL and token are used for shared multiplayer rooms and cross-instance WebSocket message delivery.
3. Add the Neon variables to Vercel's Production environment (and Preview if previews should use Neon):
   - `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
   - `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`
   - `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION`
   - `VITE_NEON_AUTH_URL` and `VITE_NEON_REALTIME_URL`
4. Deploy. The two `VITE_` values are public frontend endpoints and must be present at build time. All other Neon values are server-only. Keep Upstash credentials server-only.
5. Add the deployed Vercel domain to Neon Auth's trusted domains and configure it as an allowed Realtime origin. Update `backend/neon.ts` if you want the checked-in Neon configuration to manage that origin.

The WebSocket client reconnects after disconnects. Vercel functions have a maximum invocation duration, so long-running multiplayer sessions may need clients to reconnect and rejoin their room. Redis is the shared source of room state; in-memory state alone is not used for deployed multiplayer.
