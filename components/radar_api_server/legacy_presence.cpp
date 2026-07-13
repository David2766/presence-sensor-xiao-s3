#include "legacy_presence.h"

#include <cmath>

namespace esphome {
namespace radar_api_server {

namespace {

constexpr int STILL_CONFIDENCE_ENTER = 60;
constexpr int STILL_CONFIDENCE_EXIT = 25;
constexpr int STILL_LIVE_GAIN = 14;
constexpr int STILL_SAME_AREA_GAIN = 8;
constexpr int STILL_MISSING_DECAY = 6;
constexpr int STILL_MOVING_EXIT_DECAY = 18;
constexpr int STILL_FAR_TARGET_DECAY = 12;
constexpr float STILL_SAME_AREA_RADIUS_MM = 700.0f;
constexpr uint32_t STILL_MAX_HOLD_MS = 120000;

}  // namespace

const LegacyPresenceOutput &LegacyPresence::update(const LegacyPresenceInput &input) {
  const bool live_still_target = input.still_target_count > 0;
  const bool live_moving_target = input.moving_target_count > 0;

  float still_x = 0.0f;
  float still_y = 0.0f;
  bool still_coord_valid = false;
  for (const auto &target : input.targets) {
    if (still_coord_valid || !target.valid || std::fabs(target.speed_cm_s) > input.stationary_speed_cm_s)
      continue;
    if (std::sqrt(target.x_mm * target.x_mm + target.y_mm * target.y_mm) <= 100.0f)
      continue;
    still_x = target.x_mm;
    still_y = target.y_mm;
    still_coord_valid = true;
  }

  bool still_same_area = false;
  if (still_coord_valid && this->still_anchor_valid_) {
    const float dx = still_x - this->still_anchor_x_;
    const float dy = still_y - this->still_anchor_y_;
    still_same_area = std::sqrt(dx * dx + dy * dy) <= STILL_SAME_AREA_RADIUS_MM;
  }

  const char *still_state = "idle";
  const char *still_reason = "target_missing";

  if (input.filter_blocked) {
    this->still_confidence_ = 0;
    this->still_confirmed_ = false;
    still_state = "blocked";
    still_reason = "filter_blocked";
  } else if (live_still_target) {
    this->still_last_seen_ms_ = input.now_ms;
    if (still_coord_valid) {
      if (!this->still_anchor_valid_ || !still_same_area) {
        this->still_anchor_x_ = still_x;
        this->still_anchor_y_ = still_y;
        this->still_anchor_valid_ = true;
        still_reason = this->still_confirmed_ ? "anchor_moved" : "anchor_set";
      } else {
        this->still_anchor_x_ = this->still_anchor_x_ * 0.75f + still_x * 0.25f;
        this->still_anchor_y_ = this->still_anchor_y_ * 0.75f + still_y * 0.25f;
        still_reason = "same_area_still";
      }
    } else {
      still_reason = "still_no_coord";
    }

    this->still_confidence_ += STILL_LIVE_GAIN + (still_same_area ? STILL_SAME_AREA_GAIN : 0);
    if (this->still_confidence_ > 100)
      this->still_confidence_ = 100;
    if (this->still_confidence_ >= STILL_CONFIDENCE_ENTER) {
      this->still_confirmed_ = true;
      still_state = "confirmed";
    } else {
      still_state = "candidate";
    }
  } else if (live_moving_target) {
    this->still_confidence_ -= STILL_MOVING_EXIT_DECAY;
    still_reason = "moving_target";
    still_state = this->still_confirmed_ ? "moving_decay" : "idle";
  } else if (input.target_count > 0) {
    this->still_confidence_ -= STILL_FAR_TARGET_DECAY;
    still_reason = "non_still_target";
    still_state = this->still_confirmed_ ? "target_decay" : "idle";
  } else {
    this->still_confidence_ -= STILL_MISSING_DECAY;
    still_reason = "target_missing";
    still_state = this->still_confirmed_ ? "holding" : "idle";
  }

  if (this->still_confidence_ < 0)
    this->still_confidence_ = 0;

  if (this->still_confirmed_ && this->still_confidence_ < STILL_CONFIDENCE_EXIT) {
    this->still_confirmed_ = false;
    still_state = "lost";
    still_reason = "confidence_expired";
  }
  if (this->still_confirmed_ && this->still_last_seen_ms_ > 0 &&
      (input.now_ms - this->still_last_seen_ms_) > STILL_MAX_HOLD_MS) {
    this->still_confirmed_ = false;
    still_state = "lost";
    still_reason = "max_hold_expired";
  }

  const bool still_hold_active = this->still_confirmed_ && input.target_count == 0 && this->still_last_seen_ms_ > 0 &&
                                 (input.now_ms - this->still_last_seen_ms_) <= STILL_MAX_HOLD_MS;
  const bool presence = input.target_count > 0 ? true :
                        still_hold_active ? true :
                        input.pir_motion ? true :
                        input.filter_blocked ? false :
                        false;
  const bool motion = input.moving_target_count > 0 ? true :
                      input.filter_blocked ? false :
                      input.pir_motion;

  this->output_.presence = presence;
  this->output_.motion = motion;
  this->output_.still_hold_active = still_hold_active;
  this->output_.still_confirmed = this->still_confirmed_;
  this->output_.still_confidence = this->still_confidence_;
  this->output_.still_anchor_valid = this->still_anchor_valid_;
  this->output_.still_anchor_x = this->still_anchor_x_;
  this->output_.still_anchor_y = this->still_anchor_y_;
  this->output_.still_last_seen_ms = this->still_last_seen_ms_;
  this->output_.still_state = still_state;
  this->output_.still_reason = still_reason;
  this->output_.presence_reason = input.target_count > 0 ? "target" :
                                  still_hold_active ? "still_hold" :
                                  input.pir_motion ? "pir" :
                                  input.filter_blocked ? "filter_blocked" :
                                  "none";
  this->output_.motion_reason = input.moving_target_count > 0 ? "moving_target" :
                                input.filter_blocked ? "filter_blocked" :
                                input.pir_motion ? "pir" :
                                "none";
  return this->output_;
}

void LegacyPresence::disable() {
  this->still_confidence_ = 0;
  this->still_anchor_valid_ = false;
  this->still_anchor_x_ = 0.0f;
  this->still_anchor_y_ = 0.0f;
  this->still_last_seen_ms_ = 0;
  this->still_confirmed_ = false;
  this->output_ = LegacyPresenceOutput{};
}

}  // namespace radar_api_server
}  // namespace esphome
