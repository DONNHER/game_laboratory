class_name RunnerRig
extends Node3D

@export var character_id: String = "kai"
@export var is_rival_runner: bool = false
## When true, custom materials/meshes authored in Godot Editor (.tscn or .glb) are preserved.
@export var preserve_scene_materials: bool = false
@export var default_wing_alpha: float = 0.0

static var _character_scene_cache: Dictionary = {}

var body_pivot: Node3D
var hips: Node3D
var torso: Node3D
var head_pivot: Node3D
var arm_l: Node3D
var arm_r: Node3D
var leg_l: Node3D
var leg_r: Node3D
var flame_l: MeshInstance3D
var flame_r: MeshInstance3D
var wing_l: MeshInstance3D
var wing_r: MeshInstance3D
var contact_shadow: MeshInstance3D
var shield_group: Node3D
var shield_ring_a: MeshInstance3D
var shield_ring_b: MeshInstance3D
var rival_diamond: MeshInstance3D

# Optional imported 3D model (.glb / .gltf / .fbx) & skeletal AnimationPlayer
var custom_model: Node3D
var custom_anim: AnimationPlayer
var _custom_model_base_y: float = 0.0
var _custom_model_base_rot: Vector3 = Vector3.ZERO
var _active_anim_state: String = ""
var _loaded_custom_scene_id: String = ""

var _wing_mat: StandardMaterial3D
var _flame_mat: StandardMaterial3D
var _shield_dome_mat: StandardMaterial3D
var _base_wing_alpha: float = 0.0


static func preload_character_scenes() -> void:
	for cid in ["zephyr"]:
		_get_cached_character_scene(cid)


static func _get_cached_character_scene(cid: String) -> PackedScene:
	var clean_id: String = cid.to_lower()
	if _character_scene_cache.has(clean_id):
		return _character_scene_cache[clean_id] as PackedScene
	var scene_path: String = "res://scenes/characters/%s.tscn" % clean_id
	if ResourceLoader.exists(scene_path):
		var sc: PackedScene = ResourceLoader.load(scene_path) as PackedScene
		if sc != null:
			_character_scene_cache[clean_id] = sc
			return sc
	return null


func _ready() -> void:
	_bind_existing_nodes()


func _bind_existing_nodes() -> bool:
	body_pivot = null
	hips = null
	torso = null
	head_pivot = null
	arm_l = null
	arm_r = null
	leg_l = null
	leg_r = null
	flame_l = null
	flame_r = null
	wing_l = null
	wing_r = null
	rival_diamond = null
	shield_ring_a = null
	shield_ring_b = null
	custom_model = null
	custom_anim = null

	contact_shadow = get_node_or_null("ContactShadow") as MeshInstance3D
	shield_group = get_node_or_null("ShieldGroup") as Node3D
	if shield_group != null:
		shield_ring_a = shield_group.get_node_or_null("ShieldRingA") as MeshInstance3D
		shield_ring_b = shield_group.get_node_or_null("ShieldRingB") as MeshInstance3D

	custom_model = get_node_or_null("CustomModel") as Node3D
	if custom_model != null and custom_model.get_child_count() > 0:
		_custom_model_base_y = custom_model.position.y
		_custom_model_base_rot = custom_model.rotation
		custom_anim = custom_model.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if custom_anim == null:
			custom_anim = find_child("AnimationPlayer", true, false) as AnimationPlayer
		rival_diamond = get_node_or_null("RivalDiamond") as MeshInstance3D
		return true
	else:
		custom_model = null

	body_pivot = get_node_or_null("BodyPivot") as Node3D
	if body_pivot != null:
		hips = body_pivot.get_node_or_null("Hips") as Node3D
		if hips != null:
			torso = hips.get_node_or_null("Torso") as Node3D
			leg_l = hips.get_node_or_null("LegL") as Node3D
			leg_r = hips.get_node_or_null("LegR") as Node3D
			if torso != null:
				head_pivot = torso.get_node_or_null("HeadPivot") as Node3D
				arm_l = torso.get_node_or_null("ArmL") as Node3D
				arm_r = torso.get_node_or_null("ArmR") as Node3D
				flame_l = torso.get_node_or_null("FlameL") as MeshInstance3D
				flame_r = torso.get_node_or_null("FlameR") as MeshInstance3D
				wing_l = torso.get_node_or_null("WingL") as MeshInstance3D
				wing_r = torso.get_node_or_null("WingR") as MeshInstance3D
				if head_pivot != null:
					rival_diamond = head_pivot.get_node_or_null("RivalDiamond") as MeshInstance3D

	if head_pivot != null and arm_l != null and arm_r != null and leg_l != null and leg_r != null:
		return true

	# Fallback check: user dropped a .glb / Node3D directly as child of the character .tscn
	for ch in get_children():
		if ch is Node3D and ch.name != "ContactShadow" and ch.name != "ShieldGroup" and ch.name != "RivalDiamond" and ch.name != "BodyPivot":
			custom_model = ch as Node3D
			_custom_model_base_y = custom_model.position.y
			_custom_model_base_rot = custom_model.rotation
			custom_anim = find_child("AnimationPlayer", true, false) as AnimationPlayer
			rival_diamond = get_node_or_null("RivalDiamond") as MeshInstance3D
			return true

	return false


func setup(p_character_id: String, p_is_rival: bool = false) -> void:
	character_id = p_character_id.to_lower()
	is_rival_runner = p_is_rival
	_active_anim_state = ""

	var custom_packed: PackedScene = _get_cached_character_scene(character_id)
	if custom_packed != null:
		if _loaded_custom_scene_id != character_id:
			_replace_children_from_packed_scene(custom_packed)
			_loaded_custom_scene_id = character_id
		_ensure_runtime_fx_nodes()
		_bind_existing_nodes()
		if preserve_scene_materials:
			_sync_preserved_scene_materials()
		else:
			_apply_character_palette()
		return

	if _loaded_custom_scene_id != "" or not _bind_existing_nodes():
		preserve_scene_materials = false
		default_wing_alpha = 0.0
		_loaded_custom_scene_id = ""
		build_hierarchy()
		_bind_existing_nodes()

	_apply_character_palette()


func _replace_children_from_packed_scene(packed: PackedScene) -> void:
	for child in get_children():
		remove_child(child)
		child.free()

	var inst: Node3D = packed.instantiate() as Node3D
	if inst == null:
		return

	var keep_mats: Variant = inst.get("preserve_scene_materials")
	preserve_scene_materials = bool(keep_mats) if keep_mats != null else true
	var wing_a: Variant = inst.get("default_wing_alpha")
	default_wing_alpha = float(wing_a) if wing_a != null else 0.0

	var copied_children: Array[Node] = []
	for ch in inst.get_children():
		copied_children.append(ch)
	for ch in copied_children:
		inst.remove_child(ch)
		add_child(ch)
	inst.free()


func _ensure_runtime_fx_nodes() -> void:
	if get_node_or_null("ContactShadow") == null:
		var cs: MeshInstance3D = MeshInstance3D.new()
		cs.name = "ContactShadow"
		var shadow_cyl: CylinderMesh = CylinderMesh.new()
		shadow_cyl.top_radius = 0.52
		shadow_cyl.bottom_radius = 0.52
		shadow_cyl.height = 0.015
		shadow_cyl.radial_segments = 18
		var shadow_mat: StandardMaterial3D = StandardMaterial3D.new()
		shadow_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		shadow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		shadow_mat.albedo_color = Color(0.0, 0.0, 0.0, 0.48)
		cs.mesh = shadow_cyl
		cs.material_override = shadow_mat
		cs.position = Vector3(0.0, 0.02, 0.0)
		add_child(cs)

	if get_node_or_null("ShieldGroup") == null:
		_create_shield_group_nodes()

	if find_child("RivalDiamond", true, false) == null:
		var rd: MeshInstance3D = MeshInstance3D.new()
		rd.name = "RivalDiamond"
		var d_mesh: SphereMesh = SphereMesh.new()
		d_mesh.radius = 0.11
		d_mesh.height = 0.22
		d_mesh.radial_segments = 4
		d_mesh.rings = 1
		var d_mat: StandardMaterial3D = StandardMaterial3D.new()
		d_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		d_mat.albedo_color = Color(1.0, 0.48, 0.12)
		rd.mesh = d_mesh
		rd.material_override = d_mat
		rd.position = Vector3(0.0, 2.15, 0.0)
		rd.visible = is_rival_runner
		add_child(rd)


func _sync_preserved_scene_materials() -> void:
	_base_wing_alpha = default_wing_alpha

	if flame_l != null and flame_l.material_override is StandardMaterial3D:
		_flame_mat = (flame_l.material_override as StandardMaterial3D).duplicate() as StandardMaterial3D
		flame_l.material_override = _flame_mat
		if flame_r != null:
			flame_r.material_override = _flame_mat

	if wing_l != null:
		if wing_l.material_override is StandardMaterial3D:
			_wing_mat = (wing_l.material_override as StandardMaterial3D).duplicate() as StandardMaterial3D
			if _base_wing_alpha <= 0.001 and _wing_mat.albedo_color.a > 0.02:
				_base_wing_alpha = _wing_mat.albedo_color.a
		else:
			_wing_mat = StandardMaterial3D.new()
			_wing_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			_wing_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			_wing_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
			_wing_mat.albedo_color = Color(0.68, 0.45, 1.0, _base_wing_alpha)
		wing_l.material_override = _wing_mat
		wing_l.visible = _base_wing_alpha > 0.02
		if wing_r != null:
			wing_r.material_override = _wing_mat
			wing_r.visible = _base_wing_alpha > 0.02

	_shield_dome_mat = StandardMaterial3D.new()
	_shield_dome_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_shield_dome_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_shield_dome_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_shield_dome_mat.albedo_color = Color(0.12, 0.88, 1.0, 0.22)

	if rival_diamond != null:
		rival_diamond.visible = is_rival_runner
	if shield_group != null:
		var dome: MeshInstance3D = shield_group.get_node_or_null("ShieldDome") as MeshInstance3D
		if dome != null:
			dome.material_override = _shield_dome_mat
		shield_group.visible = false


func _get_palette(cid: String) -> Dictionary:
	var pal: Dictionary = {
		"suit": Color(0.008, 0.518, 0.780),
		"armor": Color(0.012, 0.412, 0.631),
		"visor": Color(0.220, 0.741, 0.973),
		"thruster": Color(0.0, 0.941, 1.0),
		"torso_scale": Vector3(1.0, 1.0, 1.0),
		"wing_alpha": 0.0
	}
	if cid == "blaze":
		pal["suit"] = Color(0.725, 0.110, 0.110)
		pal["armor"] = Color(0.118, 0.161, 0.231)
		pal["visor"] = Color(0.976, 0.451, 0.086)
		pal["thruster"] = Color(1.0, 0.271, 0.0)
		pal["torso_scale"] = Vector3(1.16, 1.04, 1.12)
	elif cid == "nova":
		pal["suit"] = Color(0.859, 0.153, 0.467)
		pal["armor"] = Color(0.486, 0.227, 0.929)
		pal["visor"] = Color(0.957, 0.447, 0.714)
		pal["thruster"] = Color(1.0, 0.0, 0.498)
		pal["torso_scale"] = Vector3(0.92, 0.98, 0.92)
		pal["wing_alpha"] = 0.52
	elif cid == "luna":
		pal["suit"] = Color(0.020, 0.588, 0.412)
		pal["armor"] = Color(0.059, 0.090, 0.165)
		pal["visor"] = Color(0.204, 0.827, 0.600)
		pal["thruster"] = Color(0.063, 0.725, 0.506)
		pal["torso_scale"] = Vector3(0.94, 0.99, 0.94)
	elif cid == "zephyr":
		pal["suit"] = Color(0.420, 0.160, 0.850)
		pal["armor"] = Color(0.110, 0.080, 0.220)
		pal["visor"] = Color(0.760, 0.520, 0.990)
		pal["thruster"] = Color(0.680, 0.340, 1.0)
		pal["torso_scale"] = Vector3(0.98, 1.02, 0.98)
		pal["wing_alpha"] = 0.44
	return pal


func _apply_character_palette() -> void:
	var pal: Dictionary = _get_palette(character_id)
	var suit_col: Color = pal["suit"]
	var armor_col: Color = pal["armor"]
	var visor_col: Color = pal["visor"]
	var thruster_col: Color = pal["thruster"]
	_base_wing_alpha = float(pal["wing_alpha"])

	if torso != null:
		torso.scale = pal["torso_scale"]

	var suit_mat: StandardMaterial3D = StandardMaterial3D.new()
	suit_mat.albedo_color = suit_col
	suit_mat.metallic = 0.35
	suit_mat.roughness = 0.38

	var armor_mat: StandardMaterial3D = StandardMaterial3D.new()
	armor_mat.albedo_color = armor_col
	armor_mat.metallic = 0.65
	armor_mat.roughness = 0.26

	var visor_mat: StandardMaterial3D = StandardMaterial3D.new()
	visor_mat.albedo_color = visor_col
	visor_mat.emission_enabled = true
	visor_mat.emission = visor_col
	visor_mat.emission_energy_multiplier = 2.1
	visor_mat.roughness = 0.15

	_flame_mat = StandardMaterial3D.new()
	_flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_flame_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_flame_mat.albedo_color = Color(thruster_col.r, thruster_col.g, thruster_col.b, 0.9)

	_wing_mat = StandardMaterial3D.new()
	_wing_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_wing_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_wing_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_wing_mat.albedo_color = Color(visor_col.r, visor_col.g, visor_col.b, _base_wing_alpha)

	_shield_dome_mat = StandardMaterial3D.new()
	_shield_dome_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_shield_dome_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_shield_dome_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_shield_dome_mat.albedo_color = Color(0.12, 0.88, 1.0, 0.22)

	_set_mat("BodyPivot/Hips/Torso/ChestMesh", suit_mat)
	_set_mat("BodyPivot/Hips/Torso/ArmorPlate", armor_mat)
	_set_mat("BodyPivot/Hips/Torso/SpineGlow", visor_mat)
	_set_mat("BodyPivot/Hips/Torso/PodL", armor_mat)
	_set_mat("BodyPivot/Hips/Torso/PodR", armor_mat)
	_set_mat("BodyPivot/Hips/Torso/HeadPivot/Helmet", armor_mat)
	_set_mat("BodyPivot/Hips/Torso/HeadPivot/VisorBand", visor_mat)
	_set_mat("BodyPivot/Hips/Torso/HeadPivot/Crest", visor_mat)

	for side_name in ["ArmL", "ArmR"]:
		_set_mat("BodyPivot/Hips/Torso/%s/Pauldron" % side_name, armor_mat)
		_set_mat("BodyPivot/Hips/Torso/%s/UpperArm" % side_name, suit_mat)
		_set_mat("BodyPivot/Hips/Torso/%s/Forearm" % side_name, armor_mat)
		_set_mat("BodyPivot/Hips/Torso/%s/CuffGlow" % side_name, visor_mat)

	for leg_name in ["LegL", "LegR"]:
		_set_mat("BodyPivot/Hips/%s/Thigh" % leg_name, suit_mat)
		_set_mat("BodyPivot/Hips/%s/Shin" % leg_name, armor_mat)
		_set_mat("BodyPivot/Hips/%s/SoleGlow" % leg_name, visor_mat)

	if flame_l != null:
		flame_l.material_override = _flame_mat
	if flame_r != null:
		flame_r.material_override = _flame_mat
	if wing_l != null:
		wing_l.material_override = _wing_mat
		wing_l.visible = _base_wing_alpha > 0.02
	if wing_r != null:
		wing_r.material_override = _wing_mat
		wing_r.visible = _base_wing_alpha > 0.02
	if rival_diamond != null:
		rival_diamond.visible = is_rival_runner
	if shield_group != null:
		var dome: MeshInstance3D = shield_group.get_node_or_null("ShieldDome") as MeshInstance3D
		if dome != null:
			dome.material_override = _shield_dome_mat
		shield_group.visible = false


func _set_mat(rel_path: String, mat: Material) -> void:
	var m: MeshInstance3D = get_node_or_null(rel_path) as MeshInstance3D
	if m != null:
		m.material_override = mat


func build_hierarchy() -> void:
	for child in get_children():
		remove_child(child)
		child.free()

	var pal: Dictionary = _get_palette(character_id)
	var suit_mat: StandardMaterial3D = StandardMaterial3D.new()
	suit_mat.albedo_color = pal["suit"]
	suit_mat.metallic = 0.35
	suit_mat.roughness = 0.38

	var armor_mat: StandardMaterial3D = StandardMaterial3D.new()
	armor_mat.albedo_color = pal["armor"]
	armor_mat.metallic = 0.65
	armor_mat.roughness = 0.26

	var dark_joint_mat: StandardMaterial3D = StandardMaterial3D.new()
	dark_joint_mat.albedo_color = Color(0.07, 0.09, 0.14)
	dark_joint_mat.metallic = 0.45
	dark_joint_mat.roughness = 0.45

	var visor_col: Color = pal["visor"]
	var visor_mat: StandardMaterial3D = StandardMaterial3D.new()
	visor_mat.albedo_color = visor_col
	visor_mat.emission_enabled = true
	visor_mat.emission = visor_col
	visor_mat.emission_energy_multiplier = 2.1
	visor_mat.roughness = 0.15

	var thruster_col: Color = pal["thruster"]
	_flame_mat = StandardMaterial3D.new()
	_flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_flame_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_flame_mat.albedo_color = Color(thruster_col.r, thruster_col.g, thruster_col.b, 0.9)

	# Grounded contact shadow disc
	contact_shadow = MeshInstance3D.new()
	contact_shadow.name = "ContactShadow"
	var shadow_cyl: CylinderMesh = CylinderMesh.new()
	shadow_cyl.top_radius = 0.52
	shadow_cyl.bottom_radius = 0.52
	shadow_cyl.height = 0.015
	shadow_cyl.radial_segments = 18
	var shadow_mat: StandardMaterial3D = StandardMaterial3D.new()
	shadow_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shadow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shadow_mat.albedo_color = Color(0.0, 0.0, 0.0, 0.48)
	contact_shadow.mesh = shadow_cyl
	contact_shadow.material_override = shadow_mat
	contact_shadow.position = Vector3(0.0, 0.02, 0.0)
	add_child(contact_shadow)

	body_pivot = Node3D.new()
	body_pivot.name = "BodyPivot"
	add_child(body_pivot)

	hips = Node3D.new()
	hips.name = "Hips"
	hips.position = Vector3(0.0, 0.88, 0.0)
	body_pivot.add_child(hips)

	var pelvis_mesh: MeshInstance3D = _make_box("PelvisMesh", Vector3(0.38, 0.18, 0.24), dark_joint_mat)
	hips.add_child(pelvis_mesh)

	torso = Node3D.new()
	torso.name = "Torso"
	torso.position = Vector3(0.0, 0.08, 0.0)
	hips.add_child(torso)

	var chest_mesh: MeshInstance3D = _make_box("ChestMesh", Vector3(0.46, 0.52, 0.28), suit_mat)
	chest_mesh.position = Vector3(0.0, 0.28, 0.0)
	torso.add_child(chest_mesh)

	var armor_plate: MeshInstance3D = _make_box("ArmorPlate", Vector3(0.50, 0.34, 0.31), armor_mat)
	armor_plate.position = Vector3(0.0, 0.34, 0.0)
	torso.add_child(armor_plate)

	var spine_glow: MeshInstance3D = _make_box("SpineGlow", Vector3(0.08, 0.36, 0.04), visor_mat)
	spine_glow.position = Vector3(0.0, 0.32, 0.165)
	torso.add_child(spine_glow)

	var pack_base: MeshInstance3D = _make_box("PackBase", Vector3(0.34, 0.30, 0.14), dark_joint_mat)
	pack_base.position = Vector3(0.0, 0.33, 0.18)
	torso.add_child(pack_base)

	for idx in range(2):
		var side: float = -1.0 if idx == 0 else 1.0
		var pod: MeshInstance3D = MeshInstance3D.new()
		pod.name = "PodL" if idx == 0 else "PodR"
		var pod_cyl: CylinderMesh = CylinderMesh.new()
		pod_cyl.top_radius = 0.065
		pod_cyl.bottom_radius = 0.08
		pod_cyl.height = 0.28
		pod_cyl.radial_segments = 12
		pod.mesh = pod_cyl
		pod.material_override = armor_mat
		pod.position = Vector3(side * 0.12, 0.31, 0.23)
		pod.rotation.x = 0.22
		torso.add_child(pod)

	var cone_mesh: CylinderMesh = CylinderMesh.new()
	cone_mesh.top_radius = 0.065
	cone_mesh.bottom_radius = 0.008
	cone_mesh.height = 0.34
	cone_mesh.radial_segments = 10

	flame_l = MeshInstance3D.new()
	flame_l.name = "FlameL"
	flame_l.mesh = cone_mesh
	flame_l.material_override = _flame_mat
	flame_l.position = Vector3(-0.12, 0.12, 0.27)
	flame_l.rotation.x = 0.32
	torso.add_child(flame_l)

	flame_r = MeshInstance3D.new()
	flame_r.name = "FlameR"
	flame_r.mesh = cone_mesh
	flame_r.material_override = _flame_mat
	flame_r.position = Vector3(0.12, 0.12, 0.27)
	flame_r.rotation.x = 0.32
	torso.add_child(flame_r)

	_wing_mat = StandardMaterial3D.new()
	_wing_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_wing_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_wing_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_wing_mat.albedo_color = Color(visor_col.r, visor_col.g, visor_col.b, 0.0)

	wing_l = _make_box("WingL", Vector3(0.78, 0.22, 0.03), _wing_mat)
	wing_l.position = Vector3(-0.48, 0.38, 0.22)
	wing_l.rotation = Vector3(0.15, -0.25, 0.28)
	wing_l.visible = false
	torso.add_child(wing_l)

	wing_r = _make_box("WingR", Vector3(0.78, 0.22, 0.03), _wing_mat)
	wing_r.position = Vector3(0.48, 0.38, 0.22)
	wing_r.rotation = Vector3(0.15, 0.25, -0.28)
	wing_r.visible = false
	torso.add_child(wing_r)

	head_pivot = Node3D.new()
	head_pivot.name = "HeadPivot"
	head_pivot.position = Vector3(0.0, 0.60, 0.0)
	torso.add_child(head_pivot)

	var helmet: MeshInstance3D = MeshInstance3D.new()
	helmet.name = "Helmet"
	var head_sphere: SphereMesh = SphereMesh.new()
	head_sphere.radius = 0.19
	head_sphere.height = 0.38
	head_sphere.radial_segments = 16
	head_sphere.rings = 10
	helmet.mesh = head_sphere
	helmet.material_override = armor_mat
	helmet.position = Vector3(0.0, 0.14, 0.0)
	head_pivot.add_child(helmet)

	var visor_band: MeshInstance3D = _make_box("VisorBand", Vector3(0.32, 0.10, 0.26), visor_mat)
	visor_band.position = Vector3(0.0, 0.15, -0.09)
	head_pivot.add_child(visor_band)

	var crest: MeshInstance3D = _make_box("Crest", Vector3(0.06, 0.12, 0.30), visor_mat)
	crest.position = Vector3(0.0, 0.29, 0.02)
	head_pivot.add_child(crest)

	rival_diamond = MeshInstance3D.new()
	rival_diamond.name = "RivalDiamond"
	var d_mesh: SphereMesh = SphereMesh.new()
	d_mesh.radius = 0.11
	d_mesh.height = 0.22
	d_mesh.radial_segments = 4
	d_mesh.rings = 1
	var d_mat: StandardMaterial3D = StandardMaterial3D.new()
	d_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	d_mat.albedo_color = Color(1.0, 0.48, 0.12)
	rival_diamond.mesh = d_mesh
	rival_diamond.material_override = d_mat
	rival_diamond.position = Vector3(0.0, 0.56, 0.0)
	rival_diamond.visible = is_rival_runner
	head_pivot.add_child(rival_diamond)

	arm_l = _build_arm("ArmL", -1.0, suit_mat, armor_mat, visor_mat)
	torso.add_child(arm_l)
	arm_r = _build_arm("ArmR", 1.0, suit_mat, armor_mat, visor_mat)
	torso.add_child(arm_r)

	leg_l = _build_leg("LegL", -1.0, suit_mat, armor_mat, visor_mat, dark_joint_mat)
	hips.add_child(leg_l)
	leg_r = _build_leg("LegR", 1.0, suit_mat, armor_mat, visor_mat, dark_joint_mat)
	hips.add_child(leg_r)

	_create_shield_group_nodes()


func _create_shield_group_nodes() -> void:
	shield_group = Node3D.new()
	shield_group.name = "ShieldGroup"
	shield_group.position = Vector3(0.0, 1.05, 0.0)
	shield_group.visible = false
	add_child(shield_group)

	_shield_dome_mat = StandardMaterial3D.new()
	_shield_dome_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_shield_dome_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_shield_dome_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_shield_dome_mat.albedo_color = Color(0.12, 0.88, 1.0, 0.22)

	var dome_inst: MeshInstance3D = MeshInstance3D.new()
	dome_inst.name = "ShieldDome"
	var dome_sphere: SphereMesh = SphereMesh.new()
	dome_sphere.radius = 1.12
	dome_sphere.height = 2.24
	dome_sphere.radial_segments = 18
	dome_sphere.rings = 10
	dome_inst.mesh = dome_sphere
	dome_inst.material_override = _shield_dome_mat
	shield_group.add_child(dome_inst)

	var ring_mat: StandardMaterial3D = StandardMaterial3D.new()
	ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring_mat.albedo_color = Color(0.28, 0.95, 1.0, 0.72)

	var ring_torus: TorusMesh = TorusMesh.new()
	ring_torus.inner_radius = 1.14
	ring_torus.outer_radius = 1.20
	ring_torus.rings = 24
	ring_torus.ring_segments = 8

	shield_ring_a = MeshInstance3D.new()
	shield_ring_a.name = "ShieldRingA"
	shield_ring_a.mesh = ring_torus
	shield_ring_a.material_override = ring_mat
	shield_ring_a.rotation.x = 0.55
	shield_group.add_child(shield_ring_a)

	shield_ring_b = MeshInstance3D.new()
	shield_ring_b.name = "ShieldRingB"
	shield_ring_b.mesh = ring_torus
	shield_ring_b.material_override = ring_mat
	shield_ring_b.rotation.z = 0.65
	shield_group.add_child(shield_ring_b)


func _build_arm(node_name: String, side: float, suit_mat: Material, armor_mat: Material, glow_mat: Material) -> Node3D:
	var pivot: Node3D = Node3D.new()
	pivot.name = node_name
	pivot.position = Vector3(side * 0.31, 0.50, 0.0)

	var pauldron: MeshInstance3D = _make_box("Pauldron", Vector3(0.18, 0.16, 0.20), armor_mat)
	pauldron.position = Vector3(side * 0.03, 0.02, 0.0)
	pivot.add_child(pauldron)

	var upper: MeshInstance3D = _make_box("UpperArm", Vector3(0.13, 0.28, 0.13), suit_mat)
	upper.position = Vector3(side * 0.02, -0.15, 0.0)
	pivot.add_child(upper)

	var forearm: MeshInstance3D = _make_box("Forearm", Vector3(0.12, 0.28, 0.12), armor_mat)
	forearm.position = Vector3(side * 0.02, -0.40, -0.04)
	forearm.rotation.x = 0.35
	pivot.add_child(forearm)

	var cuff: MeshInstance3D = _make_box("CuffGlow", Vector3(0.14, 0.06, 0.14), glow_mat)
	cuff.position = Vector3(side * 0.02, -0.46, -0.06)
	pivot.add_child(cuff)

	return pivot


func _build_leg(node_name: String, side: float, suit_mat: Material, armor_mat: Material, glow_mat: Material, boot_mat: Material) -> Node3D:
	var pivot: Node3D = Node3D.new()
	pivot.name = node_name
	pivot.position = Vector3(side * 0.14, -0.04, 0.0)

	var thigh: MeshInstance3D = _make_box("Thigh", Vector3(0.16, 0.38, 0.17), suit_mat)
	thigh.position = Vector3(0.0, -0.20, 0.0)
	pivot.add_child(thigh)

	var shin: MeshInstance3D = _make_box("Shin", Vector3(0.14, 0.38, 0.15), armor_mat)
	shin.position = Vector3(0.0, -0.56, 0.02)
	pivot.add_child(shin)

	var boot: MeshInstance3D = _make_box("Boot", Vector3(0.16, 0.12, 0.26), boot_mat)
	boot.position = Vector3(0.0, -0.78, -0.03)
	pivot.add_child(boot)

	var sole_glow: MeshInstance3D = _make_box("SoleGlow", Vector3(0.165, 0.035, 0.27), glow_mat)
	sole_glow.position = Vector3(0.0, -0.83, -0.03)
	pivot.add_child(sole_glow)

	return pivot


func _make_box(node_name: String, sz: Vector3, mat: Material) -> MeshInstance3D:
	var inst: MeshInstance3D = MeshInstance3D.new()
	inst.name = node_name
	var b: BoxMesh = BoxMesh.new()
	b.size = sz
	inst.mesh = b
	inst.material_override = mat
	return inst


func reset_upright() -> void:
	rotation = Vector3.ZERO
	if body_pivot:
		body_pivot.rotation = Vector3.ZERO
		body_pivot.position = Vector3.ZERO
	if custom_model:
		custom_model.position = Vector3(custom_model.position.x, _custom_model_base_y, custom_model.position.z)
		custom_model.rotation = _custom_model_base_rot


func _resolve_anim_name(candidates: Array[String], fallback_first: bool = false) -> String:
	if custom_anim == null:
		return ""
	var anim_list: PackedStringArray = custom_anim.get_animation_list()
	if anim_list.size() == 0:
		return ""
	for cand in candidates:
		var lc: String = cand.to_lower()
		for existing in anim_list:
			if existing.to_lower() == lc:
				return existing
	for cand in candidates:
		var lc2: String = cand.to_lower()
		for existing in anim_list:
			if existing.to_lower().find(lc2) != -1:
				return existing
	if fallback_first:
		for existing in anim_list:
			if existing != "RESET":
				return existing
	return ""


func _play_custom_anim_state(state_name: String, candidates: Array[String], speed_scale_val: float, fallback_first: bool = false) -> void:
	if custom_anim == null:
		return
	custom_anim.speed_scale = speed_scale_val
	if _active_anim_state == state_name and custom_anim.is_playing():
		return
	var clip: String = _resolve_anim_name(candidates, fallback_first)
	if clip != "":
		_active_anim_state = state_name
		custom_anim.play(clip, 0.15)


func _update_shield_fx(time_sec: float, center_y: float, shield_timer: float) -> void:
	if shield_group == null:
		return
	if shield_timer > 0.01:
		shield_group.visible = true
		shield_group.position.y = center_y
		if shield_ring_a != null:
			shield_ring_a.rotation.y = time_sec * 4.2
			shield_ring_a.rotation.x = 0.55 + sin(time_sec * 3.0) * 0.2
		if shield_ring_b != null:
			shield_ring_b.rotation.y = -time_sec * 3.6
			shield_ring_b.rotation.z = 0.65 + cos(time_sec * 2.7) * 0.2
		if _shield_dome_mat != null:
			var pulse_alpha: float = 0.20 + 0.06 * sin(time_sec * 10.0)
			if shield_timer < 0.85:
				pulse_alpha *= 0.45 + 0.55 * absf(sin(time_sec * 22.0))
			_shield_dome_mat.albedo_color.a = pulse_alpha
	else:
		shield_group.visible = false


func _update_custom_model_pose(
	time_sec: float,
	speed_kph: float,
	is_jumping: bool,
	is_sliding: bool,
	jump_progress: float,
	fly_blend: float,
	shield_timer: float
) -> void:
	if custom_model == null:
		return

	if speed_kph <= 0.1 and not is_jumping and not is_sliding and fly_blend <= 0.05:
		custom_model.position.y = _custom_model_base_y + sin(time_sec * 2.4) * 0.02
		custom_model.rotation = _custom_model_base_rot
		_play_custom_anim_state("IDLE", ["idle", "stand", "breathe"], 1.0, true)
		if contact_shadow != null:
			contact_shadow.scale = Vector3.ONE
		_update_shield_fx(time_sec, 1.0, 0.0)
		return

	var jump_height: float = 0.0
	if is_jumping:
		jump_height = pow(sin(clampf(jump_progress, 0.0, 1.0) * PI), 0.68) * 2.35
	var fly_altitude: float = fly_blend * (2.65 + sin(time_sec * 6.5) * 0.12)
	var run_speed_scale: float = clampf(speed_kph / 48.0, 0.85, 2.2)

	if fly_blend > 0.08:
		var elev_f: float = lerpf(jump_height, fly_altitude, fly_blend)
		custom_model.position.y = _custom_model_base_y + elev_f
		custom_model.rotation = _custom_model_base_rot + Vector3(lerpf(0.0, -0.55, fly_blend), 0.0, 0.0)
		_play_custom_anim_state("FLY", ["fly", "glide", "hover", "jump", "run"], 1.15, true)
	elif is_sliding:
		custom_model.position.y = _custom_model_base_y
		custom_model.rotation = _custom_model_base_rot
		_play_custom_anim_state("SLIDE", ["slide", "roll", "duck", "crouch", "run"], 1.35, true)
	elif is_jumping:
		custom_model.position.y = _custom_model_base_y + jump_height
		custom_model.rotation = _custom_model_base_rot
		_play_custom_anim_state("JUMP", ["jump", "leap", "air", "run"], 1.1, true)
	else:
		var bob: float = absf(cos(time_sec * clampf(speed_kph / 4.2, 8.0, 22.0))) * 0.04
		custom_model.position.y = _custom_model_base_y + bob
		custom_model.rotation = _custom_model_base_rot
		_play_custom_anim_state("RUN", ["run", "sprint", "jog", "walk"], run_speed_scale, true)

	var elevation: float = maxf(0.0, custom_model.position.y - _custom_model_base_y)
	if contact_shadow != null:
		var shadow_scale: float = clampf(1.0 - elevation * 0.22, 0.28, 1.0)
		contact_shadow.scale = Vector3(shadow_scale, 1.0, shadow_scale)

	if rival_diamond != null:
		rival_diamond.visible = is_rival_runner
		rival_diamond.position.y = 2.15 + elevation

	_update_shield_fx(time_sec, 1.0 + elevation, shield_timer)


func update_pose(
	time_sec: float,
	speed_kph: float,
	is_jumping: bool,
	is_sliding: bool,
	jump_progress: float,
	fly_blend: float,
	shield_timer: float,
	fly_timer: float
) -> void:
	if hips == null:
		if custom_model != null:
			_update_custom_model_pose(time_sec, speed_kph, is_jumping, is_sliding, jump_progress, fly_blend, shield_timer)
		return

	if speed_kph <= 0.1 and not is_jumping and not is_sliding and fly_blend <= 0.05:
		# Idle breathing stance (used in Runner Locker IDLE preview)
		var breath: float = sin(time_sec * 2.4) * 0.025
		hips.position.y = 0.88 + breath
		torso.rotation = Vector3(0.02, sin(time_sec * 1.2) * 0.05, 0.0)
		head_pivot.rotation.x = -0.02
		leg_l.rotation.x = -0.04
		leg_r.rotation.x = 0.04
		arm_l.rotation = Vector3(0.06, 0.0, 0.10)
		arm_r.rotation = Vector3(-0.06, 0.0, -0.10)
		if contact_shadow != null:
			contact_shadow.scale = Vector3.ONE
		if flame_l != null:
			flame_l.scale = Vector3(0.8, 0.45 + 0.1 * sin(time_sec * 18.0), 0.8)
		if flame_r != null:
			flame_r.scale = Vector3(0.8, 0.45 + 0.1 * cos(time_sec * 18.0), 0.8)
		if wing_l != null and wing_r != null:
			var show_w: bool = _base_wing_alpha > 0.02
			wing_l.visible = show_w
			wing_r.visible = show_w
			if show_w and _wing_mat != null:
				_wing_mat.albedo_color.a = _base_wing_alpha
		_update_shield_fx(time_sec, 1.0, 0.0)
		return

	var cycle_speed: float = clampf(speed_kph / 4.2, 8.0, 22.0)
	var phase: float = time_sec * cycle_speed
	var stride: float = sin(phase)
	var bounce: float = absf(cos(phase))

	var jump_height: float = 0.0
	if is_jumping:
		jump_height = pow(sin(clampf(jump_progress, 0.0, 1.0) * PI), 0.68) * 2.35

	var fly_altitude: float = fly_blend * (2.65 + sin(time_sec * 6.5) * 0.12)

	if fly_blend > 0.08:
		hips.position.y = lerpf(0.88 + jump_height, 0.88 + fly_altitude, fly_blend)
		torso.rotation.x = lerpf(-0.24, -1.08, fly_blend)
		torso.rotation.y = 0.0
		head_pivot.rotation.x = lerpf(0.12, 0.72, fly_blend)
		leg_l.rotation.x = lerpf(stride * 0.75, 0.38 + sin(time_sec * 9.0) * 0.06, fly_blend)
		leg_r.rotation.x = lerpf(-stride * 0.75, 0.44 - sin(time_sec * 9.0) * 0.06, fly_blend)
		arm_l.rotation.x = lerpf(-stride * 0.7, 0.55, fly_blend)
		arm_r.rotation.x = lerpf(stride * 0.7, 0.55, fly_blend)
		arm_l.rotation.z = lerpf(0.08, 0.35, fly_blend)
		arm_r.rotation.z = lerpf(-0.08, -0.35, fly_blend)
	elif is_sliding:
		hips.position.y = 0.38
		torso.rotation.x = 0.88
		torso.rotation.y = 0.0
		head_pivot.rotation.x = -0.45
		leg_l.rotation.x = -1.15
		leg_r.rotation.x = -0.55
		arm_l.rotation.x = 0.65
		arm_r.rotation.x = 0.65
		arm_l.rotation.z = 0.25
		arm_r.rotation.z = -0.25
	elif is_jumping:
		hips.position.y = 0.88 + jump_height
		torso.rotation.x = -0.32
		torso.rotation.y = 0.0
		head_pivot.rotation.x = 0.18
		leg_l.rotation.x = -0.65
		leg_r.rotation.x = 0.35
		arm_l.rotation.x = -0.85
		arm_r.rotation.x = -0.45
		arm_l.rotation.z = 0.18
		arm_r.rotation.z = -0.18
	else:
		hips.position.y = 0.86 + bounce * 0.09
		torso.rotation.x = -0.22
		torso.rotation.y = stride * 0.10
		head_pivot.rotation.x = 0.16
		leg_l.rotation.x = stride * 0.85
		leg_r.rotation.x = -stride * 0.85
		arm_l.rotation.x = -stride * 0.80
		arm_r.rotation.x = stride * 0.80
		arm_l.rotation.z = 0.08
		arm_r.rotation.z = -0.08

	if contact_shadow != null:
		var elevation: float = maxf(0.0, hips.position.y - 0.86)
		var shadow_scale: float = clampf(1.0 - elevation * 0.22, 0.28, 1.0)
		contact_shadow.scale = Vector3(shadow_scale, 1.0, shadow_scale)

	var thruster_boost: float = 1.0 + fly_blend * 1.45 + (0.35 if is_jumping else 0.0)
	var flicker: float = (0.85 + 0.30 * sin(time_sec * 42.0)) * thruster_boost
	if flame_l != null:
		flame_l.scale = Vector3(1.0 + fly_blend * 0.4, flicker, 1.0 + fly_blend * 0.4)
	if flame_r != null:
		flame_r.scale = Vector3(1.0 + fly_blend * 0.4, flicker * 0.96, 1.0 + fly_blend * 0.4)

	if wing_l != null and wing_r != null:
		if fly_blend > 0.03 or _base_wing_alpha > 0.02:
			wing_l.visible = true
			wing_r.visible = true
			var wing_span: float = 1.0 + fly_blend * 0.85
			wing_l.scale = Vector3(wing_span, 1.0 + fly_blend * 0.35, 1.0)
			wing_r.scale = Vector3(wing_span, 1.0 + fly_blend * 0.35, 1.0)
			if _wing_mat != null:
				if fly_timer > 0.0 or fly_blend > 0.1:
					_wing_mat.albedo_color = Color(1.0, 0.78, 0.18, clampf(0.25 + fly_blend * 0.68, 0.0, 0.92))
				else:
					_wing_mat.albedo_color.a = _base_wing_alpha
		else:
			wing_l.visible = false
			wing_r.visible = false

	_update_shield_fx(time_sec, hips.position.y + 0.12, shield_timer)
