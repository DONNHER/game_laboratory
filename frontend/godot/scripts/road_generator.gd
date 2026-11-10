class_name RoadGeneratorGD
extends RefCounted

# Standalone procedural track generator used when running the Godot 4.7 project directly.
var _rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _obs_counter: int = 0


func generate_track(
	seed_val: int,
	goal_distance: float,
	interval: float,
	allowed_traps: Array,
	milestones: Array
) -> Array:
	_rng.seed = int(seed_val)
	_obs_counter = 0

	var results: Array = []
	var all_lanes: Array = [-1, 0, 1]
	var cur_dist: float = _rng.randf_range(18.0, 28.0)
	var next_gem_dist: float = _rng.randf_range(40.0, 92.0)
	var last_gem_type: String = "SHIELD_GEM" if _rng.randf() < 0.5 else "FLY_GEM"

	# Opening coins
	var intro_lane: int = int(all_lanes[_rng.randi_range(0, 2)])
	for i in range(3):
		var cd: float = 9.5 + float(i) * 3.0
		if cd < cur_dist - 3.5:
			_obs_counter += 1
			results.append({
				"id": "coin_%d" % _obs_counter,
				"type": "COIN",
				"distance": snappedf(cd, 0.1),
				"lane": intro_lane
			})

	var target_end: float = goal_distance + 90.0
	while cur_dist < target_end:
		if _near_milestone(cur_dist, milestones, 8.5):
			for l in all_lanes:
				_obs_counter += 1
				results.append({
					"id": "coin_%d" % _obs_counter,
					"type": "COIN",
					"distance": snappedf(cur_dist, 0.1),
					"lane": int(l)
				})
			cur_dist += maxf(21.0, interval * _rng.randf_range(0.85, 1.15))
			continue

		var trap_type: String = "WALL"
		if allowed_traps.size() > 0:
			trap_type = String(allowed_traps[_rng.randi_range(0, allowed_traps.size() - 1)])

		var primary_lane: int = int(all_lanes[_rng.randi_range(0, 2)])
		var safe_lanes: Array = []
		for l in all_lanes:
			if int(l) != primary_lane:
				safe_lanes.append(int(l))

		if trap_type == "NARROW_GAP":
			var open_lane: int = primary_lane
			safe_lanes = [open_lane]
			for l in all_lanes:
				if int(l) != open_lane:
					_obs_counter += 1
					results.append({
						"id": "obs_%d" % _obs_counter,
						"type": "WALL",
						"distance": snappedf(cur_dist, 0.1),
						"lane": int(l)
					})
		elif trap_type == "MOVING_BLOCK":
			_obs_counter += 1
			results.append({
				"id": "obs_%d" % _obs_counter,
				"type": "MOVING_BLOCK",
				"distance": snappedf(cur_dist, 0.1),
				"lane": primary_lane,
				"moveSpeed": _rng.randf_range(1.3, 2.3),
				"phase": _rng.randf_range(0.0, TAU)
			})
		else:
			_obs_counter += 1
			results.append({
				"id": "obs_%d" % _obs_counter,
				"type": trap_type,
				"distance": snappedf(cur_dist, 0.1),
				"lane": primary_lane
			})

		var step_span: float = maxf(20.0, interval * _rng.randf_range(0.82, 1.32))

		if cur_dist >= next_gem_dist and safe_lanes.size() > 0:
			last_gem_type = "FLY_GEM" if last_gem_type == "SHIELD_GEM" else ("SHIELD_GEM" if _rng.randf() < 0.65 else "FLY_GEM")
			var gem_lane: int = int(safe_lanes[_rng.randi_range(0, safe_lanes.size() - 1)])
			var gem_dist: float = cur_dist + _rng.randf_range(6.0, maxf(7.5, step_span * 0.45))
			if not _near_milestone(gem_dist, milestones, 6.5):
				_obs_counter += 1
				results.append({
					"id": "gem_%d" % _obs_counter,
					"type": last_gem_type,
					"distance": snappedf(gem_dist, 0.1),
					"lane": gem_lane
				})
				next_gem_dist = gem_dist + _rng.randf_range(58.0, 130.0)
		elif _rng.randf() < 0.72 and safe_lanes.size() > 0:
			var coin_lane: int = int(safe_lanes[_rng.randi_range(0, safe_lanes.size() - 1)])
			var coin_count: int = _rng.randi_range(2, 4)
			var base_c: float = cur_dist + _rng.randf_range(-2.0, 4.5)
			for c_idx in range(coin_count):
				var cd2: float = base_c + float(c_idx) * 3.2
				if not _near_milestone(cd2, milestones, 4.0):
					_obs_counter += 1
					results.append({
						"id": "coin_%d" % _obs_counter,
						"type": "COIN",
						"distance": snappedf(cd2, 0.1),
						"lane": coin_lane
					})

		cur_dist += step_span

	return results


func _near_milestone(dist: float, milestones: Array, margin: float) -> bool:
	for item in milestones:
		if typeof(item) == TYPE_DICTIONARY:
			var d: Dictionary = item
			var md: float = float(d.get("distance", -999.0))
			if absf(dist - md) <= margin:
				return true
	return false
