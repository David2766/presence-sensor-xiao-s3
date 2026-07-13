#include "software_zone_evidence.h"

#include <cstdlib>
#include <string>

namespace esphome {
namespace radar_api_server {

namespace {

float clamp_zone_value(float value, float min_value, float max_value) {
  if (value < min_value)
    return min_value;
  if (value > max_value)
    return max_value;
  return value;
}

bool zone_config_valid(const std::string &value, int zone_index) {
  const std::string needle = std::string("\"id\":\"zone_") + std::to_string(zone_index) + "\"";
  return !value.empty() && value != "__EMPTY__" && value.find(needle) != std::string::npos &&
         value.find("\"points\"") != std::string::npos;
}

bool zone_type_is(const std::string &zone_config, const char *type) {
  const std::string needle = std::string("\"type\":\"") + type + "\"";
  return zone_config.find(needle) != std::string::npos;
}

bool point_in_zone_config(const std::string &zone_config, float tx, float ty) {
  const size_t end = zone_config.size();
  size_t points_pos = zone_config.find("\"points\"");
  if (points_pos == std::string::npos || points_pos >= end)
    return false;

  float xs[8];
  float ys[8];
  int point_count = 0;
  size_t pos = zone_config.find('[', points_pos);
  if (pos == std::string::npos || pos >= end)
    return false;

  auto read_number = [&](size_t &cursor, float &value) -> bool {
    while (cursor < end && !(zone_config[cursor] == '-' || (zone_config[cursor] >= '0' && zone_config[cursor] <= '9')))
      cursor++;
    if (cursor >= end)
      return false;
    const size_t number_start = cursor;
    if (zone_config[cursor] == '-')
      cursor++;
    while (cursor < end && zone_config[cursor] >= '0' && zone_config[cursor] <= '9')
      cursor++;
    value = std::atof(zone_config.substr(number_start, cursor - number_start).c_str());
    return true;
  };

  while (pos < end && point_count < 8) {
    float x = 0;
    float y = 0;
    if (!read_number(pos, x))
      break;
    if (!read_number(pos, y))
      break;
    xs[point_count] = clamp_zone_value(x, -4860.0f, 4860.0f);
    ys[point_count] = clamp_zone_value(y, 0.0f, 7560.0f);
    point_count++;
    size_t next = zone_config.find('[', pos);
    size_t zone_close = zone_config.find("]]", pos);
    if (next == std::string::npos || (zone_close != std::string::npos && zone_close < next) || next >= end)
      break;
    pos = next;
  }

  if (point_count < 3)
    return false;
  bool inside = false;
  for (int i = 0, j = point_count - 1; i < point_count; j = i++) {
    const bool intersects = ((ys[i] > ty) != (ys[j] > ty)) &&
                            (tx < (xs[j] - xs[i]) * (ty - ys[i]) /
                                      ((ys[j] - ys[i]) == 0 ? 0.0001f : (ys[j] - ys[i])) +
                                      xs[i]);
    if (intersects)
      inside = !inside;
  }
  return inside;
}

}  // namespace

SoftwareZoneEvidence compute_software_zone_evidence(const DeviceConfigCache &config_cache, uint32_t now_ms,
                                                    const SoftwareZoneTarget targets[3],
                                                    uint32_t *exit_zone_last_seen_ms) {
  SoftwareZoneEvidence evidence;
  int target_exit_masks[3] = {0, 0, 0};

  for (int zone_index = 1; zone_index <= 6; zone_index++) {
    const std::string zone_config = config_cache.software_zone_config(zone_index);
    if (!zone_config_valid(zone_config, zone_index))
      continue;

    evidence.configured = true;
    const int zone_bit = 1 << (zone_index - 1);
    if (zone_type_is(zone_config, "detection")) {
      evidence.detection_zone_count++;
      for (int target_index = 0; target_index < 3; target_index++) {
        if (targets[target_index].valid && point_in_zone_config(zone_config, targets[target_index].x, targets[target_index].y)) {
          evidence.detection_zone_counts[zone_index - 1]++;
          evidence.state_zone_counts[zone_index - 1]++;
          evidence.target_software_masks[target_index] |= zone_bit;
        }
      }
    } else if (zone_type_is(zone_config, "filter")) {
      evidence.filter_zone_count++;
    } else if (zone_type_is(zone_config, "exit")) {
      evidence.exit_zone_count++;
      for (int target_index = 0; target_index < 3; target_index++) {
        if (targets[target_index].valid && point_in_zone_config(zone_config, targets[target_index].x, targets[target_index].y)) {
          evidence.state_zone_counts[zone_index - 1]++;
          target_exit_masks[target_index] |= zone_bit;
        }
      }
    }
  }

  evidence.target_exit_masks[0] = target_exit_masks[0];
  evidence.target_exit_masks[1] = target_exit_masks[1];
  evidence.target_exit_masks[2] = target_exit_masks[2];
  evidence.exit_zone_mask = target_exit_masks[0] | target_exit_masks[1] | target_exit_masks[2];
  evidence.exit_target_count = (target_exit_masks[0] != 0 ? 1 : 0) + (target_exit_masks[1] != 0 ? 1 : 0) +
                               (target_exit_masks[2] != 0 ? 1 : 0);
  evidence.exit_zone_active = evidence.exit_target_count > 0;
  if (exit_zone_last_seen_ms != nullptr) {
    if (evidence.exit_zone_active)
      *exit_zone_last_seen_ms = now_ms;
    evidence.exit_last_seen_age_ms =
        *exit_zone_last_seen_ms == 0 ? -1 : static_cast<int>(now_ms - *exit_zone_last_seen_ms);
  }

  const auto &room = config_cache.floorplan_room();
  evidence.room_context_configured = room.configured;
  evidence.room_boundary_point_count = room.boundary_point_count;
  if (room.boundary_point_count >= 3) {
    for (int target_index = 0; target_index < 3; target_index++) {
      if (!targets[target_index].valid)
        continue;
      evidence.target_room_signed_distances[target_index] =
          config_cache.floorplan_room_signed_distance(targets[target_index].x, targets[target_index].y);
      if (config_cache.point_in_floorplan_room(targets[target_index].x, targets[target_index].y)) {
        evidence.target_room_inside[target_index] = true;
        evidence.room_target_inside_count++;
      } else {
        evidence.target_room_outside[target_index] = true;
        evidence.room_target_outside_count++;
      }
    }
  }

  return evidence;
}

}  // namespace radar_api_server
}  // namespace esphome
