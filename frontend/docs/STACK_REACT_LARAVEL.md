# Stack Addendum: React Frontend + Laravel Backend

Put in `docs/STACK_REACT_LARAVEL.md`. It replaces the Godot-specific parts of the lab (Phases 2, 3 code, 5, 7) for the Maze Runner game. The game rules, level plan and R1-R10 in `GAME_REQUIREMENTS.md` stay the same.

IMPORTANT: the lab recommends Godot, but says "alternatives" are possible. React + Laravel is a different stack, so **get written instructor approval at Checkpoint 1** and list it in GDD section 11 (risks). R9 still requires a real phone, so the React app must be packaged as an Android APK (see section 4).

## 1. Architecture

```
Phone (APK via Capacitor, or PWA)           Laravel server (laptop / school server)
+-----------------------------+             +------------------------------+
| React + Vite                |  HTTPS API  | REST API (progress, players, |
|  - UI screens (React)       | <---------> |  leaderboard)                |
|  - Game canvas (Phaser 3)   |             |                              |
|  - Offline: localStorage    |  WebSocket  | Laravel Reverb (WebSockets)  |
|  - Service worker (PWA)     | <---------> |  match rooms, seed, winner   |
+-----------------------------+             | MySQL / SQLite               |
                                            +------------------------------+
```

| Need | Free / open-source choice |
|---|---|
| UI and screen flow | React 18 + Vite + React Router |
| Game rendering | Phaser 3 (MIT) mounted inside a React component, or plain HTML canvas |
| State | Zustand (or React Context) for `gameState` (unlocked level, stars, settings) |
| Offline + install | `vite-plugin-pwa` (service worker) |
| Real phone build (R9) | Capacitor (MIT) wraps the build into an Android APK |
| Backend | Laravel (current stable), Sanctum optional for accounts |
| Real-time online | Laravel Reverb (first-party WebSocket server) + `laravel-echo` + `pusher-js` on the client |
| Database | SQLite for development, MySQL if the school server has it |
| Version control | Git + GitHub (two folders: `frontend/`, `backend/`) |

## 2. How each lab requirement is met

| # | Implementation |
|---|---|
| R1-R3 | React game scenes with level config JSON (goal, speed, gap size, trap types); result screen component with stars and Retry / Next / Menu |
| R4 | `LevelSelect` reads `unlockedLevel` from the store; locked levels show a lock icon and `disabled` button |
| R5 | Save progress in `localStorage` (or IndexedDB) on every level clear; load at app start. Survives closing the app. |
| R6 | Offline mode makes **no network calls**. Service worker caches all assets so the game opens in airplane mode. Solo campaign + AI runner run entirely in the browser. |
| R7 | Two phones join the same room on Laravel Reverb and race on the same seeded road |
| R8 | Mode select screen. If the server cannot be reached (timeout 5 s), show an error and return to mode select. |
| R9 | Capacitor Android APK installed on a real phone, portrait lock, touch/swipe controls |
| R10 | Title, pause menu, sound toggle, 28 px or larger text, tested on small phone |

## 3. Online mode design (server-authoritative)

Use a room code instead of typing an IP (works on any network that can reach the server).

1. Player A taps **Create room** -> `POST /api/rooms` -> server returns `room_code` and `seed`.
2. Player B enters the code -> `POST /api/rooms/{code}/join`.
3. Both subscribe to the presence channel `room.{code}`; server broadcasts `MatchStarted {seed, startAt}`.
4. Both generate the same road from the seed. Each client sends `PlayerState {lane, distance}` about 10 times per second (whisper events on the channel, or a small `POST`).
5. When a client crashes it sends `PlayerCrashed {distance}`. The **server** records it, decides the winner (last alive; longest distance if both crash), and broadcasts `MatchResult`.
6. If a player leaves the channel, the server ends the match and broadcasts `OpponentLeft`.

This answers guide question 3: the server, not either phone, decides the winner. Lag note: draw the opponent with interpolation between updates.

### Suggested API and database

| Endpoint | Purpose |
|---|---|
| `POST /api/players` | create a guest player (name + device id) |
| `POST /api/rooms`, `POST /api/rooms/{code}/join` | create / join a match |
| `POST /api/matches/{id}/result` | store final distances |
| `GET /api/leaderboard` | best distances (bonus: online leaderboard) |
| `POST /api/progress` / `GET /api/progress` | optional backup of unlocked levels and stars (bonus) |

Tables: `players (id, name, device_id)`, `rooms (id, code, seed, status)`, `matches (id, room_id, winner_id, created_at)`, `match_players (match_id, player_id, distance, alive)`, `progress (player_id, unlocked_level, stars_json)`.

Offline progress stays on the phone; syncing to Laravel is optional and must never block offline play.

## 4. Build and install on a phone

1. `pnpm run build` in `frontend/`.
2. `pnpm add @capacitor/core @capacitor/cli @capacitor/android`, then `pnpm exec cap init`, `pnpm exec cap add android`, `pnpm exec cap sync`.
3. Set portrait in `AndroidManifest.xml` and give Internet permission (included by default).
4. Open the `android/` folder in Android Studio, build APK, copy to the phone (same as lab Phase 7).
5. The API URL must be reachable from the phones: use the laptop's LAN IP on the same Wi-Fi (e.g. `http://192.168.1.23:8000`) or a free tunnel. Allow cleartext HTTP in the Capacitor config for local testing; use HTTPS if the server is public.
6. Never commit `.env`, keystores or Reverb secrets; add `.env`, `vendor/`, `node_modules/`, `android/app/build`, `*.apk` to `.gitignore`.

## 5. Updated phase plan

| Week | Frontend (React) | Backend (Laravel) |
|---|---|---|
| 1 | GDD, wireframes, Vite + React project, router, Git | Laravel project, database, Git |
| 2 | Title, menu, mode select, level select, store with save/load, Level 1 on canvas | Guest player endpoint |
| 3 | Levels 2-5, HUD, result screen, AI runner, PWA offline test | Progress endpoint (optional) |
| 4 | Lobby (create/join room), online match view, opponent drawing, error handling | Reverb setup, rooms, events, winner logic |
| 5 | Polish, sound, Capacitor APK, phone testing, playtest, fixes | Leaderboard (bonus), deployment notes, cleanup |

## 6. Frontend folder structure

```
frontend/src/
  main.jsx, App.jsx
  store/gameStore.js        unlockedLevel, bestStars, settings, save/load
  screens/                  Title, MainMenu, ModeSelect, LevelSelect, Result, Lobby, Settings, Credits
  game/
    GameCanvas.jsx          mounts Phaser/canvas
    RoadGenerator.js        seeded road segments
    levels.js               5 level configs
    Runner.js, AIRunner.js
  net/echo.js, api.js       Reverb client, REST calls
  components/               Button, PauseMenu, HUD, Toast
public/ assets, manifest.webmanifest
```
Seeded random: use a small PRNG such as mulberry32 so both phones create identical roads from the same seed.

## 7. Prompts to paste into Claude

### Prompt A - Context
```
I am building a mobile maze-runner game for a school lab (ITSD 85) using React 18
+ Vite + Phaser 3 for the frontend and Laravel + Reverb for the backend. Game:
two players run on the same endless road, dodge walls and traps, the last one
alive wins. Offline: 5 levels with unlocking (saved in localStorage), AI runner,
works in airplane mode (PWA). Online: room code, same seed for both phones,
server decides the winner. Package as an Android APK with Capacitor, portrait,
touch/swipe controls. Buttons at least 120 px, text at least 28 px.
Keep code simple, commented, and explain each file.
```

### Prompt B - One screen
```
Using the context above, create the <ScreenName> React component with its CSS,
navigation using React Router, and a back-button handler. It must be usable with one
thumb on a 360x640 phone. Include a short test checklist.
```

### Prompt C - Store and saving
```
Create a Zustand store with unlockedLevel, bestStars, soundOn, completeLevel(level,
stars) and automatic save/load to localStorage inside try/catch. Level n+1 must
stay locked until level n is cleared.
```

### Prompt D - Road generator and level
```
Write RoadGenerator.js that builds an endless 3-lane road from a numeric seed using
mulberry32, returning obstacle segments from 3 patterns (static wall, moving block,
narrow gap) with difficulty parameters (speed, gap size). Then write the Phaser scene
that runs it with swipe left/right/up controls and a HUD with goal text and timer.
```

### Prompt E - Laravel online backend
```
Create the Laravel backend: migrations for players, rooms, matches, match_players;
endpoints to create/join a room; Reverb presence channel room.{code}; events
MatchStarted, PlayerCrashed handling, MatchResult, OpponentLeft. The server decides
the winner (last alive; longer distance if both crash). Add validation and a
5-second client timeout example in React using laravel-echo.
```

### Prompt F - Online screen with errors
```
Create the Lobby and OnlineMatch React screens: create room, join with code, waiting
state, connection timeout after 5 seconds, error message with a button back to mode
select, opponent runner drawn with interpolation, and result screen for both players.
```

### Prompt G - Capacitor build
```
Give exact steps and config (capacitor.config.ts, AndroidManifest portrait lock,
cleartext HTTP for local testing) to build an Android APK from my Vite React app
and install it on a phone.
```

### Prompt H - Docs
```
Write docs/UI_SPEC.md and the README sections (how to run frontend and backend,
how to host/join, how to build the APK) for my project using this outline: <outline>.
Leave [TODO] where I must add screenshots.
```

## 8. Documentation changes needed
- GDD: add stack justification and instructor approval note; section 8 describes the room-code flow.
- README "How to build": Node version, `pnpm install`, `pnpm run dev`, `php artisan serve`, `php artisan reverb:start`, Capacitor steps.
- CREDITS.md: add libraries (React, Phaser, Laravel, Capacitor) and licenses with all art/sound assets.
- Paper section IV: change the architecture figure to the diagram in section 1; Listing 1 can be the `completeLevel` store function (20 lines or less).
- Guide question 6: compare web-wrapped Android with a native engine.

## 9. Extra risks

| Risk | Fallback |
|---|---|
| Phones cannot reach the Laravel server | Use same-Wi-Fi LAN IP or a free tunnel; test on day one of Week 4 |
| Reverb setup takes too long | Use polling every 500 ms on a `matches/{id}/state` endpoint (less smooth but works) |
| Canvas performance on a low-cost phone | Fewer sprites, reuse objects, cap at 30 fps |
| Instructor does not approve this stack | Fall back to the Godot plan in `FRONTEND_PLAN.md` |
