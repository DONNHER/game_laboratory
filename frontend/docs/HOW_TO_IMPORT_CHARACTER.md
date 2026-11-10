# How to Create a Scene & Character in Godot Engine 4.7

> Complete step-by-step guide: **[`CREATE_SCENE_AND_CHARACTER_IN_GODOT.md`](./CREATE_SCENE_AND_CHARACTER_IN_GODOT.md)** (also summarized in [`IMPORT_CHARACTER.md`](./IMPORT_CHARACTER.md)).

1. **Open Project Locally**: Import `frontend/godot/project.godot` in Godot 4.7 Desktop Editor (`F5` runs a standalone 3D race).
2. **Create a Character (`.tscn` or `.glb`)**: Save `res://scenes/characters/custom_character_template.tscn` as `res://scenes/characters/<your_id>.tscn`.
3. **Create / Edit a 3D Scene**: Edit `res://scenes/main.tscn`, `res://scenes/highway_segment.tscn`, or `res://scenes/obstacles/*.tscn`.
4. **Use in Web App**: Add `<your_id>` to `PREMADE_CHARACTERS` in `frontend/src/game/characters.ts`, run `pnpm run godot:export`, then `pnpm run dev`.
