<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PlayerController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\MatchController;

/*
|--------------------------------------------------------------------------
| API Routes for Maze Runner Game
|--------------------------------------------------------------------------
|
| These routes handle guest player registration, seeded room creation,
| Laravel Reverb matchmaking, and server-authoritative winner determination.
|
*/

// Player & Device Identity
Route::post('/players', [PlayerController::class, 'register']);
Route::get('/players/{deviceId}', [PlayerController::class, 'getProfile']);

// Room Matchmaking (Prompt E / R7)
Route::post('/rooms', [RoomController::class, 'store']);
Route::post('/rooms/{code}/join', [RoomController::class, 'join']);
Route::get('/rooms/{code}', [RoomController::class, 'show']);

// Real-Time Match Control & Crash Authoritative Handling (Prompt E)
Route::post('/matches/{id}/start', [MatchController::class, 'start']);
Route::post('/matches/{id}/crash', [MatchController::class, 'handleCrash']);
Route::post('/matches/{id}/leave', [MatchController::class, 'handleLeave']);

// Leaderboard & Cloud Progress (Bonus R5 Backup)
Route::get('/leaderboard', [MatchController::class, 'leaderboard']);
Route::post('/progress', [PlayerController::class, 'saveProgress']);
Route::get('/progress/{deviceId}', [PlayerController::class, 'loadProgress']);
