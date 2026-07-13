#pragma once

#include <cstdint>

namespace esphome {
namespace radar_api_server {

struct LegacyPresenceTarget {
  bool valid{false};
  float x_mm{0.0f};
  float y_mm{0.0f};
  float speed_cm_s{0.0f};
};

struct LegacyPresenceInput {
  uint32_t now_ms{0};
  bool pir_motion{false};
  bool filter_blocked{false};
  int target_count{0};
  int moving_target_count{0};
  int still_target_count{0};
  float stationary_speed_cm_s{40.0f};
  LegacyPresenceTarget targets[3]{};
};

struct LegacyPresenceOutput {
  bool presence{false};
  bool motion{false};
  bool still_hold_active{false};
  bool still_confirmed{false};
  int still_confidence{0};
  bool still_anchor_valid{false};
  float still_anchor_x{0.0f};
  float still_anchor_y{0.0f};
  uint32_t still_last_seen_ms{0};
  const char *still_state{"disabled"};
  const char *still_reason{"legacy_disabled"};
  const char *presence_reason{"none"};
  const char *motion_reason{"none"};
};

class LegacyPresence {
 public:
  const LegacyPresenceOutput &update(const LegacyPresenceInput &input);
  void disable();
  const LegacyPresenceOutput &output() const { return this->output_; }

 private:
  int still_confidence_{0};
  bool still_anchor_valid_{false};
  float still_anchor_x_{0.0f};
  float still_anchor_y_{0.0f};
  uint32_t still_last_seen_ms_{0};
  bool still_confirmed_{false};
  LegacyPresenceOutput output_{};
};

}  // namespace radar_api_server
}  // namespace esphome
