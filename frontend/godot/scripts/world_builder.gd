class_name WorldBuilder
extends RefCounted

const LANE_WIDTH: float = 2.4

const OBSTACLE_SCENE_PATHS: Dictionary = {
	"WALL": "res://scenes/obstacles/wall.tscn",
	"MOVING_BLOCK": "res://scenes/obstacles/moving_block.tscn",
	"LASER": "res://scenes/obstacles/laser.tscn",
	"SLOW_BUMP": "res://scenes/obstacles/slow_bump.tscn",
	"COIN": "res://scenes/obstacles/coin.tscn",
	"SHIELD_GEM": "res://scenes/obstacles/shield_gem.tscn",
	"FLY_GEM": "res://scenes/obstacles/fly_gem.tscn"
}

const MILESTONE_GATE_PATH: String = "res://scenes/obstacles/milestone_gate.tscn"
const FINISH_GATE_PATH: String = "res://scenes/obstacles/finish_gate.tscn"

static var _scene_cache: Dictionary = {}


static func get_lane_x(lane_offset: float) -> float:
	return lane_offset * LANE_WIDTH


static func _load_cached_scene(res_path: String) -> PackedScene:
	if _scene_cache.has(res_path):
		return _scene_cache[res_path] as PackedScene
	if ResourceLoader.exists(res_path):
		var sc: PackedScene = ResourceLoader.load(res_path) as PackedScene
		if sc != null:
			_scene_cache[res_path] = sc
			return sc
	return null


static func preload_all_scenes() -> void:
	for k in OBSTACLE_SCENE_PATHS.keys():
		_load_cached_scene(String(OBSTACLE_SCENE_PATHS[k]))
	_load_cached_scene(MILESTONE_GATE_PATH)
	_load_cached_scene(FINISH_GATE_PATH)
	RunnerRig.preload_character_scenes()


static func create_obstacle_node(obs_type: String, accent_hex: String) -> Node3D:
	if OBSTACLE_SCENE_PATHS.has(obs_type):
		var sc: PackedScene = _load_cached_scene(String(OBSTACLE_SCENE_PATHS[obs_type]))
		if sc != null:
			var inst: Node3D = sc.instantiate() as Node3D
			if inst != null:
				return inst
	return build_obstacle_template(obs_type, accent_hex)


static func create_milestone_gate(kind: String, is_finish: bool, accent_hex: String) -> Node3D:
	var target_path: String = FINISH_GATE_PATH if is_finish else MILESTONE_GATE_PATH
	var sc: PackedScene = _load_cached_scene(target_path)
	if sc != null:
		var inst: Node3D = sc.instantiate() as Node3D
		if inst != null:
			if not is_finish:
				_tint_milestone_gate(inst, kind, accent_hex)
			return inst
	return build_milestone_gate_template(kind, is_finish, accent_hex)


static func _tint_milestone_gate(gate: Node3D, kind: String, accent_hex: String) -> void:
	var gate_color: Color = Color.from_string(accent_hex, Color(0.12, 0.90, 0.58))
	if kind == "FOG":
		gate_color = Color(0.22, 0.74, 0.98)
	elif kind == "FOG_SPEED":
		gate_color = Color(0.66, 0.42, 0.98)
	else:
		gate_color = Color(0.12, 0.90, 0.58)

	var neon_mat: StandardMaterial3D = StandardMaterial3D.new()
	neon_mat.albedo_color = gate_color
	neon_mat.emission_enabled = true
	neon_mat.emission = gate_color
	neon_mat.emission_energy_multiplier = 2.4

	var banner_mat: StandardMaterial3D = StandardMaterial3D.new()
	banner_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	banner_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	banner_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	banner_mat.albedo_color = Color(gate_color.r, gate_color.g, gate_color.b, 0.26)

	for n_path in ["TrimLeft", "TrimRight", "HeaderBar"]:
		var m: MeshInstance3D = gate.get_node_or_null(n_path) as MeshInstance3D
		if m != null:
			m.material_override = neon_mat

	var curtain: MeshInstance3D = gate.get_node_or_null("Curtain") as MeshInstance3D
	if curtain != null:
		curtain.material_override = banner_mat


static func build_obstacle_template(obs_type: String, accent_hex: String) -> Node3D:
	var root: Node3D = Node3D.new()
	root.name = obs_type.capitalize().replace(" ", "")
	var accent: Color = Color.from_string(accent_hex, Color(0.024, 0.714, 0.831))

	if obs_type == "WALL":
		var base_mat: StandardMaterial3D = StandardMaterial3D.new()
		base_mat.albedo_color = Color(0.12, 0.15, 0.22)
		base_mat.metallic = 0.6
		base_mat.roughness = 0.32

		var glow_mat: StandardMaterial3D = StandardMaterial3D.new()
		glow_mat.albedo_color = Color(0.96, 0.24, 0.34)
		glow_mat.emission_enabled = true
		glow_mat.emission = Color(0.98, 0.20, 0.32)
		glow_mat.emission_energy_multiplier = 2.2

		var body: MeshInstance3D = _named_box("BarrierBody", Vector3(1.88, 1.18, 0.56), base_mat)
		body.position = Vector3(0.0, 0.59, 0.0)
		root.add_child(body)

		var top_bar: MeshInstance3D = _named_box("TopNeonBar", Vector3(1.94, 0.14, 0.62), glow_mat)
		top_bar.position = Vector3(0.0, 1.16, 0.0)
		root.add_child(top_bar)

		var mid_stripe: MeshInstance3D = _named_box("HazardStripe", Vector3(1.72, 0.12, 0.60), glow_mat)
		mid_stripe.position = Vector3(0.0, 0.62, 0.0)
		root.add_child(mid_stripe)

	elif obs_type == "MOVING_BLOCK":
		var hull_mat: StandardMaterial3D = StandardMaterial3D.new()
		hull_mat.albedo_color = Color(0.18, 0.12, 0.28)
		hull_mat.metallic = 0.7
		hull_mat.roughness = 0.24

		var core_mat: StandardMaterial3D = StandardMaterial3D.new()
		core_mat.albedo_color = Color(1.0, 0.42, 0.12)
		core_mat.emission_enabled = true
		core_mat.emission = Color(1.0, 0.36, 0.08)
		core_mat.emission_energy_multiplier = 2.4

		var drone: MeshInstance3D = _named_box("DroneHull", Vector3(1.56, 1.24, 0.68), hull_mat)
		drone.position = Vector3(0.0, 0.74, 0.0)
		root.add_child(drone)

		var band: MeshInstance3D = _named_box("CoreBand", Vector3(1.62, 0.22, 0.72), core_mat)
		band.position = Vector3(0.0, 0.74, 0.0)
		root.add_child(band)

		var ring_inst: MeshInstance3D = MeshInstance3D.new()
		ring_inst.name = "HoverThrusterRing"
		var torus: TorusMesh = TorusMesh.new()
		torus.inner_radius = 0.45
		torus.outer_radius = 0.58
		torus.rings = 16
		torus.ring_segments = 8
		ring_inst.mesh = torus
		ring_inst.material_override = core_mat
		ring_inst.position = Vector3(0.0, 0.12, 0.0)
		root.add_child(ring_inst)

	elif obs_type == "LASER":
		var post_mat: StandardMaterial3D = StandardMaterial3D.new()
		post_mat.albedo_color = Color(0.14, 0.16, 0.24)
		post_mat.metallic = 0.65
		post_mat.roughness = 0.3

		var beam_mat: StandardMaterial3D = StandardMaterial3D.new()
		beam_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		beam_mat.albedo_color = Color(1.0, 0.16, 0.58)

		var halo_mat: StandardMaterial3D = StandardMaterial3D.new()
		halo_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		halo_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		halo_mat.albedo_color = Color(1.0, 0.24, 0.68, 0.38)

		var post_l: MeshInstance3D = _named_box("PostLeft", Vector3(0.18, 2.25, 0.22), post_mat)
		post_l.position = Vector3(-0.96, 1.125, 0.0)
		root.add_child(post_l)

		var post_r: MeshInstance3D = _named_box("PostRight", Vector3(0.18, 2.25, 0.22), post_mat)
		post_r.position = Vector3(0.96, 1.125, 0.0)
		root.add_child(post_r)

		var idx: int = 0
		for beam_y in [1.18, 1.66]:
			idx += 1
			var beam: MeshInstance3D = _named_box("PlasmaBeam%d" % idx, Vector3(1.88, 0.09, 0.09), beam_mat)
			beam.position = Vector3(0.0, beam_y, 0.0)
			root.add_child(beam)

			var halo: MeshInstance3D = _named_box("PlasmaHalo%d" % idx, Vector3(1.88, 0.22, 0.22), halo_mat)
			halo.position = Vector3(0.0, beam_y, 0.0)
			root.add_child(halo)

	elif obs_type == "SLOW_BUMP":
		var pad_mat: StandardMaterial3D = StandardMaterial3D.new()
		pad_mat.albedo_color = Color(0.20, 0.17, 0.08)
		pad_mat.roughness = 0.45

		var warn_mat: StandardMaterial3D = StandardMaterial3D.new()
		warn_mat.albedo_color = Color(0.98, 0.75, 0.14)
		warn_mat.emission_enabled = true
		warn_mat.emission = Color(0.98, 0.68, 0.08)
		warn_mat.emission_energy_multiplier = 1.6

		var pad: MeshInstance3D = _named_box("BumpPad", Vector3(1.88, 0.20, 0.72), pad_mat)
		pad.position = Vector3(0.0, 0.10, 0.0)
		root.add_child(pad)

		var strip_a: MeshInstance3D = _named_box("CautionStripFront", Vector3(1.76, 0.07, 0.14), warn_mat)
		strip_a.position = Vector3(0.0, 0.21, -0.18)
		root.add_child(strip_a)

		var strip_b: MeshInstance3D = _named_box("CautionStripBack", Vector3(1.76, 0.07, 0.14), warn_mat)
		strip_b.position = Vector3(0.0, 0.21, 0.18)
		root.add_child(strip_b)

	elif obs_type == "COIN":
		var spin_pivot: Node3D = Node3D.new()
		spin_pivot.name = "SpinPivot"
		spin_pivot.position = Vector3(0.0, 0.92, 0.0)
		root.add_child(spin_pivot)

		var gold_mat: StandardMaterial3D = StandardMaterial3D.new()
		gold_mat.albedo_color = Color(1.0, 0.84, 0.18)
		gold_mat.emission_enabled = true
		gold_mat.emission = Color(1.0, 0.76, 0.10)
		gold_mat.emission_energy_multiplier = 2.0
		gold_mat.metallic = 0.55
		gold_mat.roughness = 0.2

		var core_mat: StandardMaterial3D = StandardMaterial3D.new()
		core_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		core_mat.albedo_color = Color(0.35, 0.96, 1.0)

		var ring_mesh: MeshInstance3D = MeshInstance3D.new()
		ring_mesh.name = "OuterGoldRing"
		var torus: TorusMesh = TorusMesh.new()
		torus.inner_radius = 0.24
		torus.outer_radius = 0.40
		torus.rings = 18
		torus.ring_segments = 10
		ring_mesh.mesh = torus
		ring_mesh.material_override = gold_mat
		ring_mesh.rotation.x = PI * 0.5
		spin_pivot.add_child(ring_mesh)

		var center_gem: MeshInstance3D = MeshInstance3D.new()
		center_gem.name = "InnerCoreGem"
		var oct: SphereMesh = SphereMesh.new()
		oct.radius = 0.17
		oct.height = 0.34
		oct.radial_segments = 4
		oct.rings = 1
		center_gem.mesh = oct
		center_gem.material_override = core_mat
		spin_pivot.add_child(center_gem)

	elif obs_type == "SHIELD_GEM":
		var spin_pivot: Node3D = Node3D.new()
		spin_pivot.name = "SpinPivot"
		spin_pivot.position = Vector3(0.0, 1.08, 0.0)
		root.add_child(spin_pivot)

		var gem_mat: StandardMaterial3D = StandardMaterial3D.new()
		gem_mat.albedo_color = Color(0.12, 0.92, 1.0)
		gem_mat.emission_enabled = true
		gem_mat.emission = Color(0.06, 0.85, 1.0)
		gem_mat.emission_energy_multiplier = 2.6
		gem_mat.roughness = 0.1

		var ring_mat: StandardMaterial3D = StandardMaterial3D.new()
		ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		ring_mat.albedo_color = Color(0.45, 0.97, 1.0, 0.82)

		var crystal: MeshInstance3D = MeshInstance3D.new()
		crystal.name = "ShieldCrystal"
		var oct: SphereMesh = SphereMesh.new()
		oct.radius = 0.42
		oct.height = 0.92
		oct.radial_segments = 4
		oct.rings = 1
		crystal.mesh = oct
		crystal.material_override = gem_mat
		spin_pivot.add_child(crystal)

		var orbit_torus: TorusMesh = TorusMesh.new()
		orbit_torus.inner_radius = 0.56
		orbit_torus.outer_radius = 0.63
		orbit_torus.rings = 20
		orbit_torus.ring_segments = 8

		var orbit_a: MeshInstance3D = MeshInstance3D.new()
		orbit_a.name = "OrbitRingA"
		orbit_a.mesh = orbit_torus
		orbit_a.material_override = ring_mat
		orbit_a.rotation = Vector3(0.7, 0.0, 0.4)
		spin_pivot.add_child(orbit_a)

		var orbit_b: MeshInstance3D = MeshInstance3D.new()
		orbit_b.name = "OrbitRingB"
		orbit_b.mesh = orbit_torus
		orbit_b.material_override = ring_mat
		orbit_b.rotation = Vector3(-0.7, 0.4, -0.4)
		spin_pivot.add_child(orbit_b)

	elif obs_type == "FLY_GEM":
		var spin_pivot: Node3D = Node3D.new()
		spin_pivot.name = "SpinPivot"
		spin_pivot.position = Vector3(0.0, 1.15, 0.0)
		root.add_child(spin_pivot)

		var sky_mat: StandardMaterial3D = StandardMaterial3D.new()
		sky_mat.albedo_color = Color(1.0, 0.78, 0.14)
		sky_mat.emission_enabled = true
		sky_mat.emission = Color(1.0, 0.65, 0.08)
		sky_mat.emission_energy_multiplier = 2.8
		sky_mat.roughness = 0.12

		var wing_mat: StandardMaterial3D = StandardMaterial3D.new()
		wing_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		wing_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		wing_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		wing_mat.albedo_color = Color(1.0, 0.90, 0.38, 0.86)

		var star_core: MeshInstance3D = MeshInstance3D.new()
		star_core.name = "SkyStarCore"
		var oct: SphereMesh = SphereMesh.new()
		oct.radius = 0.40
		oct.height = 0.88
		oct.radial_segments = 4
		oct.rings = 1
		star_core.mesh = oct
		star_core.material_override = sky_mat
		spin_pivot.add_child(star_core)

		var fin_l: MeshInstance3D = _named_box("WingFinLeft", Vector3(0.62, 0.18, 0.05), wing_mat)
		fin_l.position = Vector3(-0.48, 0.08, 0.0)
		fin_l.rotation.z = 0.36
		spin_pivot.add_child(fin_l)

		var fin_r: MeshInstance3D = _named_box("WingFinRight", Vector3(0.62, 0.18, 0.05), wing_mat)
		fin_r.position = Vector3(0.48, 0.08, 0.0)
		fin_r.rotation.z = -0.36
		spin_pivot.add_child(fin_r)

	else:
		var fallback_mat: StandardMaterial3D = StandardMaterial3D.new()
		fallback_mat.albedo_color = accent
		var box_m: MeshInstance3D = _named_box("FallbackMesh", Vector3(1.6, 1.1, 0.5), fallback_mat)
		box_m.position = Vector3(0.0, 0.55, 0.0)
		root.add_child(box_m)

	return root


static func build_milestone_gate_template(kind: String, is_finish: bool, accent_hex: String) -> Node3D:
	var root: Node3D = Node3D.new()
	root.name = "FinishGate" if is_finish else "MilestoneGate"
	var gate_color: Color = Color.from_string(accent_hex, Color(0.12, 0.90, 0.58))

	if is_finish:
		gate_color = Color(1.0, 0.80, 0.18)
	elif kind == "FOG":
		gate_color = Color(0.22, 0.74, 0.98)
	elif kind == "FOG_SPEED":
		gate_color = Color(0.66, 0.42, 0.98)
	else:
		gate_color = Color(0.12, 0.90, 0.58)

	var pillar_mat: StandardMaterial3D = StandardMaterial3D.new()
	pillar_mat.albedo_color = Color(0.10, 0.13, 0.20)
	pillar_mat.metallic = 0.65
	pillar_mat.roughness = 0.28

	var neon_mat: StandardMaterial3D = StandardMaterial3D.new()
	neon_mat.albedo_color = gate_color
	neon_mat.emission_enabled = true
	neon_mat.emission = gate_color
	neon_mat.emission_energy_multiplier = 2.4

	var banner_mat: StandardMaterial3D = StandardMaterial3D.new()
	banner_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	banner_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	banner_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	banner_mat.albedo_color = Color(gate_color.r, gate_color.g, gate_color.b, 0.26 if not is_finish else 0.38)

	var pillar_l: MeshInstance3D = _named_box("PillarLeft", Vector3(0.32, 5.2, 0.34), pillar_mat)
	pillar_l.position = Vector3(-4.15, 2.6, 0.0)
	root.add_child(pillar_l)

	var trim_l: MeshInstance3D = _named_box("TrimLeft", Vector3(0.10, 5.0, 0.38), neon_mat)
	trim_l.position = Vector3(-3.98, 2.6, 0.0)
	root.add_child(trim_l)

	var pillar_r: MeshInstance3D = _named_box("PillarRight", Vector3(0.32, 5.2, 0.34), pillar_mat)
	pillar_r.position = Vector3(4.15, 2.6, 0.0)
	root.add_child(pillar_r)

	var trim_r: MeshInstance3D = _named_box("TrimRight", Vector3(0.10, 5.0, 0.38), neon_mat)
	trim_r.position = Vector3(3.98, 2.6, 0.0)
	root.add_child(trim_r)

	var header_bar: MeshInstance3D = _named_box("HeaderBar", Vector3(8.62, 0.36, 0.40), neon_mat)
	header_bar.position = Vector3(0.0, 5.15, 0.0)
	root.add_child(header_bar)

	var curtain: MeshInstance3D = _named_box("Curtain", Vector3(7.90, 0.85, 0.06), banner_mat)
	curtain.position = Vector3(0.0, 4.55, 0.0)
	root.add_child(curtain)

	if is_finish:
		var crown: MeshInstance3D = _named_box("FinishCrown", Vector3(5.2, 0.26, 0.34), neon_mat)
		crown.position = Vector3(0.0, 5.62, 0.0)
		root.add_child(crown)

	return root


static func _named_box(node_name: String, sz: Vector3, mat: Material) -> MeshInstance3D:
	var inst: MeshInstance3D = MeshInstance3D.new()
	inst.name = node_name
	var b: BoxMesh = BoxMesh.new()
	b.size = sz
	inst.mesh = b
	inst.material_override = mat
	return inst
