#pragma once

#include <array>
#include <string>

namespace esphome {
namespace radar_api_server {

static constexpr int MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS = 18;

struct FloorplanRoomContext {
  bool configured{false};
  std::string id{};
  std::string name{};
  int boundary_point_count{0};
  float boundary_x[MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS]{};
  float boundary_y[MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS]{};
};

class DeviceConfigCache {
 public:
  void update(std::string json);
  void clear();

  bool has_config() const { return this->has_config_; }
  const std::string &raw_config() const { return this->raw_config_; }
  const std::string &software_zone_config(int zone_index) const;
  const std::string &calibration_zone_config(int zone_index) const;
  bool tracker_assist_presence_enabled() const { return this->tracker_assist_presence_enabled_; }
  bool legacy_presence_fallback_enabled() const { return this->legacy_presence_fallback_enabled_; }
  const FloorplanRoomContext &floorplan_room() const { return this->floorplan_room_; }
  bool point_in_floorplan_room(float x, float y) const;
  float floorplan_room_signed_distance(float x, float y) const;

 private:
  bool has_config_{false};
  bool tracker_assist_presence_enabled_{true};
  bool legacy_presence_fallback_enabled_{false};
  std::string raw_config_;
  std::array<std::string, 6> software_zones_{};
  std::array<std::string, 4> calibration_zones_{};
  FloorplanRoomContext floorplan_room_{};

  static const std::string EMPTY_;

  void refresh_zone_cache_();
  void refresh_floorplan_room_cache_();
  static std::string extract_object_by_id_(const std::string &json, const std::string &id);
  static std::string extract_object_by_key_(const std::string &json, const std::string &key);
  static bool extract_bool_(const std::string &json, const std::string &key, bool fallback);
  static std::string extract_string_(const std::string &json, const std::string &key);
  static int extract_boundary_points_(const std::string &json, float xs[MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS],
                                      float ys[MAX_FLOORPLAN_ROOM_BOUNDARY_POINTS]);
};

}  // namespace radar_api_server
}  // namespace esphome
