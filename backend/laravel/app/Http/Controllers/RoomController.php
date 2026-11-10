<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\Room;
use App\Models\MatchSession;
use App\Events\MatchStarted;

class RoomController extends Controller
{
    /**
     * Create a new match room with a seeded PRNG for identical road generation.
     */
    public function store(Request $request)
    {
        $request->validate([
            'host_name' => 'required|string|max:32',
            'device_id' => 'required|string|max:64',
        ]);

        // Generate 4-digit unique room code
        $code = strtoupper(Str::random(4));
        while (Room::where('code', $code)->exists()) {
            $code = strtoupper(Str::random(4));
        }

        // Seeded 32-bit integer for deterministic mulberry32 obstacle generation
        $seed = mt_rand(100000, 99999999);

        $room = Room::create([
            'code' => $code,
            'seed' => $seed,
            'host_name' => $request->host_name,
            'host_device' => $request->device_id,
            'status' => 'WAITING',
        ]);

        return response()->json([
            'success' => true,
            'code' => $room->code,
            'seed' => $room->seed,
            'host_name' => $room->host_name,
            'message' => 'Room created successfully. Share this code with Player 2.',
        ], 201);
    }

    /**
     * Join an existing room via 4-character code.
     */
    public function join(Request $request, $code)
    {
        $request->validate([
            'guest_name' => 'required|string|max:32',
            'device_id' => 'required|string|max:64',
        ]);

        $room = Room::where('code', strtoupper($code))->first();

        if (!$room) {
            return response()->json([
                'success' => false,
                'message' => 'Room code not found. Please verify the code and try again.',
            ], 404);
        }

        if ($room->status !== 'WAITING') {
            return response()->json([
                'success' => false,
                'message' => 'Room is already full or match in progress.',
            ], 409);
        }

        $room->guest_name = $request->guest_name;
        $room->guest_device = $request->device_id;
        $room->status = 'READY';
        $room->save();

        // Create match session
        $match = MatchSession::create([
            'room_id' => $room->id,
            'status' => 'STARTING',
        ]);

        // Broadcast MatchStarted event over Laravel Reverb presence channel
        event(new MatchStarted($room->code, [
            'match_id' => $match->id,
            'seed' => $room->seed,
            'host_name' => $room->host_name,
            'guest_name' => $room->guest_name,
            'start_at' => now()->addSeconds(3)->timestamp,
        ]));

        return response()->json([
            'success' => true,
            'match_id' => $match->id,
            'code' => $room->code,
            'seed' => $room->seed,
            'host_name' => $room->host_name,
            'guest_name' => $room->guest_name,
        ]);
    }

    public function show($code)
    {
        $room = Room::where('code', strtoupper($code))->first();

        if (!$room) {
            return response()->json(['message' => 'Room not found'], 404);
        }

        return response()->json(['room' => $room]);
    }
}
