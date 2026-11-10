extends Node3D

# Maze Runner 3D - Powered by Godot Engine 4.7 (MIT License)
const MPS_PER_KPH: float = 1.0 / 3.6
const SHIELD_GEM_DURATION_SEC: float = 3.0
const FLY_GEM_DURATION_SEC: float = 4.0
const FLY_GEM_SPEED_MULTIPLIER: float = 2.0

# Scene Nodes (bound from editable res://scenes/main.tscn)
var world_env: WorldEnvironment
var env_res: Environment
var camera: Camera3D
var road_root: Node3D
var showcase_stage: Node3D
var obstacles_root: Node3D
var gates_root: Node3D
var particles_root: Node3D
var player_rig: RunnerRig
var opponent_rig: RunnerRig

var lane_markers: Array[MeshInstance3D] = []
var scenery_ribs: Array[Node3D] = []
var road_edge_left_mat: StandardMaterial3D
var road_edge_right_mat: StandardMaterial3D

# JavaScriptBridge persistent references (MUST stay referenced on self!)
var _is_web: bool = false
var _js_cmd_cb: Variant = null

# Active Level, Mode & Locker Showcase State
var game_mode: String = "SOLO"
var is_paused: bool = false
var race_started: bool = false
var showcase_active: bool = false
var showcase_pose: String = "RUN"
var showcase_yaw: float = 0.35
var showcase_pitch: float = 0.14
var showcase_is_desktop: bool = true
var showcase_auto_spin: bool = true
var showcase_drag_cooldown: float = 0.0
var game_over_handled: bool = false
var elapsed_time: float = 0.0

var level_id: int = 1
var goal_distance: float = 800.0
var base_speed_kph: float = 46.0
var max_base_speed_kph: float = 62.0
var speed_increment: float = 2.2
var obstacle_interval: float = 31.0
var accent_hex: String = "#06b6d4"
var allowed_traps: Array = ["WALL", "SLOW_BUMP"]
var milestones: Array = []

var base_sky_color: Color = Color(0.024, 0.043, 0.102)
var fog_mist_color: Color = Color(0.18, 0.30, 0.46)

# Player Runtime State
var p_lane: int = 0
var p_target_lane: int = 0
var p_x_offset: float = 0.0
var p_is_jumping: bool = false
var p_jump_progress: float = 0.0
var p_jump_buffer_timer: float = 0.0
var p_is_sliding: bool = false
var p_slide_progress: float = 0.0
var p_distance: float = 0.0
var p_coins: int = 0
var p_is_alive: bool = true
var p_crash_reason: String = ""
var p_crash_elapsed: float = 0.0
var p_slow_timer: float = 0.0
var p_shield_timer: float = 0.0
var p_fly_timer: float = 0.0
var p_fly_landing_grace: float = 0.0
var p_fly_blend: float = 0.0

# Opponent / AI Rival Runtime State
var opponent_name: String = "Apex Rival"
var opp_lane: int = 0
var opp_target_lane: int = 0
var opp_x_offset: float = 0.0
var opp_distance: float = 0.0
var opp_is_alive: bool = true
var opp_crash_distance: float = 600.0
var opp_is_jumping: bool = false
var opp_jump_progress: float = 0.0
var opp_is_sliding: bool = false
var opp_slide_progress: float = 0.0
var opp_crash_elapsed: float = 0.0
var opp_slow_timer: float = 0.0
var opp_shield_timer: float = 0.0
var opp_fly_timer: float = 0.0
var opp_fly_blend: float = 0.0
var same_lane_blend: float = 0.0

# Online Match Dead-Reckoning State
var net_server_distance: float = 0.0
var net_server_speed: float = 54.0
var net_packet_age: float = 0.0
var net_has_packet: bool = false
var net_immediate_flush: bool = false
var net_reported_finish: bool = false
var net_finish_fallback_timer: float = -1.0
var net_forfeit_timer: float = -1.0
var net_auth_result: Dictionary = {}

# Obstacles, Gates & Particles
var obstacles_data: Array = []
var obstacle_nodes: Dictionary = {}
var gate_entries: Array = []
var burst_particles: Array = []

# Milestones & Camera Shake
var triggered_milestones: Dictionary = {}
var active_milestone: Dictionary = {}
var smoothed_speed_mult: float = 1.0
var smoothed_fog_blend: float = 0.0
var hud_emit_timer: float = 0.0
var net_emit_timer: float = 0.0
var shake_amount: float = 0.0
var shake_duration: float = 0.0
var shake_elapsed: float = 0.0

# Touch Swipe State (direct canvas fallback)
var _touch_start_pos: Vector2 = Vector2.ZERO
var _touch_active: bool = false
var _touch_handled: bool = false


func _ready() -> void:
	_bind_or_build_scene_tree()

	_is_web = OS.has_feature("web")
	if _is_web:
		_setup_js_bridge()
	else:
		# Standalone Godot 4.7 Editor preview run (F5)!
		_start_standalone_default_run()


func _bind_or_build_scene_tree() -> void:
	world_env = get_node_or_null("WorldEnvironment") as WorldEnvironment
	if world_env != null and world_env.environment != null:
		env_res = world_env.environment
	else:
		_build_environment_and_lights()

	camera = get_node_or_null("ChaseCamera") as Camera3D
	if camera == null:
		camera = Camera3D.new()
		camera.name = "ChaseCamera"
		camera.fov = 65.0
		camera.near = 0.1
		camera.far = 220.0
		camera.current = true
		camera.look_at_from_position(Vector3(0.0, 3.6, 5.2), Vector3(0.0, 1.4, -12.0), Vector3.UP)
		add_child(camera)

	road_root = get_node_or_null("RoadRoot") as Node3D
	if road_root != null:
		_collect_highway_refs_from_scene()
	else:
		_build_highway()

	showcase_stage = get_node_or_null("ShowcaseStage") as Node3D
	if showcase_stage == null:
		showcase_stage = _build_showcase_stage()
		showcase_stage.visible = false
		add_child(showcase_stage)
	else:
		showcase_stage.visible = false

	obstacles_root = get_node_or_null("ObstaclesRoot") as Node3D
	if obstacles_root == null:
		obstacles_root = Node3D.new()
		obstacles_root.name = "ObstaclesRoot"
		add_child(obstacles_root)

	gates_root = get_node_or_null("GatesRoot") as Node3D
	if gates_root == null:
		gates_root = Node3D.new()
		gates_root.name = "GatesRoot"
		add_child(gates_root)

	particles_root = get_node_or_null("ParticlesRoot") as Node3D
	if particles_root == null:
		particles_root = Node3D.new()
		particles_root.name = "ParticlesRoot"
		add_child(particles_root)

	player_rig = get_node_or_null("PlayerRig") as RunnerRig
	if player_rig == null:
		player_rig = RunnerRig.new()
		player_rig.name = "PlayerRig"
		add_child(player_rig)
	player_rig.setup("kai", false)

	opponent_rig = get_node_or_null("OpponentRig") as RunnerRig
	if opponent_rig == null:
		opponent_rig = RunnerRig.new()
		opponent_rig.name = "OpponentRig"
		add_child(opponent_rig)
	opponent_rig.setup("blaze", true)
	opponent_rig.visible = false


func _collect_highway_refs_from_scene() -> void:
	lane_markers.clear()
	scenery_ribs.clear()
	var left_rail: MeshInstance3D = road_root.find_child("LeftRail", true, false) as MeshInstance3D
	var right_rail: MeshInstance3D = road_root.find_child("RightRail", true, false) as MeshInstance3D
	if left_rail != null and left_rail.material_override is StandardMaterial3D:
		road_edge_left_mat = (left_rail.material_override as StandardMaterial3D).duplicate() as StandardMaterial3D
		left_rail.material_override = road_edge_left_mat
	if right_rail != null and right_rail.material_override is StandardMaterial3D:
		road_edge_right_mat = (right_rail.material_override as StandardMaterial3D).duplicate() as StandardMaterial3D
		right_rail.material_override = road_edge_right_mat

	var markers_group: Node3D = road_root.find_child("LaneMarkers", true, false) as Node3D
	if markers_group != null:
		for ch in markers_group.get_children():
			if ch is MeshInstance3D:
				lane_markers.append(ch as MeshInstance3D)

	var ribs_group: Node3D = road_root.find_child("SceneryRibs", true, false) as Node3D
	if ribs_group != null:
		for ch in ribs_group.get_children():
			if ch is Node3D:
				scenery_ribs.append(ch as Node3D)


func _build_showcase_stage() -> Node3D:
	var st: Node3D = Node3D.new()
	st.name = "ShowcaseStage"

	var ped_mat: StandardMaterial3D = StandardMaterial3D.new()
	ped_mat.albedo_color = Color(0.085, 0.125, 0.20)
	ped_mat.metallic = 0.65
	ped_mat.roughness = 0.35

	var ped_mesh: MeshInstance3D = MeshInstance3D.new()
	ped_mesh.name = "Pedestal"
	var cyl: CylinderMesh = CylinderMesh.new()
	cyl.top_radius = 1.45
	cyl.bottom_radius = 1.68
	cyl.height = 0.16
	cyl.radial_segments = 36
	ped_mesh.mesh = cyl
	ped_mesh.material_override = ped_mat
	ped_mesh.position = Vector3(0.0, -0.08, 0.0)
	st.add_child(ped_mesh)

	var ring_mat: StandardMaterial3D = StandardMaterial3D.new()
	ring_mat.albedo_color = Color(0.06, 0.82, 0.98)
	ring_mat.emission_enabled = true
	ring_mat.emission = Color(0.06, 0.82, 0.98)
	ring_mat.emission_energy_multiplier = 2.4

	var ring_inst: MeshInstance3D = MeshInstance3D.new()
	ring_inst.name = "PedestalNeonRing"
	var torus: TorusMesh = TorusMesh.new()
	torus.inner_radius = 1.42
	torus.outer_radius = 1.50
	torus.rings = 36
	torus.ring_segments = 10
	ring_inst.mesh = torus
	ring_inst.material_override = ring_mat
	ring_inst.position = Vector3(0.0, 0.01, 0.0)
	st.add_child(ring_inst)

	return st


func _setup_js_bridge() -> void:
	_js_cmd_cb = JavaScriptBridge.create_callback(Callable(self, "_on_js_command"))
	var js_win: JavaScriptObject = JavaScriptBridge.get_interface("window")
	if js_win != null:
		js_win.__godotReceiveCommand = _js_cmd_cb

	_emit_to_host({
		"type": "boot_progress",
		"phase": "scene",
		"pct": 95
	})

	WorldBuilder.preload_all_scenes()

	# Warm up all 3D meshes and WebGL2 shaders on the loading screen before opening Home Page
	var warmup_group: Node3D = Node3D.new()
	warmup_group.name = "ShaderWarmupGroup"
	warmup_group.position = Vector3(0.0, 0.5, -14.0)
	warmup_group.scale = Vector3(0.05, 0.05, 0.05)
	add_child(warmup_group)

	for obs_t in ["WALL", "MOVING_BLOCK", "LASER", "SLOW_BUMP", "COIN", "SHIELD_GEM", "FLY_GEM"]:
		var wn: Node3D = WorldBuilder.create_obstacle_node(obs_t, accent_hex)
		warmup_group.add_child(wn)

	warmup_group.add_child(WorldBuilder.create_milestone_gate("SPEED", false, accent_hex))
	warmup_group.add_child(WorldBuilder.create_milestone_gate("FINISH", true, accent_hex))
	var warmup_custom_rig: RunnerRig = RunnerRig.new()
	warmup_group.add_child(warmup_custom_rig)
	warmup_custom_rig.setup("zephyr", false)

	var prev_opp_vis: bool = opponent_rig.visible if opponent_rig != null else false
	var prev_stage_vis: bool = showcase_stage.visible if showcase_stage != null else false
	if opponent_rig != null:
		opponent_rig.visible = true
	if showcase_stage != null:
		showcase_stage.visible = true

	await get_tree().process_frame
	_emit_to_host({
		"type": "boot_progress",
		"phase": "scene",
		"pct": 98
	})
	await get_tree().process_frame

	if is_instance_valid(warmup_group):
		warmup_group.queue_free()
	if not race_started and not showcase_active:
		if opponent_rig != null:
			opponent_rig.visible = prev_opp_vis
		if showcase_stage != null:
			showcase_stage.visible = prev_stage_vis

	var ver_info: Dictionary = Engine.get_version_info()
	var ver_str: String = String(ver_info.get("string", "4.7.2-stable"))
	_emit_to_host({
		"type": "ready",
		"engineVersion": ver_str,
		"license": "MIT"
	})


func _emit_to_host(payload: Dictionary) -> void:
	if not _is_web:
		return
	var host_obj: JavaScriptObject = JavaScriptBridge.get_interface("__MazeRunnerHost")
	if host_obj != null:
		host_obj.onGodotEvent(JSON.stringify(payload))


func _on_js_command(args: Array) -> void:
	if args.size() == 0:
		return
	var raw_json: String = String(args[0])
	var parsed: Variant = JSON.parse_string(raw_json)
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var cmd: Dictionary = parsed
	var cmd_type: String = String(cmd.get("type", ""))

	if cmd_type == "start_race":
		_apply_start_race(cmd)
	elif cmd_type == "input":
		var action: String = String(cmd.get("action", ""))
		if action == "left":
			_switch_lane(-1)
		elif action == "right":
			_switch_lane(1)
		elif action == "jump":
			_trigger_jump()
		elif action == "slide":
			_trigger_slide()
	elif cmd_type == "pause":
		is_paused = bool(cmd.get("paused", false))
	elif cmd_type == "stop_race":
		race_started = false
		is_paused = true
		net_finish_fallback_timer = -1.0
		net_forfeit_timer = -1.0
	elif cmd_type == "start_showcase":
		_apply_start_showcase(cmd)
	elif cmd_type == "showcase_rotate":
		showcase_yaw = float(cmd.get("yaw", showcase_yaw))
		showcase_pitch = clampf(float(cmd.get("pitch", showcase_pitch)), -0.2, 0.45)
		showcase_drag_cooldown = 1.5
	elif cmd_type == "stop_showcase":
		_apply_stop_showcase()
	elif cmd_type == "online_opponent_update":
		_handle_online_opponent_update(cmd)
	elif cmd_type == "online_opponent_crashed":
		opp_distance = float(cmd.get("distance", opp_distance))
		net_server_distance = opp_distance
		net_server_speed = 0.0
		var opp_rel_z: float = -(opp_distance - p_distance) * 2.0
		var opp_lane_x: float = opponent_rig.position.x if opponent_rig != null else WorldBuilder.get_lane_x(opp_x_offset)
		_trigger_bot_crash(String(cmd.get("reason", "Wiped out")), opp_lane_x, opp_rel_z, "")
	elif cmd_type == "online_match_clinched":
		var c_dist: int = int(cmd.get("crashedDistance", 0))
		var c_name: String = String(cmd.get("crashedName", opponent_name))
		_emit_to_host({
			"type": "bot_crash",
			"distance": c_dist,
			"name": c_name,
			"subtitle": "Passed %d m · Victory clinched!" % c_dist
		})
	elif cmd_type == "online_opponent_left":
		opp_distance = float(cmd.get("distance", opp_distance))
		net_server_distance = opp_distance
		net_server_speed = 0.0
		var opp_rel_z2: float = -(opp_distance - p_distance) * 2.0
		var opp_lane_x2: float = opponent_rig.position.x if opponent_rig != null else WorldBuilder.get_lane_x(opp_x_offset)
		if opp_is_alive:
			_trigger_bot_crash("Left the race", opp_lane_x2, opp_rel_z2, "Disconnected · Victory awarded!")
		else:
			_emit_to_host({
				"type": "bot_crash",
				"distance": int(opp_distance),
				"name": String(cmd.get("playerName", opponent_name)),
				"subtitle": "Disconnected · Victory awarded!"
			})
	elif cmd_type == "online_match_result":
		_handle_online_match_result(cmd)


func _start_standalone_default_run() -> void:
	var default_milestones: Array = [
		{
			"id": "s1_m1",
			"distance": 250.0,
			"kind": "SPEED",
			"label": "1.5x Boost",
			"durationSec": 8.0,
			"speedMultiplier": 1.5,
			"fogIntensity": 0.0
		},
		{
			"id": "s1_m2",
			"distance": 500.0,
			"kind": "FOG",
			"label": "Light Fog",
			"durationSec": 10.0,
			"speedMultiplier": 1.0,
			"fogIntensity": 0.55
		}
	]
	var gen: RoadGeneratorGD = RoadGeneratorGD.new()
	var seed_now: int = int(Time.get_ticks_usec() % 2147483000) + 101
	var obs_list: Array = gen.generate_track(seed_now, 800.0, 30.0, ["WALL", "MOVING_BLOCK", "LASER", "SLOW_BUMP", "NARROW_GAP"], default_milestones)
	_apply_start_race({
		"mode": "AI_RIVAL",
		"playerCharacterId": "kai",
		"opponentCharacterId": "blaze",
		"opponentName": "Apex Rival",
		"level": {
			"id": 1,
			"goalDistance": 800.0,
			"baseSpeed": 48.0,
			"maxBaseSpeed": 66.0,
			"speedIncrement": 2.3,
			"obstacleInterval": 30.0,
			"accentColor": "#06b6d4",
			"traps": ["WALL", "MOVING_BLOCK", "LASER", "SLOW_BUMP"],
			"milestones": default_milestones
		},
		"obstacles": obs_list
	})


func _apply_start_showcase(cfg: Dictionary) -> void:
	race_started = false
	showcase_active = true
	var cid: String = String(cfg.get("characterId", "kai"))
	showcase_pose = String(cfg.get("pose", "RUN"))
	showcase_is_desktop = bool(cfg.get("isDesktop", true))
	if cfg.has("yaw"):
		showcase_yaw = float(cfg.get("yaw", 0.35))
	if cfg.has("pitch"):
		showcase_pitch = clampf(float(cfg.get("pitch", 0.14)), -0.2, 0.45)

	if road_root != null:
		road_root.visible = false
	if obstacles_root != null:
		obstacles_root.visible = false
	if gates_root != null:
		gates_root.visible = false
	if opponent_rig != null:
		opponent_rig.visible = false
	if showcase_stage != null:
		showcase_stage.visible = true

	player_rig.setup(cid, false)
	player_rig.reset_upright()
	player_rig.position = Vector3.ZERO
	player_rig.visible = true

	env_res.background_color = Color(0.024, 0.043, 0.102)
	env_res.fog_light_color = Color(0.024, 0.043, 0.102)
	env_res.fog_density = 0.008
	camera.fov = 42.0


func _apply_stop_showcase() -> void:
	if not showcase_active:
		return
	showcase_active = false
	if showcase_stage != null:
		showcase_stage.visible = false
	if road_root != null:
		road_root.visible = true
	if obstacles_root != null:
		obstacles_root.visible = true
	if gates_root != null:
		gates_root.visible = true
	camera.h_offset = 0.0
	camera.v_offset = 0.0
	camera.fov = 65.0
	player_rig.reset_upright()


func _apply_start_race(cfg: Dictionary) -> void:
	_apply_stop_showcase()
	if road_root != null:
		road_root.visible = true
	if obstacles_root != null:
		obstacles_root.visible = true
	if gates_root != null:
		gates_root.visible = true
	game_mode = String(cfg.get("mode", "SOLO"))
	is_paused = bool(cfg.get("isPaused", false))
	opponent_name = String(cfg.get("opponentName", "Apex Rival"))
	var player_char_id: String = String(cfg.get("playerCharacterId", "kai"))
	var opp_char_id: String = String(cfg.get("opponentCharacterId", ""))
	if opp_char_id == "":
		opp_char_id = "nova" if player_char_id == "blaze" else "blaze"

	var lvl_variant: Variant = cfg.get("level", {})
	var lvl: Dictionary = lvl_variant if typeof(lvl_variant) == TYPE_DICTIONARY else {}
	level_id = int(lvl.get("id", 1))
	goal_distance = maxf(100.0, float(lvl.get("goalDistance", 800.0)))
	base_speed_kph = float(lvl.get("baseSpeed", 46.0))
	max_base_speed_kph = float(lvl.get("maxBaseSpeed", 62.0))
	speed_increment = float(lvl.get("speedIncrement", 2.2))
	obstacle_interval = float(lvl.get("obstacleInterval", 30.0))
	accent_hex = String(lvl.get("accentColor", "#06b6d4"))

	var traps_var: Variant = lvl.get("traps", ["WALL", "SLOW_BUMP"])
	allowed_traps = traps_var if typeof(traps_var) == TYPE_ARRAY else ["WALL", "SLOW_BUMP"]

	var ms_var: Variant = lvl.get("milestones", [])
	milestones = ms_var if typeof(ms_var) == TYPE_ARRAY else []

	var accent_col: Color = Color.from_string(accent_hex, Color(0.024, 0.714, 0.831))
	if road_edge_left_mat != null:
		road_edge_left_mat.albedo_color = accent_col
		road_edge_left_mat.emission = accent_col
	if road_edge_right_mat != null:
		road_edge_right_mat.albedo_color = accent_col
		road_edge_right_mat.emission = accent_col

	# Rebuild character rigs
	player_rig.setup(player_char_id, false)
	player_rig.reset_upright()
	player_rig.position = Vector3.ZERO
	player_rig.visible = true

	opponent_rig.setup(opp_char_id, true)
	opponent_rig.reset_upright()
	opponent_rig.visible = (game_mode != "SOLO")

	# Reset Player State
	p_lane = 0
	p_target_lane = 0
	p_x_offset = 0.0
	p_is_jumping = false
	p_jump_progress = 0.0
	p_jump_buffer_timer = 0.0
	p_is_sliding = false
	p_slide_progress = 0.0
	p_distance = 0.0
	p_coins = 0
	p_is_alive = true
	p_crash_reason = ""
	p_crash_elapsed = 0.0
	p_slow_timer = 0.0
	p_shield_timer = 0.0
	p_fly_timer = 0.0
	p_fly_landing_grace = 0.0
	p_fly_blend = 0.0

	# Reset Opponent State
	opp_lane = 0
	opp_target_lane = 0
	opp_x_offset = 0.0
	opp_distance = 1.5 if game_mode == "AI_RIVAL" else 0.0
	opp_is_alive = true
	var rng_blunder: RandomNumberGenerator = RandomNumberGenerator.new()
	rng_blunder.randomize()
	opp_crash_distance = goal_distance * rng_blunder.randf_range(0.58, 0.92) if game_mode == "AI_RIVAL" else 999999.0
	opp_is_jumping = false
	opp_jump_progress = 0.0
	opp_is_sliding = false
	opp_slide_progress = 0.0
	opp_crash_elapsed = 0.0
	opp_slow_timer = 0.0
	opp_shield_timer = 0.0
	opp_fly_timer = 0.0
	opp_fly_blend = 0.0
	same_lane_blend = 1.0 if game_mode != "SOLO" else 0.0

	# Reset Online Sync
	net_server_distance = 0.0
	net_server_speed = base_speed_kph
	net_packet_age = 0.0
	net_has_packet = false
	net_immediate_flush = false
	net_reported_finish = false
	net_finish_fallback_timer = -1.0
	net_forfeit_timer = -1.0
	net_auth_result = {}

	# Clear old obstacles, gates, and particles
	for k in obstacle_nodes.keys():
		var n: Node3D = obstacle_nodes[k]
		if is_instance_valid(n):
			n.queue_free()
	obstacle_nodes.clear()

	for child in obstacles_root.get_children():
		child.queue_free()
	for child in gates_root.get_children():
		child.queue_free()
	for child in particles_root.get_children():
		child.queue_free()
	gate_entries.clear()
	burst_particles.clear()

	# Load obstacles from host (for 100% Online Match sync) or generate standalone
	var incoming_obs_var: Variant = cfg.get("obstacles", [])
	var raw_obs_list: Array = incoming_obs_var if typeof(incoming_obs_var) == TYPE_ARRAY else []
	if raw_obs_list.size() == 0:
		var seed_val: int = int(cfg.get("seed", 123456))
		var gen: RoadGeneratorGD = RoadGeneratorGD.new()
		raw_obs_list = gen.generate_track(seed_val, goal_distance, obstacle_interval, allowed_traps, milestones)

	obstacles_data.clear()
	for item in raw_obs_list:
		if typeof(item) == TYPE_DICTIONARY:
			var src: Dictionary = item
			obstacles_data.append({
				"id": String(src.get("id", "")),
				"type": String(src.get("type", "WALL")),
				"distance": float(src.get("distance", 20.0)),
				"lane": int(src.get("lane", 0)),
				"moveSpeed": float(src.get("moveSpeed", 1.8)),
				"phase": float(src.get("phase", 0.0)),
				"isPassed": false,
				"collected": false,
				"triggeredByPlayer": false,
				"triggeredByOpponent": false
			})

	# Build 3D Milestone Gates + Finish Line Gate
	for m_item in milestones:
		if typeof(m_item) == TYPE_DICTIONARY:
			var m_dict: Dictionary = m_item
			var m_dist: float = float(m_dict.get("distance", 250.0))
			var m_kind: String = String(m_dict.get("kind", "SPEED"))
			var gate_node: Node3D = WorldBuilder.create_milestone_gate(m_kind, false, accent_hex)
			gate_node.visible = false
			gates_root.add_child(gate_node)
			gate_entries.append({
				"distance": m_dist,
				"node": gate_node
			})

	var finish_gate: Node3D = WorldBuilder.create_milestone_gate("FINISH", true, accent_hex)
	finish_gate.visible = false
	gates_root.add_child(finish_gate)
	gate_entries.append({
		"distance": goal_distance,
		"node": finish_gate
	})

	triggered_milestones.clear()
	active_milestone.clear()
	smoothed_speed_mult = 1.0
	smoothed_fog_blend = 0.0
	env_res.background_color = base_sky_color
	env_res.fog_light_color = base_sky_color
	env_res.fog_density = 0.012
	camera.fov = 65.0

	game_over_handled = false
	race_started = true
	hud_emit_timer = 0.1
	_sync_visible_obstacles(0.0)


func _build_environment_and_lights() -> void:
	env_res = Environment.new()
	env_res.background_mode = Environment.BG_COLOR
	env_res.background_color = base_sky_color
	env_res.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env_res.ambient_light_color = Color(0.55, 0.66, 0.88)
	env_res.ambient_light_energy = 0.90
	env_res.tonemap_mode = Environment.TONE_MAPPER_ACES
	env_res.fog_enabled = true
	env_res.fog_light_color = base_sky_color
	env_res.fog_light_energy = 1.0
	env_res.fog_density = 0.012

	world_env = WorldEnvironment.new()
	world_env.environment = env_res
	add_child(world_env)

	camera = Camera3D.new()
	camera.fov = 65.0
	camera.near = 0.1
	camera.far = 220.0
	camera.current = true
	camera.look_at_from_position(Vector3(0.0, 3.6, 5.2), Vector3(0.0, 1.4, -12.0), Vector3.UP)
	add_child(camera)

	var key_light: DirectionalLight3D = DirectionalLight3D.new()
	key_light.light_color = Color(0.95, 0.98, 1.0)
	key_light.light_energy = 1.35
	key_light.rotation_degrees = Vector3(-52.0, -28.0, 0.0)
	add_child(key_light)

	var rim_light: DirectionalLight3D = DirectionalLight3D.new()
	rim_light.light_color = Color(0.28, 0.78, 1.0)
	rim_light.light_energy = 0.65
	rim_light.rotation_degrees = Vector3(-28.0, 145.0, 0.0)
	add_child(rim_light)


func _build_highway() -> void:
	road_root = Node3D.new()
	road_root.name = "RoadRoot"
	add_child(road_root)

	# Main cyber asphalt deck
	var deck_mat: StandardMaterial3D = StandardMaterial3D.new()
	deck_mat.albedo_color = Color(0.055, 0.075, 0.125)
	deck_mat.metallic = 0.35
	deck_mat.roughness = 0.55

	var deck: MeshInstance3D = MeshInstance3D.new()
	var deck_box: BoxMesh = BoxMesh.new()
	deck_box.size = Vector3(8.2, 0.24, 230.0)
	deck.mesh = deck_box
	deck.material_override = deck_mat
	deck.position = Vector3(0.0, -0.12, -95.0)
	road_root.add_child(deck)

	# Abyssal sub-grid floor beneath highway
	var abyss_mat: StandardMaterial3D = StandardMaterial3D.new()
	abyss_mat.albedo_color = Color(0.02, 0.03, 0.06)
	abyss_mat.roughness = 0.9
	var abyss: MeshInstance3D = MeshInstance3D.new()
	var abyss_box: BoxMesh = BoxMesh.new()
	abyss_box.size = Vector3(90.0, 0.1, 240.0)
	abyss.mesh = abyss_box
	abyss.material_override = abyss_mat
	abyss.position = Vector3(0.0, -2.8, -95.0)
	road_root.add_child(abyss)

	# Glowing left & right highway rails
	road_edge_left_mat = StandardMaterial3D.new()
	road_edge_left_mat.albedo_color = Color(0.024, 0.714, 0.831)
	road_edge_left_mat.emission_enabled = true
	road_edge_left_mat.emission = Color(0.024, 0.714, 0.831)
	road_edge_left_mat.emission_energy_multiplier = 2.0

	road_edge_right_mat = road_edge_left_mat.duplicate() as StandardMaterial3D

	var rail_box: BoxMesh = BoxMesh.new()
	rail_box.size = Vector3(0.18, 0.22, 230.0)

	var left_rail: MeshInstance3D = MeshInstance3D.new()
	left_rail.mesh = rail_box
	left_rail.material_override = road_edge_left_mat
	left_rail.position = Vector3(-4.05, 0.08, -95.0)
	road_root.add_child(left_rail)

	var right_rail: MeshInstance3D = MeshInstance3D.new()
	right_rail.mesh = rail_box
	right_rail.material_override = road_edge_right_mat
	right_rail.position = Vector3(4.05, 0.08, -95.0)
	road_root.add_child(right_rail)

	# Scrolling Neon Lane Dividers at x = -1.2 and x = +1.2
	var dash_mat: StandardMaterial3D = StandardMaterial3D.new()
	dash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dash_mat.albedo_color = Color(0.32, 0.84, 0.98, 0.65)

	var dash_box: BoxMesh = BoxMesh.new()
	dash_box.size = Vector3(0.10, 0.02, 2.8)

	lane_markers.clear()
	for i in range(28):
		var z_pos: float = 8.0 - float(i) * 8.0
		for divider_x in [-1.2, 1.2]:
			var m: MeshInstance3D = MeshInstance3D.new()
			m.mesh = dash_box
			m.material_override = dash_mat
			m.position = Vector3(divider_x, 0.015, z_pos)
			road_root.add_child(m)
			lane_markers.append(m)

	# Scrolling Cyber City Pylons & Speed Ribs along highway sides
	var pylon_mat: StandardMaterial3D = StandardMaterial3D.new()
	pylon_mat.albedo_color = Color(0.07, 0.10, 0.18)
	pylon_mat.metallic = 0.5
	pylon_mat.roughness = 0.4

	var strip_mat: StandardMaterial3D = StandardMaterial3D.new()
	strip_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	strip_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	strip_mat.albedo_color = Color(0.14, 0.72, 0.96, 0.55)

	scenery_ribs.clear()
	for r_idx in range(16):
		var rib_group: Node3D = Node3D.new()
		rib_group.position = Vector3(0.0, 0.0, 10.0 - float(r_idx) * 14.0)

		for side in [-1.0, 1.0]:
			var h: float = 5.5 + float((r_idx * 3) % 5) * 1.8
			var tower: MeshInstance3D = MeshInstance3D.new()
			var t_box: BoxMesh = BoxMesh.new()
			t_box.size = Vector3(1.4, h, 1.4)
			tower.mesh = t_box
			tower.material_override = pylon_mat
			tower.position = Vector3(side * 6.8, h * 0.5 - 2.2, 0.0)
			rib_group.add_child(tower)

			var neon_line: MeshInstance3D = MeshInstance3D.new()
			var n_box: BoxMesh = BoxMesh.new()
			n_box.size = Vector3(0.10, h * 0.82, 0.12)
			neon_line.mesh = n_box
			neon_line.material_override = strip_mat
			neon_line.position = Vector3(side * 6.05, h * 0.5 - 2.2, 0.0)
			rib_group.add_child(neon_line)

		road_root.add_child(rib_group)
		scenery_ribs.append(rib_group)


func _unhandled_input(event: InputEvent) -> void:
	if not race_started:
		return

	if event is InputEventKey:
		var k: InputEventKey = event as InputEventKey
		if k.pressed and not k.echo:
			if k.keycode == KEY_LEFT or k.keycode == KEY_A:
				_switch_lane(-1)
			elif k.keycode == KEY_RIGHT or k.keycode == KEY_D:
				_switch_lane(1)
			elif k.keycode == KEY_UP or k.keycode == KEY_W or k.keycode == KEY_SPACE:
				_trigger_jump()
			elif k.keycode == KEY_DOWN or k.keycode == KEY_S:
				_trigger_slide()
	elif event is InputEventScreenTouch:
		var st: InputEventScreenTouch = event as InputEventScreenTouch
		if st.pressed:
			_touch_start_pos = st.position
			_touch_active = true
			_touch_handled = false
		else:
			_touch_active = false
	elif event is InputEventScreenDrag and _touch_active and not _touch_handled:
		var sd: InputEventScreenDrag = event as InputEventScreenDrag
		var delta_v: Vector2 = sd.position - _touch_start_pos
		if delta_v.length() > 28.0:
			_touch_handled = true
			if absf(delta_v.x) > absf(delta_v.y):
				_switch_lane(1 if delta_v.x > 0.0 else -1)
			else:
				if delta_v.y < 0.0:
					_trigger_jump()
				else:
					_trigger_slide()


func _switch_lane(delta_lane: int) -> void:
	if not p_is_alive or (is_paused and game_mode != "ONLINE_MATCH"):
		return
	var next_l: int = p_target_lane + delta_lane
	if next_l >= -1 and next_l <= 1:
		p_target_lane = next_l
		p_lane = next_l
		net_immediate_flush = true
		_emit_to_host({"type": "sfx", "name": "lane"})


func _trigger_jump() -> void:
	if not p_is_alive or p_fly_timer > 0.0 or (is_paused and game_mode != "ONLINE_MATCH"):
		return
	if p_is_sliding:
		p_is_sliding = false
		p_slide_progress = 0.0

	if p_is_jumping:
		if p_jump_progress >= 0.82:
			p_jump_progress = 0.08
			p_jump_buffer_timer = 0.0
			net_immediate_flush = true
			_emit_to_host({"type": "sfx", "name": "jump"})
		else:
			p_jump_buffer_timer = 0.18
		return

	p_is_jumping = true
	p_jump_progress = 0.08
	p_jump_buffer_timer = 0.0
	net_immediate_flush = true
	_emit_to_host({"type": "sfx", "name": "jump"})


func _trigger_slide() -> void:
	if not p_is_alive or p_is_sliding or p_fly_timer > 0.0 or (is_paused and game_mode != "ONLINE_MATCH"):
		return
	p_is_sliding = true
	p_slide_progress = 0.0
	p_jump_buffer_timer = 0.0
	if p_is_jumping:
		p_is_jumping = false
		p_jump_progress = 0.0
	net_immediate_flush = true
	_emit_to_host({"type": "sfx", "name": "slide"})


func _calc_runner_speed(dist_m: float) -> float:
	var gained: float = (maxf(0.0, dist_m) / 100.0) * speed_increment
	return snappedf(minf(max_base_speed_kph, base_speed_kph + gained), 0.1)


func _get_opponent_milestone_mult(opp_dist: float) -> float:
	for item in milestones:
		if typeof(item) == TYPE_DICTIONARY:
			var m: Dictionary = item
			var sm: float = float(m.get("speedMultiplier", 1.0))
			if sm > 1.02:
				var m_dist: float = float(m.get("distance", 0.0))
				var dur: float = float(m.get("durationSec", 8.0))
				var span: float = maxf(90.0, 15.0 * sm * dur)
				if opp_dist >= m_dist and opp_dist <= m_dist + span:
					return sm
	return 1.0


func _process(raw_delta: float) -> void:
	var dt: float = clampf(raw_delta, 0.001, 0.1)

	if showcase_active and not race_started:
		elapsed_time += dt
		if showcase_drag_cooldown > 0.0:
			showcase_drag_cooldown = maxf(0.0, showcase_drag_cooldown - dt)
		else:
			showcase_yaw += dt * 0.45

		player_rig.position = Vector3.ZERO
		player_rig.rotation = Vector3(0.0, showcase_yaw, 0.0)

		var target_h_off: float = 0.62 if showcase_is_desktop else 0.0
		var target_v_off: float = 0.0 if showcase_is_desktop else -0.42
		camera.h_offset = lerpf(camera.h_offset, target_h_off, minf(1.0, dt * 10.0))
		camera.v_offset = lerpf(camera.v_offset, target_v_off, minf(1.0, dt * 10.0))
		var cam_y_s: float = 1.62 + sin(showcase_pitch) * 1.15
		camera.look_at_from_position(Vector3(0.0, cam_y_s, 4.15), Vector3(0.0, 1.05, 0.0), Vector3.UP)

		if showcase_pose == "RUN":
			player_rig.update_pose(elapsed_time, 64.0, false, false, 0.0, 0.0, 0.0, 0.0)
		elif showcase_pose == "JUMP":
			var jc: float = fmod(elapsed_time * 1.15, 1.0)
			player_rig.update_pose(elapsed_time, 60.0, true, false, jc, 0.0, 0.0, 0.0)
			if player_rig.hips != null:
				player_rig.hips.position.y = 0.88 + sin(jc * PI) * 0.65
			elif player_rig.custom_model != null:
				player_rig.custom_model.position.y = sin(jc * PI) * 0.65
		elif showcase_pose == "SLIDE":
			player_rig.update_pose(elapsed_time, 60.0, false, true, 0.0, 0.0, 0.0, 0.0)
		elif showcase_pose == "FLY":
			player_rig.update_pose(elapsed_time, 85.0, false, false, 0.0, 1.0, 0.0, 2.0)
			if player_rig.hips != null:
				player_rig.hips.position.y = 1.25 + sin(elapsed_time * 5.0) * 0.08
			elif player_rig.custom_model != null:
				player_rig.custom_model.position.y = 0.38 + sin(elapsed_time * 5.0) * 0.08
		else:
			player_rig.update_pose(elapsed_time, 0.0, false, false, 0.0, 0.0, 0.0, 0.0)
		return

	if not race_started:
		return

	elapsed_time += dt

	# Tick online timers if active
	if net_finish_fallback_timer >= 0.0:
		net_finish_fallback_timer -= dt
		if net_finish_fallback_timer <= 0.0 and not game_over_handled:
			net_finish_fallback_timer = -1.0
			_conclude_race(true, goal_distance, "", int(opp_distance), false)

	if net_forfeit_timer >= 0.0:
		net_forfeit_timer -= dt
		if net_forfeit_timer <= 0.0 and not game_over_handled:
			net_forfeit_timer = -1.0
			var won_res: bool = bool(net_auth_result.get("won", true))
			var rsn_res: String = String(net_auth_result.get("reason", ""))
			var opp_d_res: int = int(net_auth_result.get("opponentDistance", int(opp_distance)))
			var opp_w_res: bool = bool(net_auth_result.get("opponentWon", not won_res))
			_conclude_race(won_res, p_distance, rsn_res, opp_d_res, opp_w_res)

	var should_pause: bool = is_paused and game_mode != "ONLINE_MATCH"
	if not should_pause:
		_step_simulation(dt)

	_update_particles(dt)


func _step_simulation(dt: float) -> void:
	if net_has_packet:
		net_packet_age += dt

	if p_jump_buffer_timer > 0.0:
		p_jump_buffer_timer = maxf(0.0, p_jump_buffer_timer - dt)

	var cur_base_kph: float = _calc_runner_speed(p_distance)
	var active_display_speed: float = cur_base_kph

	if p_is_alive:
		# 1. Stage Milestone Triggers
		for item in milestones:
			if typeof(item) == TYPE_DICTIONARY:
				var m: Dictionary = item
				var m_id: String = String(m.get("id", ""))
				var m_dist: float = float(m.get("distance", 0.0))
				if not triggered_milestones.has(m_id) and p_distance >= m_dist and p_distance < goal_distance - 8.0:
					triggered_milestones[m_id] = true
					var m_dur: float = float(m.get("durationSec", 8.0))
					var m_kind: String = String(m.get("kind", "SPEED"))
					var m_label: String = String(m.get("label", "Boost"))
					var m_mult: float = float(m.get("speedMultiplier", 1.0))
					active_milestone = {
						"milestone": m,
						"remainingSec": m_dur
					}
					_emit_to_host({"type": "sfx", "name": "milestone", "arg": m_kind})
					var sub: String = "Speed boosted %.1fx for %ds" % [m_mult, int(m_dur)]
					if m_kind == "FOG":
						sub = "Fog bank active · Clears in %ds" % int(m_dur)
					elif m_kind == "FOG_SPEED":
						sub = "Storm mist + %.1fx speed for %ds" % [m_mult, int(m_dur)]
					_emit_to_host({
						"type": "milestone_banner",
						"title": "%dm Milestone · %s" % [int(m_dist), m_label],
						"subtitle": sub,
						"kind": m_kind
					})

		# 2. Tick Active Milestone
		if not active_milestone.is_empty():
			var rem: float = float(active_milestone.get("remainingSec", 0.0)) - dt
			if rem <= 0.0:
				active_milestone.clear()
			else:
				active_milestone["remainingSec"] = rem

		# 3. Tick Power Gems (3s Shield & 4s 2x Invincible Sky Flight)
		if p_shield_timer > 0.0:
			p_shield_timer = maxf(0.0, p_shield_timer - dt)
		if p_fly_timer > 0.0:
			p_fly_timer = maxf(0.0, p_fly_timer - dt)
			if p_fly_timer <= 0.0:
				p_fly_landing_grace = 0.65
		elif p_fly_landing_grace > 0.0:
			p_fly_landing_grace = maxf(0.0, p_fly_landing_grace - dt)

		p_fly_blend = lerpf(p_fly_blend, 1.0 if p_fly_timer > 0.0 else 0.0, 1.0 - exp(-8.5 * dt))

		var ms_mult: float = 1.0
		var target_fog: float = 0.0
		if not active_milestone.is_empty():
			var ms_inner: Dictionary = active_milestone.get("milestone", {})
			ms_mult = float(ms_inner.get("speedMultiplier", 1.0))
			target_fog = float(ms_inner.get("fogIntensity", 0.0))

		var power_mult: float = FLY_GEM_SPEED_MULTIPLIER if p_fly_timer > 0.0 else 1.0
		var target_speed_mult: float = maxf(ms_mult, power_mult)
		smoothed_speed_mult = lerpf(smoothed_speed_mult, target_speed_mult, 1.0 - exp(-6.5 * dt))
		smoothed_fog_blend = lerpf(smoothed_fog_blend, target_fog, 1.0 - exp(-2.6 * dt))

		# Dynamic Godot 4.7 WorldEnvironment Fog & Camera FOV
		var sky_blend: Color = base_sky_color.lerp(fog_mist_color, smoothed_fog_blend * 0.84)
		env_res.background_color = sky_blend
		env_res.fog_light_color = sky_blend
		env_res.fog_density = 0.012 + smoothed_fog_blend * 0.048

		var target_fov: float = 65.0 + maxf(0.0, smoothed_speed_mult - 1.0) * 11.0 + p_fly_blend * 3.0
		camera.fov = lerpf(camera.fov, target_fov, 1.0 - exp(-5.5 * dt))

		# 4. Exact SI Speed Conversion (1 km/h = 1 / 3.6 m/s)
		if p_shield_timer > 0.0 or p_fly_timer > 0.0:
			p_slow_timer = 0.0
		else:
			p_slow_timer = maxf(0.0, p_slow_timer - dt)

		var slow_factor: float = (1.0 - 0.30 * minf(1.0, p_slow_timer / 0.9)) if p_slow_timer > 0.0 else 1.0
		var current_speed_kph: float = cur_base_kph * smoothed_speed_mult * slow_factor
		active_display_speed = current_speed_kph
		p_distance += (current_speed_kph * MPS_PER_KPH) * dt

		var action_tempo: float = 1.0 + maxf(0.0, smoothed_speed_mult - 1.0) * 0.42
		p_x_offset += (float(p_target_lane) - p_x_offset) * minf(1.0, dt * 15.0 * action_tempo)

		if p_is_jumping:
			p_jump_progress += dt * 2.75 * action_tempo
			if p_jump_progress >= 1.0:
				if p_jump_buffer_timer > 0.0:
					p_jump_progress = 0.08
					p_jump_buffer_timer = 0.0
					_emit_to_host({"type": "sfx", "name": "jump"})
				else:
					p_is_jumping = false
					p_jump_progress = 0.0
		elif p_fly_timer <= 0.0 and p_jump_buffer_timer > 0.0:
			p_is_jumping = true
			p_is_sliding = false
			p_slide_progress = 0.0
			p_jump_progress = 0.08
			p_jump_buffer_timer = 0.0
			_emit_to_host({"type": "sfx", "name": "jump"})

		if p_is_sliding:
			p_slide_progress += dt * 2.6 * action_tempo
			if p_slide_progress >= 1.0:
				p_is_sliding = false
				p_slide_progress = 0.0

		# Shoulder-to-shoulder lane separation when racing alongside AI Rival / Online Opponent
		if game_mode != "SOLO" and opp_is_alive:
			var lane_diff: float = absf(opp_x_offset - p_x_offset)
			var dist_diff_r: float = absf(opp_distance - p_distance)
			var t_blend: float = 0.0
			if lane_diff < 0.85 and dist_diff_r < 12.0:
				t_blend = (1.0 - lane_diff / 0.85) * minf(1.0, (12.0 - dist_diff_r) / 5.0)
			same_lane_blend += (t_blend - same_lane_blend) * minf(1.0, dt * 12.0)
		else:
			same_lane_blend += (0.0 - same_lane_blend) * minf(1.0, dt * 10.0)

		var player_x: float = WorldBuilder.get_lane_x(p_x_offset)
		var visual_player_x: float = player_x - same_lane_blend * 0.48
		player_rig.position = Vector3(visual_player_x, 0.0, 0.0)
		player_rig.rotation.z = (float(p_target_lane) - p_x_offset) * (-0.22 - p_fly_blend * 0.14)
		player_rig.update_pose(
			elapsed_time,
			current_speed_kph,
			p_is_jumping,
			p_is_sliding,
			p_jump_progress,
			p_fly_blend,
			p_shield_timer,
			p_fly_timer
		)

		# Chase Camera Follow + Impact Shake
		var jump_arc: float = pow(sin(clampf(p_jump_progress, 0.0, 1.0) * PI), 0.68) if p_is_jumping else 0.0
		var cam_x: float = lerpf(camera.position.x, player_x * 0.45, minf(1.0, dt * 10.0))
		var cam_y: float = 3.6 + jump_arc * 0.85 + p_fly_blend * 0.95
		var cam_z: float = 5.2

		if shake_duration > 0.0 and shake_elapsed < shake_duration:
			shake_elapsed += dt
			var falloff: float = 1.0 - minf(1.0, shake_elapsed / shake_duration)
			cam_x += sin(elapsed_time * 65.0) * shake_amount * falloff
			cam_y += cos(elapsed_time * 58.0) * shake_amount * falloff

		camera.look_at_from_position(
			Vector3(cam_x, cam_y, cam_z),
			Vector3(player_x * 0.65, 1.4 + p_fly_blend * 0.65, -12.0),
			Vector3.UP
		)

		_scroll_highway_elements()
		_update_gates()

		# Online Match 25Hz Telemetry Emit
		if game_mode == "ONLINE_MATCH":
			net_emit_timer += dt
			if net_emit_timer >= 0.04 or net_immediate_flush:
				net_emit_timer = 0.0
				net_immediate_flush = false
				_emit_to_host({
					"type": "net_update",
					"distance": p_distance,
					"speed": active_display_speed,
					"lane": p_lane,
					"targetLane": p_target_lane,
					"xOffset": p_x_offset,
					"isJumping": p_is_jumping,
					"jumpProgress": p_jump_progress,
					"isSliding": p_is_sliding,
					"slideProgress": p_slide_progress,
					"slowTimer": p_slow_timer,
					"shieldTimer": p_shield_timer,
					"flyTimer": p_fly_timer,
					"coins": p_coins
				})

		# Update Opponent (AI Rival or Online Opponent)
		if game_mode != "SOLO":
			_update_opponent_alive_or_crashed(dt)

		# Stream 3D Obstacles & Evaluate Collisions / Pickups
		_sync_visible_obstacles(dt)
		_evaluate_collisions(player_x)

		# Goal Finish Check
		if p_distance >= goal_distance and p_is_alive and not game_over_handled:
			if game_mode == "ONLINE_MATCH":
				if not net_reported_finish:
					net_reported_finish = true
					_emit_to_host({
						"type": "player_finished_online",
						"distance": goal_distance,
						"coins": p_coins
					})
					net_finish_fallback_timer = 0.62
			else:
				var rival_won_first: bool = (
					game_mode == "AI_RIVAL"
					and opp_is_alive
					and opp_distance >= goal_distance
					and opp_distance > p_distance
				)
				var player_won: bool = not rival_won_first
				var lose_reason: String = ""
				if rival_won_first:
					lose_reason = "%s crossed the %d m line just ahead of you." % [opponent_name, int(goal_distance)]
				_conclude_race(
					player_won,
					goal_distance,
					lose_reason,
					mini(int(goal_distance), maxi(0, int(opp_distance))),
					rival_won_first
				)
	else:
		# Player Wiped Out: Dramatic Tumble & Residual Slide
		p_crash_elapsed += dt
		var residual: float = maxf(0.0, 1.0 - p_crash_elapsed / 0.9)
		var slide_step: float = (cur_base_kph * residual * MPS_PER_KPH) * dt
		if game_mode != "ONLINE_MATCH":
			p_distance += slide_step

		player_rig.rotation.x += dt * 8.0
		player_rig.rotation.y += dt * 10.0
		player_rig.rotation.z += dt * 5.0
		player_rig.position.x = WorldBuilder.get_lane_x(p_x_offset)
		player_rig.position.y = maxf(0.08, 0.4 + sin(p_crash_elapsed * 10.0) * maxf(0.0, 0.8 - p_crash_elapsed * 0.3))

		var c_x: float = lerpf(camera.position.x, player_rig.position.x * 0.45, minf(1.0, dt * 8.0))
		var c_y: float = 3.6 + sin(p_crash_elapsed * 4.0) * 0.15
		camera.look_at_from_position(Vector3(c_x, c_y, 5.2), Vector3(player_rig.position.x * 0.65, 1.0, -10.0), Vector3.UP)

		_scroll_highway_elements()
		_update_gates()
		_sync_visible_obstacles(dt)

		if game_mode != "SOLO":
			_update_opponent_alive_or_crashed(dt)

		if p_crash_elapsed >= 1.35 and not game_over_handled:
			if game_mode == "ONLINE_MATCH":
				if not net_auth_result.is_empty():
					var w: bool = bool(net_auth_result.get("won", false))
					var r: String = String(net_auth_result.get("reason", p_crash_reason))
					var od: int = int(net_auth_result.get("opponentDistance", int(opp_distance)))
					var ow: bool = bool(net_auth_result.get("opponentWon", not w))
					_conclude_race(w, p_distance, r, od, ow)
				elif p_crash_elapsed >= 10.0:
					var fb_won: bool = (not opp_is_alive) and p_distance >= opp_distance
					_conclude_race(fb_won, p_distance, p_crash_reason, int(opp_distance), not fb_won)
			else:
				_conclude_race(false, p_distance, p_crash_reason, int(opp_distance), game_mode == "AI_RIVAL" and opp_is_alive)

	# Throttled 30Hz HUD Update to React Overlay
	hud_emit_timer += dt
	if hud_emit_timer >= 0.033:
		hud_emit_timer = 0.0
		var ms_payload: Variant = null
		if not active_milestone.is_empty():
			ms_payload = active_milestone
		_emit_to_host({
			"type": "hud",
			"distance": p_distance,
			"coins": p_coins,
			"speed": active_display_speed if p_is_alive else 0.0,
			"speedMultiplier": smoothed_speed_mult if p_is_alive else 1.0,
			"isSlowed": p_slow_timer > 0.05,
			"shieldRemaining": p_shield_timer,
			"flyRemaining": p_fly_timer,
			"opponentDist": int(opp_distance),
			"opponentAlive": opp_is_alive,
			"activeMilestone": ms_payload
		})


func _scroll_highway_elements() -> void:
	var marker_offset: float = fmod(p_distance * 2.0, 8.0)
	for idx in range(lane_markers.size()):
		var row: int = int(idx / 2)
		var base_z: float = 8.0 - float(row) * 8.0
		lane_markers[idx].position.z = base_z + marker_offset

	var rib_offset: float = fmod(p_distance * 2.0, 14.0)
	for r_idx in range(scenery_ribs.size()):
		var base_rz: float = 10.0 - float(r_idx) * 14.0
		scenery_ribs[r_idx].position.z = base_rz + rib_offset


func _update_gates() -> void:
	for entry in gate_entries:
		var g_dist: float = float(entry["distance"])
		var g_node: Node3D = entry["node"]
		var rel_m: float = g_dist - p_distance
		if rel_m >= -6.0 and rel_m <= 95.0:
			g_node.visible = true
			g_node.position = Vector3(0.0, 0.0, -rel_m * 2.0)
		else:
			g_node.visible = false


func _sync_visible_obstacles(dt: float) -> void:
	for item in obstacles_data:
		var obs: Dictionary = item
		var obs_id: String = String(obs["id"])
		var obs_type: String = String(obs["type"])
		var obs_dist: float = float(obs["distance"])
		var is_passed: bool = bool(obs["isPassed"])
		var is_collected: bool = bool(obs["collected"])
		var rel_m: float = obs_dist - p_distance

		if (not is_passed) and (not is_collected) and rel_m >= -4.0 and rel_m <= 86.0:
			var node: Node3D = obstacle_nodes.get(obs_id, null)
			if node == null or not is_instance_valid(node):
				node = WorldBuilder.create_obstacle_node(obs_type, accent_hex)
				obstacles_root.add_child(node)
				obstacle_nodes[obs_id] = node

			var lane_x: float = WorldBuilder.get_lane_x(float(obs["lane"]))
			if obs_type == "MOVING_BLOCK":
				var ph: float = float(obs["phase"]) + elapsed_time * float(obs["moveSpeed"])
				lane_x = sin(ph) * (WorldBuilder.LANE_WIDTH * 1.1)

			node.position = Vector3(lane_x, 0.0, -rel_m * 2.0)

			if obs_type == "COIN" or obs_type == "SHIELD_GEM" or obs_type == "FLY_GEM":
				var sp: Node3D = node.get_node_or_null("SpinPivot") as Node3D
				if sp != null:
					sp.rotation.y += dt * (3.2 if obs_type == "COIN" else 2.6)
					var base_y: float = 0.92 if obs_type == "COIN" else (1.08 if obs_type == "SHIELD_GEM" else 1.15)
					sp.position.y = base_y + sin(elapsed_time * 4.5 + obs_dist) * 0.10
		else:
			if obstacle_nodes.has(obs_id):
				var old_n: Node3D = obstacle_nodes[obs_id]
				if is_instance_valid(old_n):
					old_n.queue_free()
				obstacle_nodes.erase(obs_id)


func _evaluate_collisions(player_x: float) -> void:
	var jump_height: float = pow(sin(clampf(p_jump_progress, 0.0, 1.0) * PI), 0.68) * 2.35 if p_is_jumping else 0.0
	var is_flying_invincible: bool = p_fly_timer > 0.0 or p_fly_blend > 0.35
	var is_shield_protected: bool = p_shield_timer > 0.0 or p_fly_landing_grace > 0.0

	for item in obstacles_data:
		var obs: Dictionary = item
		var obs_dist: float = float(obs["distance"])
		var dist_diff: float = obs_dist - p_distance

		if dist_diff <= -1.2 and not bool(obs["isPassed"]):
			obs["isPassed"] = true

		var obs_type: String = String(obs["type"])
		var obs_id: String = String(obs["id"])

		if obs_type == "COIN" and not bool(obs["collected"]) and dist_diff > -1.35 and dist_diff < 1.80:
			var x_dist: float = absf(WorldBuilder.get_lane_x(float(obs["lane"])) - player_x)
			if x_dist < (1.55 if is_flying_invincible else 1.20):
				obs["collected"] = true
				p_coins += 1
				_remove_obstacle_mesh(obs_id)
				_emit_to_host({"type": "sfx", "name": "coin"})

		elif (obs_type == "SHIELD_GEM" or obs_type == "FLY_GEM") and not bool(obs["collected"]) and dist_diff > -1.35 and dist_diff < 1.85:
			var x_dist_g: float = absf(WorldBuilder.get_lane_x(float(obs["lane"])) - player_x)
			if x_dist_g < 1.32:
				obs["collected"] = true
				_remove_obstacle_mesh(obs_id)
				if obs_type == "SHIELD_GEM":
					p_shield_timer = SHIELD_GEM_DURATION_SEC
					p_slow_timer = 0.0
					net_immediate_flush = true
					_spawn_burst(player_rig.position + Vector3(0.0, 1.0, 0.0), Color(0.15, 0.92, 1.0), 16)
					_emit_to_host({"type": "sfx", "name": "gem_shield"})
					_emit_to_host({
						"type": "power_banner",
						"title": "Shield Gem · 3s Barrier",
						"subtitle": "Shatters obstacles on contact",
						"kind": "SHIELD"
					})
				else:
					p_fly_timer = FLY_GEM_DURATION_SEC
					p_is_jumping = false
					p_jump_progress = 0.0
					p_is_sliding = false
					p_slide_progress = 0.0
					p_slow_timer = 0.0
					net_immediate_flush = true
					_spawn_burst(player_rig.position + Vector3(0.0, 1.1, 0.0), Color(1.0, 0.78, 0.16), 20)
					_emit_to_host({"type": "sfx", "name": "gem_fly"})
					_emit_to_host({
						"type": "power_banner",
						"title": "Sky Gem · 2x Speed + Flight",
						"subtitle": "Invincible jet-flight above all hazards",
						"kind": "FLY"
					})

		elif dist_diff > -0.52 and dist_diff < 0.72 and not is_flying_invincible:
			var obs_lane_x: float = WorldBuilder.get_lane_x(float(obs["lane"]))
			if obs_type == "MOVING_BLOCK":
				var ph: float = float(obs["phase"]) + elapsed_time * float(obs["moveSpeed"])
				obs_lane_x = sin(ph) * (WorldBuilder.LANE_WIDTH * 1.1)

			var x_dist_h: float = absf(obs_lane_x - player_x)

			if obs_type == "SLOW_BUMP" and not bool(obs["triggeredByPlayer"]) and not bool(obs["isPassed"]):
				if x_dist_h < 0.85 and jump_height < 0.32:
					if is_shield_protected:
						_deflect_with_shield(obs, obs_lane_x)
					else:
						obs["triggeredByPlayer"] = true
						p_slow_timer = 1.2
						net_immediate_flush = true
						shake_amount = 0.12
						shake_duration = 0.20
						shake_elapsed = 0.0
						_spawn_burst(Vector3(player_rig.position.x, 0.3, 0.0), Color(1.0, 0.78, 0.15), 10)
						_emit_to_host({"type": "sfx", "name": "slow_hit"})
						if obstacle_nodes.has(obs_id):
							var bmp: Node3D = obstacle_nodes[obs_id]
							if is_instance_valid(bmp):
								bmp.scale.y = 0.45

			elif obs_type == "WALL" and not bool(obs["isPassed"]):
				if x_dist_h < 0.82 and jump_height < 0.68:
					if is_shield_protected:
						_deflect_with_shield(obs, obs_lane_x)
					else:
						_trigger_player_crash("Hit a barrier head-on")
						return

			elif obs_type == "MOVING_BLOCK" and not bool(obs["isPassed"]):
				if x_dist_h < 0.92 and jump_height < 0.85:
					if is_shield_protected:
						_deflect_with_shield(obs, obs_lane_x)
					else:
						_trigger_player_crash("Struck a moving hazard")
						return

			elif obs_type == "LASER" and not bool(obs["isPassed"]):
				if x_dist_h < 0.88:
					var evading: bool = p_is_sliding or jump_height > 0.68
					if not evading:
						if is_shield_protected:
							_deflect_with_shield(obs, obs_lane_x)
						else:
							_trigger_player_crash("Caught in a plasma gate")
							return

		# AI Rival Hazard Collision Check
		if game_mode == "AI_RIVAL" and opp_is_alive:
			var opp_diff: float = obs_dist - opp_distance
			if opp_diff > -0.60 and opp_diff < 0.75:
				var o_lane_x: float = WorldBuilder.get_lane_x(float(obs["lane"]))
				if obs_type == "MOVING_BLOCK":
					var ph2: float = float(obs["phase"]) + elapsed_time * float(obs["moveSpeed"])
					o_lane_x = sin(ph2) * (WorldBuilder.LANE_WIDTH * 1.1)
				var opp_x: float = WorldBuilder.get_lane_x(opp_x_offset)
				var opp_x_dist: float = absf(o_lane_x - opp_x)
				var opp_jh: float = pow(sin(clampf(opp_jump_progress, 0.0, 1.0) * PI), 0.68) * 2.35 if opp_is_jumping else 0.0
				var spark_z: float = -(opp_distance - p_distance) * 2.0

				if obs_type == "SLOW_BUMP" and not bool(obs["triggeredByOpponent"]) and not bool(obs["isPassed"]):
					if opp_x_dist < 0.85 and opp_jh < 0.32:
						obs["triggeredByOpponent"] = true
						opp_slow_timer = 1.2
				elif obs_type == "WALL" and not bool(obs["isPassed"]):
					if opp_x_dist < 0.85 and opp_jh < 0.68:
						_trigger_bot_crash("Hit a barrier head-on", opp_x, spark_z, "")
				elif obs_type == "MOVING_BLOCK" and not bool(obs["isPassed"]):
					if opp_x_dist < 0.95 and opp_jh < 0.85:
						_trigger_bot_crash("Struck a moving hazard", opp_x, spark_z, "")
				elif obs_type == "LASER" and not bool(obs["isPassed"]):
					if opp_x_dist < 0.90 and not (opp_is_sliding or opp_jh > 0.68):
						_trigger_bot_crash("Caught in a plasma gate", opp_x, spark_z, "")


func _deflect_with_shield(obs: Dictionary, obs_lane_x: float) -> void:
	obs["isPassed"] = true
	obs["triggeredByPlayer"] = true
	_remove_obstacle_mesh(String(obs["id"]))
	shake_amount = 0.10
	shake_duration = 0.15
	shake_elapsed = 0.0
	_spawn_burst(Vector3(obs_lane_x, 0.95, 0.0), Color(0.18, 0.92, 1.0), 18)
	_emit_to_host({"type": "sfx", "name": "shield_deflect"})


func _remove_obstacle_mesh(obs_id: String) -> void:
	if obstacle_nodes.has(obs_id):
		var n: Node3D = obstacle_nodes[obs_id]
		if is_instance_valid(n):
			n.queue_free()
		obstacle_nodes.erase(obs_id)


func _trigger_player_crash(reason: String) -> void:
	if not p_is_alive:
		return
	p_is_alive = false
	p_crash_reason = reason
	p_crash_elapsed = 0.0
	shake_amount = 0.28
	shake_duration = 0.42
	shake_elapsed = 0.0
	_spawn_burst(Vector3(player_rig.position.x, 0.9, 0.0), Color(1.0, 0.24, 0.36), 26)
	_emit_to_host({"type": "sfx", "name": "crash"})
	_emit_to_host({
		"type": "player_crash",
		"distance": maxi(0, int(p_distance)),
		"reason": reason
	})


func _trigger_bot_crash(reason: String, world_x: float, world_z: float, custom_subtitle: String) -> void:
	if not opp_is_alive:
		return
	opp_is_alive = false
	opp_crash_elapsed = 0.0
	if absf(world_z) < 40.0:
		_spawn_burst(Vector3(world_x, 0.9, world_z), Color(1.0, 0.48, 0.14), 22)
	_emit_to_host({"type": "sfx", "name": "bot_crash"})
	_emit_to_host({
		"type": "bot_crash",
		"distance": maxi(0, int(opp_distance)),
		"name": opponent_name,
		"reason": reason,
		"subtitle": custom_subtitle
	})


func _update_opponent_alive_or_crashed(dt: float) -> void:
	if opp_is_alive:
		var opp_speed_kph: float = _calc_runner_speed(opp_distance)
		if game_mode == "ONLINE_MATCH":
			if net_has_packet:
				var age_clamped: float = clampf(net_packet_age, 0.0, 0.25)
				var predicted: float = minf(goal_distance, net_server_distance + (net_server_speed * MPS_PER_KPH) * age_clamped)
				if absf(predicted - opp_distance) > 8.0:
					opp_distance = predicted
				else:
					opp_distance += (predicted - opp_distance) * minf(1.0, dt * 14.0)
				if net_server_speed > 0.1:
					opp_speed_kph = net_server_speed
			else:
				opp_distance += (opp_speed_kph * MPS_PER_KPH) * dt

			if opp_is_jumping:
				opp_jump_progress += dt * 2.75
				if opp_jump_progress >= 1.0:
					opp_is_jumping = false
					opp_jump_progress = 0.0
			if opp_is_sliding:
				opp_slide_progress += dt * 2.6
				if opp_slide_progress >= 1.0:
					opp_is_sliding = false
					opp_slide_progress = 0.0
			opp_x_offset += (float(opp_target_lane) - opp_x_offset) * minf(1.0, dt * 14.0)
		else:
			# AI_RIVAL Brain
			opp_slow_timer = maxf(0.0, opp_slow_timer - dt)
			var opp_slow_fac: float = (1.0 - 0.30 * minf(1.0, opp_slow_timer / 0.9)) if opp_slow_timer > 0.0 else 1.0
			var opp_ms_mult: float = _get_opponent_milestone_mult(opp_distance)
			opp_speed_kph = _calc_runner_speed(opp_distance) * 0.95 * opp_ms_mult * opp_slow_fac
			opp_distance += (opp_speed_kph * MPS_PER_KPH) * dt

			if opp_is_jumping:
				opp_jump_progress += dt * 2.75
				if opp_jump_progress >= 1.0:
					opp_is_jumping = false
					opp_jump_progress = 0.0
			if opp_is_sliding:
				opp_slide_progress += dt * 2.6
				if opp_slide_progress >= 1.0:
					opp_is_sliding = false
					opp_slide_progress = 0.0

			_run_ai_evasion()
			opp_x_offset += (float(opp_target_lane) - opp_x_offset) * minf(1.0, dt * 8.5)

		opp_fly_blend = lerpf(opp_fly_blend, 1.0 if opp_fly_timer > 0.0 else 0.0, 1.0 - exp(-8.5 * dt))
		var opp_rel_z: float = -(opp_distance - p_distance) * 2.0
		var opp_lane_x: float = WorldBuilder.get_lane_x(opp_x_offset)
		var visual_opp_x: float = opp_lane_x + same_lane_blend * 0.52
		var visual_opp_z: float = opp_rel_z - same_lane_blend * 0.55

		opponent_rig.position = Vector3(visual_opp_x, 0.0, visual_opp_z)
		opponent_rig.rotation.z = (float(opp_target_lane) - opp_x_offset) * (-0.22 - opp_fly_blend * 0.14)
		opponent_rig.update_pose(
			elapsed_time + 0.35,
			opp_speed_kph,
			opp_is_jumping,
			opp_is_sliding,
			opp_jump_progress,
			opp_fly_blend,
			opp_shield_timer,
			opp_fly_timer
		)
		opponent_rig.visible = (visual_opp_z > -92.0 and visual_opp_z < 16.0)
	else:
		opp_crash_elapsed += dt
		var opp_rel_z2: float = -(opp_distance - p_distance) * 2.0
		opponent_rig.position.z = opp_rel_z2
		opponent_rig.position.x = WorldBuilder.get_lane_x(opp_x_offset)
		if opp_crash_elapsed < 3.5:
			opponent_rig.rotation.x += dt * 8.0
			opponent_rig.rotation.y += dt * 10.0
			opponent_rig.rotation.z += dt * 5.0
			opponent_rig.position.y = maxf(0.08, 0.4 + sin(opp_crash_elapsed * 10.0) * maxf(0.0, 0.8 - opp_crash_elapsed * 0.3))
			opponent_rig.visible = (opp_rel_z2 > -90.0 and opp_rel_z2 < 30.0)
		else:
			opponent_rig.position.y = 0.08
			opponent_rig.rotation.x = PI * 0.5
			opponent_rig.visible = (opp_rel_z2 > -60.0 and opp_rel_z2 < 20.0)


func _run_ai_evasion() -> void:
	var lookahead: float = opp_distance + 15.0
	var upcoming: Array = []
	for item in obstacles_data:
		var o: Dictionary = item
		var t: String = String(o["type"])
		if t != "COIN" and t != "SHIELD_GEM" and t != "FLY_GEM" and not bool(o["triggeredByOpponent"]):
			var od: float = float(o["distance"])
			if od > opp_distance and od < lookahead:
				upcoming.append(o)
				if upcoming.size() >= 6:
					break

	if upcoming.size() == 0:
		return

	var nearest: Dictionary = upcoming[0]
	var h_dist: float = float(nearest["distance"]) - opp_distance
	var n_type: String = String(nearest["type"])
	var is_blunder: bool = opp_distance >= opp_crash_distance

	if is_blunder and n_type != "SLOW_BUMP" and h_dist < 4.5:
		return

	if h_dist < 12.0:
		var blocked: bool = false
		for h_item in upcoming:
			var h: Dictionary = h_item
			var hl: int = int(h["lane"])
			var ht: String = String(h["type"])
			if hl == opp_target_lane or (ht == "MOVING_BLOCK" and absf(WorldBuilder.get_lane_x(float(hl)) - WorldBuilder.get_lane_x(float(opp_target_lane))) < 1.2):
				blocked = true
				break

		if blocked:
			var clear_lanes: Array[int] = []
			for cand in [-1, 0, 1]:
				var lane_has_hazard: bool = false
				for h_item2 in upcoming:
					var h2: Dictionary = h_item2
					if int(h2["lane"]) == cand:
						lane_has_hazard = true
						break
				if not lane_has_hazard:
					clear_lanes.append(cand)

			if clear_lanes.size() > 0:
				var best_l: int = clear_lanes[0]
				for cl in clear_lanes:
					if absi(cl - opp_lane) < absi(best_l - opp_lane):
						best_l = cl
				opp_target_lane = best_l
				opp_lane = best_l
			elif (n_type == "WALL" or n_type == "SLOW_BUMP") and not opp_is_jumping and not opp_is_sliding:
				opp_is_jumping = true
				opp_jump_progress = 0.08
			elif n_type == "LASER" and not opp_is_sliding and not opp_is_jumping:
				opp_is_sliding = true
				opp_slide_progress = 0.0


func _handle_online_opponent_update(ev: Dictionary) -> void:
	net_server_distance = float(ev.get("distance", net_server_distance))
	net_server_speed = float(ev.get("speed", net_server_speed))
	net_packet_age = 0.0
	net_has_packet = true

	opp_lane = int(ev.get("lane", opp_lane))
	opp_target_lane = int(ev.get("targetLane", opp_target_lane))
	opp_slow_timer = float(ev.get("slowTimer", 0.0))
	opp_shield_timer = float(ev.get("shieldTimer", 0.0))
	opp_fly_timer = float(ev.get("flyTimer", 0.0))

	var incoming_jump: bool = bool(ev.get("isJumping", false))
	if incoming_jump and not opp_is_jumping:
		opp_is_jumping = true
		opp_jump_progress = maxf(0.06, float(ev.get("jumpProgress", 0.08)))
	elif not incoming_jump:
		opp_is_jumping = false
		opp_jump_progress = 0.0

	var incoming_slide: bool = bool(ev.get("isSliding", false))
	if incoming_slide and not opp_is_sliding:
		opp_is_sliding = true
		opp_slide_progress = float(ev.get("slideProgress", 0.0))
	elif not incoming_slide:
		opp_is_sliding = false
		opp_slide_progress = 0.0


func _handle_online_match_result(ev: Dictionary) -> void:
	var i_won: bool = bool(ev.get("won", false))
	var final_opp_d: int = maxi(0, int(ev.get("opponentDistance", 0)))
	var rsn: String = String(ev.get("reason", ""))
	opp_distance = float(final_opp_d)

	net_auth_result = {
		"won": i_won,
		"reason": rsn,
		"opponentDistance": final_opp_d,
		"opponentWon": not i_won
	}

	if p_is_alive and not game_over_handled:
		if (not i_won) or net_reported_finish:
			_conclude_race(i_won, p_distance, rsn, final_opp_d, not i_won)
		else:
			net_forfeit_timer = 0.95


func _conclude_race(
	won: bool,
	final_dist: float,
	reason: String,
	opp_final_dist: int,
	opp_won: bool
) -> void:
	if game_over_handled:
		return
	game_over_handled = true
	race_started = false
	if won:
		_emit_to_host({"type": "sfx", "name": "win"})

	var stars: int = 0
	if won:
		stars = 1
		if p_coins >= 5:
			stars = 2
		if p_coins >= 10:
			stars = 3

	_emit_to_host({
		"type": "game_over",
		"won": won,
		"distance": maxi(0, int(final_dist)),
		"goalDistance": int(goal_distance),
		"stars": stars,
		"coins": p_coins,
		"crashReason": reason,
		"opponentDistance": maxi(0, opp_final_dist),
		"opponentWon": opp_won
	})


func _spawn_burst(origin: Vector3, col: Color, count: int) -> void:
	var p_mat: StandardMaterial3D = StandardMaterial3D.new()
	p_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	p_mat.albedo_color = col

	var box: BoxMesh = BoxMesh.new()
	box.size = Vector3(0.16, 0.16, 0.16)

	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.randomize()

	for i in range(count):
		var inst: MeshInstance3D = MeshInstance3D.new()
		inst.mesh = box
		inst.material_override = p_mat
		inst.position = origin
		particles_root.add_child(inst)
		var vel: Vector3 = Vector3(
			rng.randf_range(-5.2, 5.2),
			rng.randf_range(2.2, 6.8),
			rng.randf_range(-4.5, 4.5)
		)
		burst_particles.append({
			"node": inst,
			"vel": vel,
			"life": rng.randf_range(0.38, 0.72),
			"age": 0.0
		})


func _update_particles(dt: float) -> void:
	var idx: int = burst_particles.size() - 1
	while idx >= 0:
		var p: Dictionary = burst_particles[idx]
		var n: MeshInstance3D = p["node"]
		var age: float = float(p["age"]) + dt
		var life: float = float(p["life"])
		if age >= life or not is_instance_valid(n):
			if is_instance_valid(n):
				n.queue_free()
			burst_particles.remove_at(idx)
		else:
			var vel: Vector3 = p["vel"]
			vel.y -= 14.0 * dt
			n.position += vel * dt
			n.rotation += Vector3(6.0, 8.0, 5.0) * dt
			var sc: float = maxf(0.05, 1.0 - age / life)
			n.scale = Vector3(sc, sc, sc)
			p["vel"] = vel
			p["age"] = age
		idx -= 1
