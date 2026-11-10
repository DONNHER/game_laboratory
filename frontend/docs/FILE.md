# Maze Runner 3D — Two-Folder Architecture Blueprint (`backend/` + `frontend/`)

This repository is organized into **two clean top-level directories**: **`backend/`** and **`frontend/`**.

---

## 📁 Repository Structure

```text
maze-runner/
├── backend/                                    # 🖥️ Multiplayer Server & Backend Services
│   ├── server.ts                               # Express + ws real-time 2-player room & Godot WASM server (port 3000)
│   ├── render.yaml                             # Cloud WebSocket deployment blueprint
│   ├── README.md                               # Backend setup & runtime instructions
│   └── laravel/                                # Optional Laravel 11 + Reverb PHP backend
│       ├── app/
│       ├── database/
│       ├── routes/
│       └── composer.json
│
└── frontend/                                   # 🎮 React 19 UI + Godot Engine 4.7 (MIT) 3D Project
    ├── index.html                              # Web entry point
    ├── capacitor.config.ts                     # Capacitor Android APK configuration
    ├── README.md                               # Frontend & Godot quick start
    ├── godot/                                  # Open frontend/godot/project.godot in Godot 4.7 Desktop Editor!
    │   ├── project.godot
    │   ├── export_presets.cfg
    │   ├── scripts/
    │   │   ├── main.gd                         # 3D race loop, SI speed (1 kph = 1/3.6 m/s), fog/speed milestones
    │   │   ├── runner_rig.gd                   # Articulated & .glb character loader (res://scenes/characters/<id>.tscn)
    │   │   ├── world_builder.gd                # Instantiates editable obstacle & gate .tscn scenes
    │   │   └── road_generator.gd               # Seeded 3-lane procedural obstacle, coin & power-gem generator
    │   └── scenes/
    │       ├── main.tscn                       # Editable 3D arena (WorldEnvironment, ChaseCamera, Lights, Rigs)
    │       ├── highway_segment.tscn            # Editable 3-lane cyber highway, neon rails & city pylons
    │       ├── runner_rig.tscn                 # Base 3D runner rig scene
    │       ├── characters/
    │       │   ├── zephyr.tscn                 # Custom Godot 4.7 character scene (Zephyr — Cyber Ronin)
    │       │   └── custom_character_template.tscn
    │       └── obstacles/
    │           ├── wall.tscn, moving_block.tscn, laser.tscn, slow_bump.tscn
    │           ├── coin.tscn, shield_gem.tscn, fly_gem.tscn
    │           ├── milestone_gate.tscn, finish_gate.tscn
    │           └── custom_obstacle_template.tscn
    ├── public/godot/                           # Compiled Godot 4.7 Web Runtime & 512 KB Streaming Chunks
    ├── scripts/pack-godot-wasm.mjs             # Syncs maze_runner.pck size & packs WASM chunks
    ├── src/                                    # React 19 + Tailwind CSS UI screens, store & Godot bridge
    └── docs/                                   # Step-by-step guides & specifications
        └── CREATE_SCENE_AND_CHARACTER_IN_GODOT.md
```
