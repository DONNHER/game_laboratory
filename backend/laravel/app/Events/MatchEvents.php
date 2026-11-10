<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcasted when both players have joined and countdown starts.
 */
class MatchStarted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $roomCode,
        public array $data
    ) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel('room.' . $this->roomCode);
    }
}

/**
 * Broadcasted when a player hits an obstacle and crashes.
 */
class PlayerCrashed implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $roomCode,
        public array $data
    ) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel('room.' . $this->roomCode);
    }
}

/**
 * Broadcasted by server when winner has been determined.
 */
class MatchResult implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $roomCode,
        public array $data
    ) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel('room.' . $this->roomCode);
    }
}

/**
 * Broadcasted when an opponent disconnects or leaves.
 */
class OpponentLeft implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $roomCode,
        public array $data
    ) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel('room.' . $this->roomCode);
    }
}
