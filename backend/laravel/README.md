# Maze Runner - Laravel 11 + Reverb WebSocket Backend

This directory contains the complete backend application for the **Mobile Maze Runner** (ITSD 85 School Lab).

## Features
- **Deterministic Matchmaking**: Generates 4-character room codes (`POST /api/rooms`) and shares random seeds for identical 3-lane road generation.
- **Server-Authoritative Winner Logic**: Handles player crash notifications (`POST /api/matches/{id}/crash`) and declares the survivor (or longer distance runner) as the winner.
- **Real-Time WebSockets**: Powered by **Laravel Reverb** presence channels (`room.{code}`) with `MatchStarted`, `PlayerCrashed`, `MatchResult`, and `OpponentLeft` events.
- **Guest Profiles & Leaderboard**: Stores player device IDs, high distances, and cloud progress backups.

---

## Quick Setup & Execution

### 1. Requirements
- PHP 8.2 or higher
- Composer
- SQLite or MySQL

### 2. Installation
```bash
cd laravel_backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
```

### 3. Start the HTTP API Server
```bash
php artisan serve --host=0.0.0.0 --port=8000
```

### 4. Start the Laravel Reverb WebSocket Server
```bash
php artisan reverb:start --port=8080
```

---

## Connecting with `react_frontend/`
Set your `.env` in `react_frontend/`:
```env
VITE_API_URL="http://YOUR_LOCAL_IP:8000/api"
VITE_REVERB_HOST="YOUR_LOCAL_IP"
VITE_REVERB_PORT="8080"
```
*(Use your computer's Wi-Fi LAN IP such as `192.168.1.x` so real Android phones can connect).*
