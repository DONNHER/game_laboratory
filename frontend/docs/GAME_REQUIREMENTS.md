# Maze Runner Game Requirements (ITSD 85)

## Overview
A fast-paced 3-lane mobile endless runner game where players dodge obstacles, navigate through traps, and compete either solo across 5 progressively harder stages, against an AI runner, or in a 2-player real-time multiplayer race over room codes.

## Requirements Checklist (R1 – R10)

- **R1: Core Game Mechanics**
  - 3-lane road with smooth switching (Left, Center, Right).
  - Jump/slide over lower hazards or slip through moving blocks and narrow gaps.
  - Increasing difficulty: speed acceleration, narrower gap clearances, combined hazard patterns.

- **R2: Level Goals & Progression**
  - 5 defined levels in the solo campaign.
  - Each level features distinct goal distance (e.g. 500m, 1000m, 1500m, 2000m, 3000m) and trap frequency.
  - Star rating system (1 to 3 stars based on completion, coin collection, and zero-crash clean runs).

- **R3: Result Screen & Feedback**
  - High-visibility result overlay upon goal reached or collision crash.
  - Shows distance achieved, stars awarded, coins collected, and elapsed run time.
  - Large touch targets for Retry, Next Level, and Main Menu.

- **R4: Level Select & Progression Locking**
  - Level 1 unlocked by default.
  - Level *n+1* remains locked until Level *n* is cleared with at least 1 star.
  - Clear visual lock state and disabled click handling for locked levels.

- **R5: Persistent Storage**
  - Saves unlocked level, star scores, high scores, and sound preferences to `localStorage`.
  - Survives browser reloads, phone app suspensions, and closing the app.

- **R6: Offline Support (Airplane Mode Ready)**
  - Solo campaign and AI rival mode operate 100% locally with zero external network requests.
  - Asset caching via Service Worker (PWA ready).

- **R7: Two-Player Synchronized Online Race**
  - Room code pairing system (e.g., 4-digit/character code).
  - Both players generate the exact same road layout using a shared numeric seed (`mulberry32` PRNG).
  - Live ghost runner rendering with position interpolation.

- **R8: Connection Robustness & 5-Second Timeout**
  - Mode selection safeguards against unreachable server states.
  - Enforces a 5-second connection timeout when creating/joining rooms.
  - Informative error toasts with a graceful return to the Mode Select screen.

- **R9: Mobile-First Touch & Phone APK Deployment**
  - Portrait orientation lock (designed for 360x640 mobile viewports).
  - Responsive swipe gesture detection + onscreen emergency tap controls.
  - Capacitor configuration ready for packaging into an Android APK.

- **R10: Mobile Ergonomics & Accessibility**
  - Primary button dimensions meet or exceed 120px width/height touch recommendations.
  - Crucial readable text sized at 28px or higher for small mobile displays.
  - Quick-access pause menu, audio FX & music toggle, and high-contrast visuals.

## Level Plan Matrix

| Level | Name | Target Goal | Base Speed | Gap Clearance | Hazards Introduced |
|---|---|---|---|---|---|
| 1 | Neon Alley | 500 m | 240 px/s | Wide (2 lanes) | Static concrete barricades |
| 2 | Cyber Strip | 1,000 m | 300 px/s | Medium | Moving laser beams + barricades |
| 3 | Tech Tunnel | 1,500 m | 360 px/s | Narrow (1 lane) | Oscillating sweep blocks |
| 4 | Grid Collapse | 2,200 m | 420 px/s | Tight gaps | Rapid alternating barriers |
| 5 | Quantum Core | 3,000 m | 500 px/s | Razor-thin | Chaos mixed traps + hyper speed |
