#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace esphome {
namespace radar_api_server {

struct PresenceTrackerTargetInput {
  bool valid{false};
  float x_mm{0.0f};
  float y_mm{0.0f};
  float speed_cm_s{0.0f};
  float distance_mm{0.0f};
  int exit_zone_mask{0};
  bool room_inside{false};
  bool room_outside{false};
  float room_signed_distance_mm{0.0f};
};

struct PresenceTrackerInput {
  uint32_t now_ms{0};
  bool pir_motion{false};
  bool filter_blocked{false};
  bool room_context_configured{false};
  float illuminance_lux{0.0f};
  float stationary_speed_cm_s{40.0f};
  std::array<PresenceTrackerTargetInput, 3> targets{};
};

struct PresenceTrackerTrackOutput {
  bool valid{false};
  bool moving{false};
  bool coasting{false};
  float x_mm{0.0f};
  float y_mm{0.0f};
  float vx_mm_s{0.0f};
  float vy_mm_s{0.0f};
  float speed_cm_s{0.0f};
  float distance_mm{0.0f};
  float radial_velocity_cm_s{0.0f};
  int track_score{0};
  const char *state{"idle"};
  const char *reason{"none"};
  const char *direction{"stationary"};
  int exit_zone_mask{0};
  int exit_age_ms{-1};
  bool exit_recent{false};
  const char *room_state{"unknown"};
};

struct PresenceTrackerOutput {
  bool presence{false};
  bool motion{false};
  int input_detection_count{0};
  int active_track_count{0};
  int tentative_track_count{0};
  int confirmed_track_count{0};
  int coasting_track_count{0};
  int moving_track_count{0};
  int still_track_count{0};
  int track_score{0};
  const char *state{"idle"};
  const char *reason{"none"};
  const char *drop_reason{"none"};
  uint32_t drop_ms{0};
  int exit_track_count{0};
  std::array<PresenceTrackerTrackOutput, 3> tracks{};
};

struct PresenceTrackerPolicy {
  float association_radius_mm{800.0f};
  float stable_track_reassociation_radius_mm{1800.0f};
  float stationary_radius_mm{250.0f};
  float teleport_reset_distance_mm{1500.0f};
  float measurement_noise_mm2{200.0f};
  float process_noise_accel_mm2_s4{5000.0f};
  float initial_position_covariance{500.0f};
  float initial_velocity_covariance{1000.0f};
  uint32_t max_filter_dt_ms{2000};
  float moving_enter_speed_multiplier{1.25f};
  float moving_exit_speed_multiplier{0.65f};
  float direction_enter_speed_multiplier{0.80f};
  float direction_exit_speed_multiplier{0.60f};
  float minimum_direction_distance_mm{100.0f};
  uint8_t confirm_window_frames{5};
  uint8_t confirm_hits_required{3};
  uint8_t pir_confirm_hits_required{2};
  uint8_t tentative_delete_missed_frames{3};
  uint8_t coasting_delete_missed_frames{12};
  uint8_t exit_coasting_delete_missed_frames{4};
  uint8_t non_exit_coasting_delete_missed_frames{24};
  uint32_t exit_evidence_max_age_ms{8000};
};

class PresenceTracker {
 public:
  void update(const PresenceTrackerInput &input);

  const PresenceTrackerOutput &output() const { return this->output_; }
  std::string debug_json() const;

 private:
  enum class TrackState : uint8_t {
    IDLE = 0,
    TENTATIVE,
    CONFIRMED,
    COASTING,
  };

  enum class TrackDirection : uint8_t {
    STATIONARY = 0,
    APPROACHING,
    MOVING_AWAY,
  };

  struct Track {
    TrackState state{TrackState::IDLE};
    bool updated{false};
    bool moving{false};
    uint32_t first_seen_ms{0};
    uint32_t last_seen_ms{0};
    uint32_t last_update_ms{0};
    uint32_t state_changed_ms{0};
    uint16_t observed_frames{0};
    uint16_t missed_frames{0};
    uint8_t hit_mask{0};
    uint8_t history_frames{0};
    const char *reason{"idle"};
    bool filter_initialized{false};
    float x_mm{0.0f};
    float y_mm{0.0f};
    float vx_mm_s{0.0f};
    float vy_mm_s{0.0f};
    float speed_cm_s{0.0f};
    float distance_mm{0.0f};
    float radial_velocity_cm_s{0.0f};
    TrackDirection direction{TrackDirection::STATIONARY};
    uint32_t last_exit_seen_ms{0};
    int exit_zone_mask{0};
    bool room_context_seen{false};
    bool last_room_inside{false};
    bool last_room_outside{false};
    bool room_distance_valid{false};
    bool room_exit_candidate{false};
    bool room_exit_crossed{false};
    bool room_exit_outward{false};
    float last_room_signed_distance_mm{0.0f};
    const char *room_exit_reason{"none"};
    float covariance[4][4]{};
  };

  PresenceTrackerPolicy policy_{};
  std::array<Track, 3> tracks_{};
  PresenceTrackerOutput output_{};
  const char *last_drop_reason_{"none"};
  uint32_t last_drop_ms_{0};

  void associate_targets_(const PresenceTrackerInput &input, int (&mapping)[3]) const;
  int find_reusable_track_(const bool (&reserved_tracks)[3]) const;
  void update_track_(Track &track, const PresenceTrackerTargetInput &target, const PresenceTrackerInput &input);
  void age_track_(Track &track, const PresenceTrackerInput &input);
  void rebuild_output_(const PresenceTrackerInput &input);
  void record_track_observation_(Track &track, bool observed);
  void update_exit_evidence_(Track &track, const PresenceTrackerTargetInput &target, uint32_t now_ms);
  void update_room_evidence_(Track &track, const PresenceTrackerTargetInput &target, const PresenceTrackerInput &input);
  bool has_recent_exit_evidence_(const Track &track, uint32_t now_ms) const;
  int exit_age_ms_(const Track &track, uint32_t now_ms) const;
  uint8_t coasting_delete_missed_frames_for_(const Track &track, uint32_t now_ms) const;
  const char *room_state_name_(const Track &track) const;
  bool has_room_exit_evidence_(const Track &track) const;
  float room_boundary_margin_mm_(const Track &track) const;
  bool should_confirm_(const Track &track, const PresenceTrackerInput &input) const;
  int recent_hit_count_(const Track &track) const;
  int track_score_(const Track &track) const;
  int stable_track_count_() const;
  float association_radius_for_(const Track &track) const;
  float association_cost_(const Track &track, float distance) const;
  float predicted_x_(const Track &track, uint32_t now_ms) const;
  float predicted_y_(const Track &track, uint32_t now_ms) const;
  void reset_filter_(Track &track, float x_mm, float y_mm, uint32_t now_ms) const;
  void predict_filter_(Track &track, uint32_t now_ms) const;
  void update_filter_(Track &track, float x_mm, float y_mm, uint32_t now_ms) const;
  void refresh_track_kinematics_(Track &track, const PresenceTrackerInput &input) const;
  void update_direction_(Track &track, const PresenceTrackerInput &input) const;
  static bool is_stable_track_(const Track &track);
  static float distance_between_(float ax, float ay, float bx, float by);
  static const char *state_name_(TrackState state);
  static const char *direction_name_(TrackDirection direction);
  static void append_json_string_(std::string &out, const char *value);
};

}  // namespace radar_api_server
}  // namespace esphome
