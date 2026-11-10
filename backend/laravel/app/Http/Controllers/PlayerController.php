<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Player;

class PlayerController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'device_id' => 'required|string|max:64',
            'name' => 'required|string|max:32',
        ]);

        $player = Player::updateOrCreate(
            ['device_id' => $request->device_id],
            ['name' => $request->name, 'last_seen_at' => now()]
        );

        return response()->json(['success' => true, 'player' => $player]);
    }

    public function getProfile($deviceId)
    {
        $player = Player::where('device_id', $deviceId)->firstOrFail();
        return response()->json(['player' => $player]);
    }

    public function saveProgress(Request $request)
    {
        $request->validate([
            'device_id' => 'required|string',
            'unlocked_level' => 'required|integer',
            'best_stars' => 'required|array',
            'coins' => 'required|integer',
        ]);

        $player = Player::firstOrCreate(['device_id' => $request->device_id]);
        $player->unlocked_level = max($player->unlocked_level, $request->unlocked_level);
        $player->best_stars = json_encode($request->best_stars);
        $player->coins = $request->coins;
        $player->save();

        return response()->json(['success' => true]);
    }

    public function loadProgress($deviceId)
    {
        $player = Player::where('device_id', $deviceId)->first();

        if (!$player) {
            return response()->json(['exists' => false]);
        }

        return response()->json([
            'exists' => true,
            'unlocked_level' => $player->unlocked_level,
            'best_stars' => json_decode($player->best_stars, true),
            'coins' => $player->coins,
        ]);
    }
}
