#include "device_config_cache.h"

#include <cctype>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <utility>

namespace esphome {
namespace radar_api_server {

const std::string DeviceConfigCache::EMPTY_{};

namespace {

float distance_to_segment_(float px, float py, float ax, float ay, float bx, float by) {
  const float vx = bx - ax;
  const float vy = by - ay;
  const float wx = px - ax;
  const float wy = py - ay;
  const float len2 = vx * vx + vy * vy;
  if (len2 <= 0.0001f)
    return std::sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));

  float t = (wx * vx + wy * vy) / len2;
  if (t < 0.0f)
    t = 0.0f;
  else if (t > 1.0f)
    t = 1.0f;

  const float cx = ax + t * vx;
  const float cy = ay + t * vy;
  return std::sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

}  // namespace

void DeviceConfigCache::update(std::string json) {
  this->has_config_ = !json.empty();
  this->raw_config_ = std::move(json);
  this->refresh_zone_cache_();
}

void DeviceConfigCache::clear() {
  this->raw_config_.clear();
  this->has_config_ = false;
  this->tracker_assist_presence_enabled_ = true;
  this->legacy_presence_fallback_enabled_ = false;
  for (auto &zone : this->software_zones_)
    zone.clear();
  for (auto &zone : this->calibration_zones_)
    zone.clear();
  this->floorplan_room_ = {};
}

const std::string &DeviceConfigCache::software_zone_config(int zone_index) const {
  if (zone_index < 1 || zone_index > static_cast<int>(this->software_zones_.size()))
    return EMPTY_;
  return this->software_zones_[zone_index - 1];
}

const std::string &DeviceConfigCache::calibration_zone_config(int zone_index) const {
  if (zone_index < 1 || zone_index > static_cast<int>(this->calibration_zones_.size()))
    return EMPTY_;
  return this->calibration_zones_[zone_index - 1];
}

void DeviceConfigCache::refresh_zone_cache_() {
  this->legacy_presence_fallback_enabled_ = extract_bool_(this->raw_config_, "legacyPresenceFallback", false);
  this->tracker_assist_presence_enabled_ = !this->legacy_presence_fallback_enabled_;
  for (int index = 1; index <= static_cast<int>(this->software_zones_.size()); index++) {
    this->software_zones_[index - 1] = extract_object_by_id_(this->raw_config_, "zone_" + std::to_string(index));
  }
  for (int index = 1; index <= static_cast<int>(this->calibration_zones_.size()); index++) {
    this->calibration_zones_[index - 1] =
        extract_object_by_id_(this->raw_config_, "calibration_" + std::to_string(index));
  }
  this->refresh_floorplan_room_cache_();
}

void DeviceConfigCache::refresh_floorplan_room_cache_() {
  this->floorplan_room_ = {};
  const std::string floorplan = extract_object_by_key_(this->raw_config_, "floorplan");
  if (floorplan.empty())
    return;
  const std::string room = extract_object_by_key_(floorplan, "room");
  if (room.empty())
    return;

  this->floorplan_room_.id = extract_string_(room, "id");
  this->floorplan_room_.name = extract_string_(room, "name");
  this->floorplan_room_.boundary_point_count =
      extract_boundary_points_(room, this->floorplan_room_.boundary_x, this->floorplan_room_.boundary_y);
  this->floorplan_room_.configured =
      !this->floorplan_room_.id.empty() || !this->floorplan_room_.name.empty() ||
      this->floorplan_room_.boundary_point_count >= 3;
}

bool DeviceConfigCache::point_in_floorplan_room(float x, float y) const {
  const auto &room = this->floorplan_room_;
  if (room.boundary_point_count < 3)
    return false;

  bool inside = false;
  for (int i = 0, j = room.boundary_point_count - 1; i < room.boundary_point_count; j = i++) {
    const bool intersects = ((room.boundary_y[i] > y) != (room.boundary_y[j] > y)) &&
                            (x < (room.boundary_x[j] - room.boundary_x[i]) * (y - room.boundary_y[i]) /
                                      ((room.boundary_y[j] - room.boundary_y[i]) == 0 ? 0.0001f
                                                                                      : (room.boundary_y[j] - room.boundary_y[i])) +
                                      room.boundary_x[i]);
    if (intersects)
      inside = !inside;
  }
  return inside;
}

float DeviceConfigCache::floorplan_room_signed_distance(float x, float y) const {
  const auto &room = this->floorplan_room_;
  if (room.boundary_point_count < 3)
    return 0.0f;

  float min_distance = std::numeric_limits<float>::max();
  for (int i = 0; i < room.boundary_point_count; i++) {
    const int next = (i + 1) % room.boundary_point_count;
    const float distance = distance_to_segment_(x, y, room.boundary_x[i], room.boundary_y[i],
                                                room.boundary_x[next], room.boundary_y[next]);
    if (distance < min_distance)
      min_distance = distance;
  }

  if (min_distance == std::numeric_limits<float>::max())
    return 0.0f;
  return this->point_in_floorplan_room(x, y) ? min_distance : -min_distance;
}

bool DeviceConfigCache::extract_bool_(const std::string &json, const std::string &key, bool fallback) {
  const std::string needle = "\"" + key + "\"";
  const size_t key_pos = json.find(needle);
  if (key_pos == std::string::npos)
    return fallback;

  const size_t colon_pos = json.find(':', key_pos + needle.size());
  if (colon_pos == std::string::npos)
    return fallback;

  size_t value_pos = colon_pos + 1;
  while (value_pos < json.size() && std::isspace(static_cast<unsigned char>(json[value_pos])))
    value_pos++;

  if (json.compare(value_pos, 4, "true") == 0)
    return true;
  if (json.compare(value_pos, 5, "false") == 0)
    return false;
  return fallback;
}

std::string DeviceConfigCache::extract_object_by_id_(const std::string &json, const std::string &id) {
  const std::string needle = "\"id\":\"" + id + "\"";
  const size_t id_pos = json.find(needle);
  if (id_pos == std::string::npos)
    return "";

  const size_t object_start = json.rfind('{', id_pos);
  if (object_start == std::string::npos)
    return "";

  bool in_string = false;
  bool escaped = false;
  int depth = 0;
  for (size_t pos = object_start; pos < json.size(); pos++) {
    const char current = json[pos];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (current == '\\' && in_string) {
      escaped = true;
      continue;
    }
    if (current == '"') {
      in_string = !in_string;
      continue;
    }
    if (in_string)
      continue;

    if (current == '{') {
      depth++;
    } else if (current == '}') {
      depth--;
      if (depth == 0)
        return json.substr(object_start, pos - object_start + 1);
      if (depth < 0)
        return "";
    }
  }

  return "";
}

std::string DeviceConfigCache::extract_object_by_key_(const std::string &json, const std::string &key) {
  const std::string needle = "\"" + key + "\"";
  const size_t key_pos = json.find(needle);
  if (key_pos == std::string::npos)
    return "";
  const size_t colon_pos = json.find(':', key_pos + needle.size());
  if (colon_pos == std::string::npos)
    return "";
  const size_t object_start = json.find('{', colon_pos + 1);
  if (object_start == std::string::npos)
    return "";

  bool in_string = false;
  bool escaped = false;
  int depth = 0;
  for (size_t pos = object_start; pos < json.size(); pos++) {
    const char current = json[pos];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (current == '\\' && in_string) {
      escaped = true;
      continue;
    }
    if (current == '"') {
      in_string = !in_string;
      continue;
    }
    if (in_string)
      continue;

    if (current == '{') {
      depth++;
    } else if (current == '}') {
      depth--;
      if (depth == 0)
        return json.substr(object_start, pos - object_start + 1);
      if (depth < 0)
        return "";
    }
  }
  return "";
}

std::string DeviceConfigCache::extract_string_(const std::string &json, const std::string &key) {
  const std::string needle = "\"" + key + "\"";
  const size_t key_pos = json.find(needle);
  if (key_pos == std::string::npos)
    return "";
  const size_t colon_pos = json.find(':', key_pos + needle.size());
  if (colon_pos == std::string::npos)
    return "";
  size_t value_start = json.find('"', colon_pos + 1);
  if (value_start == std::string::npos)
    return "";
  value_start++;

  bool escaped = false;
  for (size_t pos = value_start; pos < json.size(); pos++) {
    const char current = json[pos];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (current == '\\') {
      escaped = true;
      continue;
    }
    if (current == '"')
      return json.substr(value_start, pos - value_start);
  }
  return "";
}

int DeviceConfigCache::extract_boundary_points_(const std::string &json,
                                                float xs[MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS],
                                                float ys[MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS]) {
  const size_t key_pos = json.find("\"boundary\"");
  if (key_pos == std::string::npos)
    return 0;
  const size_t end = json.size();
  size_t pos = json.find('[', key_pos);
  if (pos == std::string::npos || pos >= end)
    return 0;

  auto read_number = [&](size_t &cursor, float &value) -> bool {
    while (cursor < end && !(json[cursor] == '-' || json[cursor] == '+' ||
                             (json[cursor] >= '0' && json[cursor] <= '9')))
      cursor++;
    if (cursor >= end)
      return false;
    char *number_end = nullptr;
    value = std::strtof(json.c_str() + cursor, &number_end);
    if (number_end == json.c_str() + cursor)
      return false;
    cursor = static_cast<size_t>(number_end - json.c_str());
    return true;
  };

  int point_count = 0;
  while (pos < end && point_count < MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS) {
    float x = 0.0f;
    float y = 0.0f;
    if (!read_number(pos, x))
      break;
    if (!read_number(pos, y))
      break;
    xs[point_count] = x;
    ys[point_count] = y;
    point_count++;

    const size_t next = json.find('[', pos);
    const size_t boundary_close = json.find("]]", pos);
    if (next == std::string::npos || (boundary_close != std::string::npos && boundary_close < next) || next >= end)
      break;
    pos = next;
  }
  return point_count;
}

}  // namespace radar_api_server
}  // namespace esphome
