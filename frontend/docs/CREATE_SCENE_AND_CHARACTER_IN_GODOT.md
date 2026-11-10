# How to Create a 3D Scene & Character in Godot Engine 4.7 (and Use It in This Project)

This project runs **100% on Godot Engine 4.7 (MIT License)** for all 3D rendering, physics/collision evaluation, lighting, fog milestones, power gems, and character animations—both on the web (`WebAssembly` + `WebGL2`) and natively inside the **Godot 4.7 Desktop Editor**.

---

## 1. Open the Project Visually in Godot 4.7

1. Open **Godot Engine 4.7** on your laptop.
2. In the **Project Manager**, click **Import** -> browse to this repository -> select **`frontend/godot/project.godot`** -> click **Import & Edit**.
3. Switch to the **3D** viewport tab at the top center of the editor:
   - Press **`F5`** at any time to test a live 3D race directly inside Godot Desktop!
   - Double-click any `.tscn` file in the bottom-left **FileSystem (`res://`)** dock to edit it visually:

| Scene File (`frontend/godot/scenes/...`) | Purpose |
| :--- | :--- |
| `res://scenes/main.tscn` | Main 3D race arena, `WorldEnvironment` (fog/sky), `ChaseCamera`, `KeyLight`, `RimLight`, `ShowcaseStage`, `PlayerRig`, and `OpponentRig` |
| `res://scenes/highway_segment.tscn` | 3-lane neon cyber highway deck, glowing rails, lane dividers, and scrolling city pylons |
| `res://scenes/runner_rig.tscn` | Base articulated 3D runner rig shared by palette characters (`kai`, `blaze`, `nova`, `luna`) |
| `res://scenes/characters/zephyr.tscn` | **Working custom `.tscn` character example** (*Zephyr — Phantom Blade*) with custom violet-gold armor, kabuto horns, and twin plasma katanas |
| `res://scenes/characters/custom_character_template.tscn` | **Starter character template** ready to duplicate (`Ctrl+D`) for sculpting or `.glb` model import |
| `res://scenes/obstacles/*.tscn` | Individual 3D scenes for `wall`, `moving_block`, `laser`, `slow_bump`, `coin`, `shield_gem`, `fly_gem`, `milestone_gate`, and `finish_gate` |
| `res://scenes/obstacles/custom_obstacle_template.tscn` | **Starter obstacle/pickup scene template** ready to duplicate for new track props |

---

## 2. How to Create a New 3D Character in Godot 4.7

`RunnerRig` (`frontend/godot/scripts/runner_rig.gd`) automatically checks if a scene exists at:
```text
res://scenes/characters/<character_id>.tscn
```
*(In your local folder: `frontend/godot/scenes/characters/<character_id>.tscn`)*

You can build a custom character using **either Method A (sculpting in Godot)** or **Method B (importing a `.glb` / Blender / Mixamo model)**.

---

### Method A: Create / Sculpt a Character Directly in Godot 4.7 Editor

Best when you want to build stylized cyber armor, helmets, capes, wings, weapons, and neon materials right inside Godot's 3D Viewport (just like `res://scenes/characters/zephyr.tscn`).

1. **Duplicate the Template Scene**:
   - In Godot's **FileSystem** dock, open `res://scenes/characters/custom_character_template.tscn` (or `res://scenes/characters/zephyr.tscn`).
   - Click **Scene -> Save Scene As...** and save it as:
     ```text
     res://scenes/characters/valkyrie.tscn
     ```
     *(Use a lowercase ID—this filename `valkyrie` becomes your `characterId`!)*

2. **Configure Root Inspector Settings**:
   - Click the root node (`CustomCharacterTemplate`) in the **Scene** dock and rename it to `ValkyrieCharacter` (optional).
   - In the **Inspector** dock on the right:
     - Set **`Character Id`** -> `valkyrie`
     - Keep **`Preserve Scene Materials`** -> **Checked (`true`)** *(this tells the game to keep every custom color/material you assign in the Godot Editor)*
     - Set **`Default Wing Alpha`** -> `0.0` (hidden until picking up a Flight Gem) or `0.45` (always-visible holo-wings).

3. **Customize 3D Meshes & Materials Visually**:
   - Expand `BodyPivot -> Hips -> Torso` and `HeadPivot` in the **Scene** dock:
     - Attach helmets, horns, halos, or visors under **`BodyPivot/Hips/Torso/HeadPivot`**.
     - Attach chest armor, jetpacks, swords, or capes under **`BodyPivot/Hips/Torso`**.
     - Attach shoulder pads or gauntlets under **`ArmL`** and **`ArmR`**.
     - Attach greaves or boots under **`LegL`** and **`LegR`**.
   - To add a new 3D part: right-click a joint (e.g., `HeadPivot`) -> **Add Child Node...** -> choose **`MeshInstance3D`** -> in the Inspector set **Mesh** (`BoxMesh`, `SphereMesh`, `CylinderMesh`, `PrismMesh`, `TorusMesh`) and assign a **`StandardMaterial3D`** in **Material Override** (enable **Emission** for neon glow!).
   - Press **`Ctrl+S` (`Cmd+S` on Mac)** to save the scene.

Because the joint hierarchy (`Hips`, `Torso`, `HeadPivot`, `ArmL`, `ArmR`, `LegL`, `LegR`) is preserved, your character automatically gets full **Sprint, Jump, Slide, 2x Invincible Sky Flight, 3s Shield Dome, Crash Tumble, and Runner Locker Showcase** animations!

---

### Method B: Import an External 3D Character (`.glb` / `.gltf` from Blender, Mixamo, or Blockbench)

Best when you have a rigged skeletal character with animations (`Run`, `Jump`, `Slide`, `Idle`, `Fly`).

1. **Export Rules (Blender / Mixamo)**:
   - Format: **glTF 2.0 Binary (`.glb`)** with **Include -> Animations** enabled.
   - Scale & Grounding: Character ~`1.7m – 1.9m` tall (`1 unit = 1 meter`), feet resting at **`Y = 0`**.
   - Forward Direction: Character facing **`-Z`** (Godot's forward direction, away from the chase camera). If your model faces `+Z`, simply set `Rotation Y = 180°` on `CustomModel` inside Godot!

2. **Import into Godot**:
   - Create folder `frontend/godot/assets/models/` (if it doesn't exist) and copy your file in, e.g. `frontend/godot/assets/models/cyber_ninja.glb`.
   - Focus the Godot 4.7 window—Godot automatically imports the `.glb` mesh, textures, skeleton, and `AnimationPlayer`.
   - *(Tip)* Double-click `cyber_ninja.glb` in Godot's FileSystem dock -> go to the **Actions...** / **Animation** tab -> set your `Run` and `Idle` animations to **Loop Mode: Linear** -> click **Reimport**.

3. **Wrap in a Character `.tscn` Scene**:
   - Open `res://scenes/characters/custom_character_template.tscn` and click **Scene -> Save Scene As...** -> `res://scenes/characters/cyber_ninja.tscn`.
   - Delete the **`BodyPivot`** node from the Scene dock (since you are using your `.glb` mesh instead of the procedural joints).
   - Drag `res://assets/models/cyber_ninja.glb` from the FileSystem dock **onto the `CustomModel` node** so it becomes a child of `CustomModel` at position `(0, 0, 0)`.
   - Save the scene (`Ctrl+S`).

4. **Automatic Animation Mapping**:
   - `RunnerRig` automatically locates the `AnimationPlayer` inside `CustomModel` and crossfades animations matching these names (case-insensitive):
     - **Running**: `run`, `sprint`, `jog`, `walk` *(scales playback speed dynamically with km/h!)*
     - **Jumping**: `jump`, `leap`, `air` *(plus automatic 3D parabolic jump height)*
     - **Sliding**: `slide`, `roll`, `duck`, `crouch`
     - **Sky Flight (Gold Power Gem)**: `fly`, `glide`, `hover` *(plus automatic aerial elevation)*
     - **Locker Idle**: `idle`, `stand`, `breathe`
   - Grounded `ContactShadow`, `RivalDiamond`, and the 3-second `ShieldGroup` energy dome are attached and animated automatically!

---

## 3. How to Create or Edit a 3D Scene (Track, Lighting, or Obstacles)

### A. Edit the Highway Track or Environment Visually
- **Lighting, Sky & Fog**: Open `res://scenes/main.tscn` and select **`WorldEnvironment`**, **`KeyLight`**, or **`RimLight`** to tweak ACES tonemapping, ambient sky tint, directional light angles, or chase camera FOV.
- **Road & City Scenery**: Open `res://scenes/highway_segment.tscn` to add 3D buildings, arches, billboards, or custom neon rails along the sides of the 3-lane highway (`x < -4.2` or `x > +4.2` so they stay outside the playable lanes).
  - Note: Any child added under `SceneryRibs/Rib_0`..`Rib_15` scrolls seamlessly at the player's exact speed!

### B. Edit an Existing Obstacle or Power Gem
- Open any scene in `res://scenes/obstacles/` (for example `wall.tscn`, `laser.tscn`, `coin.tscn`, `shield_gem.tscn`, `fly_gem.tscn`), edit its 3D meshes/materials, and save (`Ctrl+S`).
- **3-Lane Scale Reference**:
  - Lane centers are at **`X = -2.4` (Left)**, **`X = 0.0` (Center)**, and **`X = +2.4` (Right)**.
  - Keep single-lane obstacles around **`1.6m – 1.9m` wide** so they fit cleanly inside one `2.4m` lane.
  - Road surface is at **`Y = 0.0`**.
  - For spinning pickups (`coin.tscn`, `shield_gem.tscn`, `fly_gem.tscn`), place rotating meshes inside the **`SpinPivot`** child node—`main.gd` automatically spins `SpinPivot` at 60 FPS!

### C. Create a Brand-New Obstacle Scene
1. Open `res://scenes/obstacles/custom_obstacle_template.tscn` and click **Scene -> Save Scene As...** -> `res://scenes/obstacles/plasma_mine.tscn`.
2. Edit the 3D meshes and save (`Ctrl+S`).
3. Register its path in `frontend/godot/scripts/world_builder.gd` inside `OBSTACLE_SCENE_PATHS`:
   ```gdscript
   const OBSTACLE_SCENE_PATHS: Dictionary = {
       "WALL": "res://scenes/obstacles/wall.tscn",
       "MOVING_BLOCK": "res://scenes/obstacles/moving_block.tscn",
       "LASER": "res://scenes/obstacles/laser.tscn",
       "SLOW_BUMP": "res://scenes/obstacles/slow_bump.tscn",
       "COIN": "res://scenes/obstacles/coin.tscn",
       "SHIELD_GEM": "res://scenes/obstacles/shield_gem.tscn",
       "FLY_GEM": "res://scenes/obstacles/fly_gem.tscn"
   }
   ```
   *(Or point an existing key like `"WALL"` to `"res://scenes/obstacles/plasma_mine.tscn"` to swap visuals immediately!)*

---

## 4. How to Use Your Godot Character & Scenes in This Web Project

Once you save your `.tscn` files in Godot 4.7, follow these **3 quick steps** to see them live in the React web app:

### Step 1: Register Your Character Card in `frontend/src/game/characters.ts`
 *(Skip this step if you only edited existing scenes like `main.tscn`, `highway_segment.tscn`, `zephyr.tscn`, or `obstacles/*.tscn`.)*

Open **`frontend/src/game/characters.ts`** and add an entry to `PREMADE_CHARACTERS` whose **`id` exactly matches your `.tscn` filename** (e.g., `valkyrie` for `frontend/godot/scenes/characters/valkyrie.tscn`):

```ts
  {
    id: 'valkyrie', // <-- Matches frontend/godot/scenes/characters/valkyrie.tscn
    name: 'Valkyrie',
    gender: 'GIRL',
    title: 'Solar Striker',
    subtitle: 'Custom Godot Runner',
    description: 'Custom 3D character authored in Godot Engine 4.7 with solar wings and plasma lance.',
    lore: 'Forged in the orbital spire circuits.',
    accentColor: '#f59e0b',
    secondaryColor: '#d97706',
    glowColor: '#fbbf24',
    textColorClass: 'text-amber-400',
    dotColorClass: 'bg-amber-400',
    speedRating: 95,
    agilityRating: 93,
    armorRating: 85,
    tags: ['Solar Wings', 'Custom .tscn', 'High Speed'],
  },
```
*(Online multiplayer in `backend/server.ts` automatically accepts any lowercase alphanumeric/underscore `characterId`, so 2-player Online Matches work automatically!)*

### Step 2: Pack Your Godot Scenes into `frontend/public/godot/maze_runner.pck`

Because the Godot 4.7 WebAssembly engine chunks (`frontend/public/godot/wasm/chunk_00.bin`..`chunk_19.bin`) are already built into this repository, **you do NOT need to download the 800 MB Godot Web Export Templates** just to update scenes, characters, or GDScript!

Run this single command from the project root terminal (ensure `godot` is in your PATH, or export via the Godot GUI below):

```bash
pnpm run godot:export
```

**Alternative — Exporting from the Godot 4.7 Editor GUI (No CLI PATH required):**
1. In Godot 4.7, click **Project -> Export...**
2. Select the **`Web`** preset.
3. Click **`Export PCK/Zip...`** at the bottom of the dialog (next to *Export Project...*).
4. Save over **`frontend/public/godot/maze_runner.pck`**.
5. Run **`node frontend/scripts/pack-godot-wasm.mjs`** in your terminal so `manifest.json` and `host.html` sync the new `.pck` file size for the loading progress bar.

*(Note: Only use `pnpm run godot:export:full` if you upgrade Godot to a newer engine version and want to rebuild the WebAssembly `.wasm` binary itself.)*

### Step 3: Run & Test in the Browser
```bash
pnpm run dev
```
1. Open **`http://localhost:3000`** — the pre-home loading screen streams the Godot 4.7 engine and pre-warms your new character/scene shaders to `100%`.
2. Click **Runners** on the Home Menu to open the **Runner Locker** — select your new character (try **Zephyr**, included as a live `.tscn` example!), drag to rotate 360°, and test **`RUN`**, **`JUMP`**, **`SLIDE`**, **`FLY`**, and **`IDLE`**.
3. Click **Play as [Name]** to race in **Solo**, **AI Rival**, or **2-Player Online Match**!
