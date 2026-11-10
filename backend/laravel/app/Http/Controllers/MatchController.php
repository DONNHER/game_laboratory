<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Room;
use App\Models\MatchSession;
use App\Models\MatchPlayer;
use App\Events\PlayerCrashed;
use App\Events\MatchResult;
use App\Events\OpponentLeft;

class MatchController extends Controller
{
    /**
     * Server-authoritative crash handler (Prompt E).
     * The server decides the winner based on who survived longer.
     */
    public function handleCrash(Request $request, $id)
    {
        $request->validate([
            'player_device' => 'required|string',
            'distance' => 'required|numeric',
            'crash_reason' => 'nullable|string',
        ]);

        $match = MatchSession::with('room')->findOrFail($id);

        // Record player crash
        $mp = MatchPlayer::firstOrCreate([
            'match_id' => $match->id,
            'player_device' => $request->player_device,
        ]);

        $mp->distance = $request->distance;
        $mp->crashed = true;
        $mp->crash_reason = $request->crash_reason;
        $mp->save();

        $room = $match->room;

        // Broadcast to Reverb presence channel so opponent sees visual crash explosion
        event(new PlayerCrashed($room->code, [
            'player_device' => $request->player_device,
            'distance' => $request->distance,
            'reason' => $request->crash_reason,
        ]));

        // Determine if match ended:
        $allPlayers = MatchPlayer::where('match_id', $match->id)->get();
        if ($allPlayers->count() >= 2) {
            // Both have crashed -> server decides winner by distance
            $winner = $allPlayers->sortByDesc('distance')->first();
            $loser = $allPlayers->sortBy('distance')->first();

            $match->winner_device = $winner->player_device;
            $match->status = 'FINISHED';
            $match->save();

            event(new MatchResult($room->code, [
                'match_id' => $match->id,
                'winner_device' => $winner->player_device,
                'winner_distance' => $winner->distance,
                'loser_distance' => $loser->distance,
                'reason' => 'Longer distance achieved in seeded road race.',
            ]));
        }

        return response()->json([
            'success' => true,
            'status' => $match->status,
        ]);
    }

    public function handleLeave(Request $request, $id)
    {
        $match = MatchSession::with('room')->findOrFail($id);
        $room = $match->room;

        event(new OpponentLeft($room->code, [
            'leaving_device' => $request->player_device,
            'message' => 'Opponent left the match.',
        ]));

        $match->status = 'OPPONENT_LEFT';
        $match->save();

        return response()->json(['success' => true]);
    }

    public function leaderboard()
    {
        $top = MatchPlayer::orderByDesc('distance')
            ->limit(10)
            ->get(['player_device', 'distance', 'created_at']);

        return response()->json(['leaderboard' => $top]);
    }
}
