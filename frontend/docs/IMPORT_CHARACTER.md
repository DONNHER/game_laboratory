# How to Create & Import 3D Characters and Scenes in Godot Engine 4.7

> **Master Guide**: See [`CREATE_SCENE_AND_CHARACTER_IN_GODOT.md`](./CREATE_SCENE_AND_CHARACTER_IN_GODOT.md) for the full step-by-step walkthrough.

Maze Runner uses **Godot Engine 4.7 (MIT License)** exclusively for all 3D characters, track scenery, obstacles, power gems, and shaders.

---

## Quick Reference

`RunnerRig` (`frontend/godot/scripts/runner_rig.gd`) automatically loads custom character scenes from:

```text
frontend/godot/scenes/characters/<character_id>.tscn   (res://scenes/characters/<character_id>.tscn)
```

1. **Open Project Locally**: Import `frontend/godot/project.godot` in **Godot 4.7**.
2. **Sculpt Visually in Godot 4.7**: Save `custom_character_template.tscn` as `res://scenes/characters/<your_id>.tscn`, keep `preserve_scene_materials = true`, and edit `MeshInstance3D` parts under `BodyPivot/Hips/Torso/...`.
3. **Or Import `.glb` from Blender/Mixamo**: Drop `<your_id>.glb` into `frontend/godot/assets/models/`, delete `BodyPivot`, and place `<your_id>.glb` inside **`CustomModel`**.
4. **Register & Export**: Add `id: '<your_id>'` to `PREMADE_CHARACTERS` in [`frontend/src/game/characters.ts`](../src/game/characters.ts) and run `pnpm run godot:export`.
