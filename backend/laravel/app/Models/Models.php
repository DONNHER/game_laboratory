<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Player extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id',
        'name',
        'unlocked_level',
        'best_stars',
        'coins',
        'last_seen_at',
    ];

    protected $casts = [
        'best_stars' => 'json',
        'last_seen_at' => 'datetime',
    ];
}

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'seed',
        'host_name',
        'host_device',
        'guest_name',
        'guest_device',
        'status',
    ];

    public function matches()
    {
        return $this->hasMany(MatchSession::class);
    }
}

class MatchSession extends Model
{
    use HasFactory;

    protected $table = 'matches';

    protected $fillable = [
        'room_id',
        'winner_device',
        'status',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function players()
    {
        return $this->hasMany(MatchPlayer::class, 'match_id');
    }
}

class MatchPlayer extends Model
{
    use HasFactory;

    protected $fillable = [
        'match_id',
        'player_device',
        'distance',
        'crashed',
        'crash_reason',
    ];

    public function match()
    {
        return $this->belongsTo(MatchSession::class, 'match_id');
    }
}
