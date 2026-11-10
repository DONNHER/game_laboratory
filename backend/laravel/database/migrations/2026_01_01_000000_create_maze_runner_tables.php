<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Players table
        Schema::create('players', function (Blueprint $table) {
            $table->id();
            $table->string('device_id')->unique();
            $table->string('name')->default('Runner');
            $table->integer('unlocked_level')->default(1);
            $table->json('best_stars')->nullable();
            $table->integer('coins')->default(0);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        // 2. Rooms table (Prompt E: 4-digit code + seed)
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 6)->unique();
            $table->unsignedBigInteger('seed');
            $table->string('host_name');
            $table->string('host_device');
            $table->string('guest_name')->nullable();
            $table->string('guest_device')->nullable();
            $table->string('status')->default('WAITING'); // WAITING, READY, RACING, FINISHED
            $table->timestamps();
        });

        // 3. Matches table
        Schema::create('matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->string('winner_device')->nullable();
            $table->string('status')->default('STARTING');
            $table->timestamps();
        });

        // 4. Match Players table
        Schema::create('match_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('matches')->cascadeOnDelete();
            $table->string('player_device');
            $table->decimal('distance', 10, 2)->default(0);
            $table->boolean('crashed')->default(false);
            $table->string('crash_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_players');
        Schema::dropIfExists('matches');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('players');
    }
};
