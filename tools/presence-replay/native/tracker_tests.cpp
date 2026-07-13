#include <cmath>
#include <cstdlib>
#include <cstring>
#include <iostream>

#include "../../../components/radar_api_server/device_config_cache.h"
#include "../../../components/radar_api_server/presence_tracker.h"
#include "../../../components/radar_api_server/software_zone_evidence.h"
#include "../../../components/radar_api_server/timezone_catalog.h"

namespace {

using esphome::radar_api_server::DeviceConfigCache;
using esphome::radar_api_server::PresenceTracker;
using esphome::radar_api_server::PresenceTrackerInput;
using esphome::radar_api_server::PresenceTrackerOutput;
using esphome::radar_api_server::SoftwareZoneTarget;
using esphome::radar_api_server::compute_software_zone_evidence;
using esphome::radar_api_server::find_timezone;
using esphome::radar_api_server::is_supported_timezone;
using esphome::radar_api_server::timezone_posix;

PresenceTrackerInput make_input(uint32_t now_ms) {
  PresenceTrackerInput input;
  input.now_ms = now_ms;
  input.stationary_speed_cm_s = 40.0f;
  return input;
}

PresenceTrackerInput make_target_input(uint32_t now_ms, bool room_inside, bool room_outside,
                                       float room_signed_distance_mm, int exit_zone_mask = 0) {
  PresenceTrackerInput input = make_input(now_ms);
  input.room_context_configured = true;
  input.targets[0].valid = true;
  input.targets[0].x_mm = 1200.0f;
  input.targets[0].y_mm = 2200.0f;
  input.targets[0].distance_mm = 2500.0f;
  input.targets[0].speed_cm_s = 0.0f;
  input.targets[0].exit_zone_mask = exit_zone_mask;
  input.targets[0].room_inside = room_inside;
  input.targets[0].room_outside = room_outside;
  input.targets[0].room_signed_distance_mm = room_signed_distance_mm;
  return input;
}

void set_target(PresenceTrackerInput &input, int index, float x_mm, float y_mm) {
  input.targets[index].valid = true;
  input.targets[index].x_mm = x_mm;
  input.targets[index].y_mm = y_mm;
  input.targets[index].distance_mm = std::sqrt(x_mm * x_mm + y_mm * y_mm);
}

PresenceTrackerInput make_position_input(uint32_t now_ms, float x_mm, float y_mm, bool pir_motion = false) {
  PresenceTrackerInput input = make_input(now_ms);
  input.pir_motion = pir_motion;
  set_target(input, 0, x_mm, y_mm);
  return input;
}

PresenceTrackerInput make_two_target_input(uint32_t now_ms, float first_x_mm, float first_y_mm, float second_x_mm,
                                           float second_y_mm) {
  PresenceTrackerInput input = make_input(now_ms);
  set_target(input, 0, first_x_mm, first_y_mm);
  set_target(input, 1, second_x_mm, second_y_mm);
  return input;
}

void confirm_track(PresenceTracker &tracker, bool room_inside, bool room_outside, int exit_zone_mask = 0) {
  const float room_distance = room_inside ? 1200.0f : room_outside ? -1200.0f : 0.0f;
  tracker.update(make_target_input(500, room_inside, room_outside, room_distance, exit_zone_mask));
  tracker.update(make_target_input(1000, room_inside, room_outside, room_distance, exit_zone_mask));
  tracker.update(make_target_input(1500, room_inside, room_outside, room_distance, exit_zone_mask));
}

void move_track_outside_room(PresenceTracker &tracker) {
  tracker.update(make_target_input(2000, false, true, -1200.0f));
}

void miss_frames(PresenceTracker &tracker, int frames, uint32_t start_ms = 2500) {
  for (int i = 0; i < frames; i++) {
    tracker.update(make_input(start_ms + static_cast<uint32_t>(i) * 500U));
  }
}

void require(bool condition, const char *message) {
  if (condition)
    return;
  std::cerr << "FAIL: " << message << "\n";
  std::exit(1);
}

void require_near(float actual, float expected, float tolerance, const char *message) {
  require(std::isfinite(actual), message);
  require(std::fabs(actual - expected) <= tolerance, message);
}

const esphome::radar_api_server::PresenceTrackerTrackOutput &require_track(const PresenceTrackerOutput &output,
                                                                           int index) {
  require(index >= 0 && index < static_cast<int>(output.tracks.size()), "requested output track must exist");
  require(output.tracks[index].valid, "requested output track must be valid");
  return output.tracks[index];
}

void no_detection_stays_idle() {
  PresenceTracker tracker;
  tracker.update(make_input(500));

  const auto &out = tracker.output();
  require(!out.presence, "empty input should not report presence");
  require(!out.motion, "empty input should not report motion");
  require(out.input_detection_count == 0, "empty input should report no detections");
  require(out.active_track_count == 0, "empty input should not allocate tracks");
  require(std::strcmp(out.state, "idle") == 0, "empty input should remain idle");
}

void confirmation_requires_configured_hit_count() {
  PresenceTracker tracker;

  tracker.update(make_position_input(500, 0.0f, 2000.0f));
  require(!tracker.output().presence, "first hit should remain tentative");
  require(tracker.output().tentative_track_count == 1, "first hit should create one tentative track");

  tracker.update(make_position_input(1000, 0.0f, 2000.0f));
  require(!tracker.output().presence, "second hit without PIR should remain tentative");

  tracker.update(make_position_input(1500, 0.0f, 2000.0f));
  require(tracker.output().presence, "third hit should confirm presence");
  require(tracker.output().confirmed_track_count == 1, "third hit should confirm one track");
  require(std::strcmp(tracker.output().reason, "confirmed_by_hits") == 0,
          "normal confirmation should expose confirmed_by_hits");
}

void pir_hint_confirms_on_second_hit() {
  PresenceTracker tracker;

  tracker.update(make_position_input(500, 0.0f, 2000.0f, true));
  require(tracker.output().tentative_track_count == 1, "first PIR-assisted hit should remain tentative");

  tracker.update(make_position_input(1000, 0.0f, 2000.0f, true));
  require(tracker.output().confirmed_track_count == 1, "second PIR-assisted hit should confirm the track");
  require(std::strcmp(tracker.output().reason, "confirmed_by_pir_hint") == 0,
          "PIR-assisted confirmation should expose its reason");
}

void tentative_track_expires_after_miss_budget() {
  PresenceTracker tracker;
  tracker.update(make_position_input(500, 0.0f, 2000.0f));

  tracker.update(make_input(1000));
  tracker.update(make_input(1500));
  tracker.update(make_input(2000));
  require(tracker.output().tentative_track_count == 1, "tentative track should survive its configured miss budget");

  tracker.update(make_input(2500));
  require(tracker.output().active_track_count == 0, "tentative track should expire after exceeding its miss budget");
  require(std::strcmp(tracker.output().state, "idle") == 0, "expired tentative track should return to idle");
}

void confirmed_track_coasts_and_reacquires() {
  PresenceTracker tracker;
  tracker.update(make_position_input(500, 0.0f, 2000.0f));
  tracker.update(make_position_input(1000, 0.0f, 2000.0f));
  tracker.update(make_position_input(1500, 0.0f, 2000.0f));

  tracker.update(make_input(2000));
  require(tracker.output().coasting_track_count == 1, "a missed confirmed track should enter coasting");
  require(require_track(tracker.output(), 0).coasting, "coasting state should be exposed on track output");

  tracker.update(make_position_input(2500, 0.0f, 2000.0f));
  require(tracker.output().confirmed_track_count == 1, "a nearby detection should reacquire a coasting track");
  require(tracker.output().coasting_track_count == 0, "reacquired track should leave coasting");
  require(std::strcmp(tracker.output().reason, "confirmed_reacquired") == 0,
          "reacquisition should expose confirmed_reacquired");
}

void filter_block_ages_track_without_consuming_detection() {
  PresenceTracker tracker;
  tracker.update(make_position_input(500, 0.0f, 2000.0f));
  tracker.update(make_position_input(1000, 0.0f, 2000.0f));
  tracker.update(make_position_input(1500, 0.0f, 2000.0f));

  PresenceTrackerInput blocked = make_position_input(2000, 0.0f, 2000.0f);
  blocked.filter_blocked = true;
  tracker.update(blocked);
  require(tracker.output().coasting_track_count == 1, "filter block should age rather than update a confirmed track");
  require(std::strcmp(tracker.output().reason, "filter_blocked_missed") == 0,
          "filter block should expose filter_blocked_missed");

  tracker.update(make_position_input(2500, 0.0f, 2000.0f));
  require(tracker.output().confirmed_track_count == 1, "track should reacquire after filter block clears");
}

void non_exit_track_uses_long_coasting_budget() {
  PresenceTracker tracker;
  tracker.update(make_position_input(500, 0.0f, 2000.0f));
  tracker.update(make_position_input(1000, 0.0f, 2000.0f));
  tracker.update(make_position_input(1500, 0.0f, 2000.0f));

  miss_frames(tracker, 24, 2000);
  require(tracker.output().presence, "non-exit track should survive 24 missed frames");
  require(tracker.output().coasting_track_count == 1, "non-exit track should still be coasting at its budget");

  tracker.update(make_input(14000));
  require(!tracker.output().presence, "non-exit track should expire after exceeding 24 missed frames");
  require(std::strcmp(tracker.output().drop_reason, "lost_without_exit") == 0,
          "non-exit expiration should record lost_without_exit");
}

void target_slot_reordering_preserves_stable_tracks() {
  PresenceTracker tracker;
  tracker.update(make_two_target_input(500, -1000.0f, 2000.0f, 1000.0f, 2000.0f));
  tracker.update(make_two_target_input(1000, -1000.0f, 2000.0f, 1000.0f, 2000.0f));
  tracker.update(make_two_target_input(1500, -1000.0f, 2000.0f, 1000.0f, 2000.0f));
  require(tracker.output().confirmed_track_count == 2, "two stable detections should confirm two tracks");

  tracker.update(make_two_target_input(2000, 1000.0f, 2000.0f, -1000.0f, 2000.0f));
  const auto &out = tracker.output();
  require(out.confirmed_track_count == 2, "sensor slot reordering should keep both tracks confirmed");
  require(out.coasting_track_count == 0, "sensor slot reordering should not make stable tracks coast");
  bool has_left_track = false;
  bool has_right_track = false;
  for (const auto &track : out.tracks) {
    if (!track.valid)
      continue;
    has_left_track = has_left_track || track.x_mm < 0.0f;
    has_right_track = has_right_track || track.x_mm > 0.0f;
  }
  require(has_left_track, "left stable track should remain associated with the left detection");
  require(has_right_track, "right stable track should remain associated with the right detection");
}

void unmatched_detection_uses_free_track_slot() {
  PresenceTracker tracker;
  tracker.update(make_two_target_input(500, -1000.0f, 2000.0f, 1000.0f, 2000.0f));
  tracker.update(make_two_target_input(1000, -1000.0f, 2000.0f, 1000.0f, 2000.0f));
  tracker.update(make_two_target_input(1500, -1000.0f, 2000.0f, 1000.0f, 2000.0f));

  PresenceTrackerInput input = make_two_target_input(2000, -1000.0f, 2000.0f, 1000.0f, 2000.0f);
  set_target(input, 2, 0.0f, 5000.0f);
  tracker.update(input);
  require(tracker.output().confirmed_track_count == 2, "existing stable tracks should remain confirmed");
  require(tracker.output().tentative_track_count == 1, "unmatched detection should allocate the free track slot");
  require(tracker.output().active_track_count == 3, "all three hardware target slots should be represented");
}

void accepted_teleport_resets_filter_state() {
  PresenceTracker tracker;
  tracker.update(make_position_input(500, 0.0f, 2000.0f));
  tracker.update(make_position_input(1000, 0.0f, 2000.0f));
  tracker.update(make_position_input(1500, 0.0f, 2000.0f));

  tracker.update(make_position_input(2000, 1600.0f, 2000.0f));
  const auto &track = require_track(tracker.output(), 0);
  require_near(track.x_mm, 1600.0f, 0.01f, "accepted teleport should reset filtered position to measurement");
  require_near(track.vx_mm_s, 0.0f, 0.01f, "accepted teleport should reset x velocity");
  require_near(track.vy_mm_s, 0.0f, 0.01f, "accepted teleport should reset y velocity");
}

void kalman_filter_smooths_measurement_and_caps_long_prediction() {
  PresenceTracker tracker;
  tracker.update(make_position_input(500, 0.0f, 2000.0f));
  tracker.update(make_position_input(1000, 0.0f, 2000.0f));
  tracker.update(make_position_input(1500, 0.0f, 2000.0f));

  tracker.update(make_position_input(2000, 400.0f, 2000.0f));
  const auto updated = require_track(tracker.output(), 0);
  require(updated.x_mm > 0.0f && updated.x_mm < 400.0f,
          "Kalman update should smooth a non-teleport position measurement");
  require(std::isfinite(updated.vx_mm_s) && updated.vx_mm_s > 0.0f,
          "Kalman update should estimate finite positive x velocity");

  tracker.update(make_input(100000));
  const auto predicted = require_track(tracker.output(), 0);
  require_near(predicted.x_mm, updated.x_mm + updated.vx_mm_s * 2.0f, 0.5f,
               "long prediction should use the configured two-second dt cap");
  require(std::isfinite(predicted.y_mm) && std::isfinite(predicted.vy_mm_s),
          "long prediction should preserve finite filter output");
}

void radial_motion_sets_approaching_and_away_directions() {
  PresenceTracker approaching;
  approaching.update(make_position_input(500, 0.0f, 3000.0f));
  approaching.update(make_position_input(1000, 0.0f, 2500.0f));
  approaching.update(make_position_input(1500, 0.0f, 2000.0f));
  require(std::strcmp(require_track(approaching.output(), 0).direction, "approaching") == 0,
          "decreasing radial distance should report approaching");

  PresenceTracker moving_away;
  moving_away.update(make_position_input(500, 0.0f, 1000.0f));
  moving_away.update(make_position_input(1000, 0.0f, 1500.0f));
  moving_away.update(make_position_input(1500, 0.0f, 2000.0f));
  require(std::strcmp(require_track(moving_away.output(), 0).direction, "moving_away") == 0,
          "increasing radial distance should report moving_away");
}

void room_exit_sequence_expires_before_inside_room_hold() {
  PresenceTracker inside_tracker;
  confirm_track(inside_tracker, true, false);
  miss_frames(inside_tracker, 13);
  require(inside_tracker.output().presence, "inside-room coasting should still hold after 13 missed frames");
  require(std::strcmp(inside_tracker.output().drop_reason, "none") == 0,
          "inside-room coasting should not record a drop after 13 missed frames");

  PresenceTracker outside_tracker;
  confirm_track(outside_tracker, true, false);
  move_track_outside_room(outside_tracker);
  miss_frames(outside_tracker, 13);
  require(!outside_tracker.output().presence, "room-exit coasting should expire after 13 missed frames");
  require(std::strcmp(outside_tracker.output().drop_reason, "lost_after_room_exit") == 0,
          "room-exit coasting should record lost_after_room_exit");
}

void outside_without_crossing_does_not_create_room_exit() {
  PresenceTracker tracker;
  confirm_track(tracker, false, true);
  miss_frames(tracker, 13);
  require(tracker.output().presence, "outside-only track without inside-to-outside crossing should not fast-drop");
  require(std::strcmp(tracker.output().drop_reason, "none") == 0,
          "outside-only track should not record room-exit drop");
}

void exit_evidence_still_expires_fastest() {
  PresenceTracker tracker;
  confirm_track(tracker, true, false, 1);
  miss_frames(tracker, 5);
  require(!tracker.output().presence, "exit evidence should expire faster than room boundary coasting");
  require(std::strcmp(tracker.output().drop_reason, "lost_after_exit") == 0,
          "exit evidence should keep lost_after_exit reason");
}

void room_state_is_exposed_on_track_output() {
  PresenceTracker tracker;
  confirm_track(tracker, false, true);
  const auto &out = tracker.output();
  require(out.tracks[0].valid, "confirmed tracker should expose a valid output track");
  require(std::strcmp(out.tracks[0].room_state, "outside") == 0, "track output should expose outside room state");
}

void room_signed_distance_is_positive_inside_and_negative_outside() {
  DeviceConfigCache cache;
  cache.update(
      R"({"version":1,"zones":[],"floorplan":{"room":{"id":"room_1","name":"Room","source":"stored_room","boundary":[[-1000,1000],[1000,1000],[1000,3000],[-1000,3000]]}}})");

  require(cache.floorplan_room().configured, "room context should parse from device config");
  require(cache.floorplan_room().boundary_point_count == 4, "room context should parse four boundary points");
  require(cache.floorplan_room_signed_distance(0.0f, 2000.0f) > 900.0f,
          "inside point should have positive signed distance");
  require(cache.floorplan_room_signed_distance(0.0f, 3500.0f) < -400.0f,
          "outside point should have negative signed distance");
}

void software_zone_evidence_carries_room_signed_distance() {
  DeviceConfigCache cache;
  cache.update(
      R"({"version":1,"zones":[],"floorplan":{"room":{"id":"room_1","name":"Room","source":"stored_room","boundary":[[-1000,1000],[1000,1000],[1000,3000],[-1000,3000]]}}})");
  const SoftwareZoneTarget targets[3] = {
      {true, 0.0f, 2000.0f},
      {true, 0.0f, 3500.0f},
      {false, 0.0f, 0.0f},
  };
  uint32_t exit_last_seen_ms = 0;
  const auto evidence = compute_software_zone_evidence(cache, 1000, targets, &exit_last_seen_ms);

  require(evidence.room_context_configured, "software evidence should expose configured room context");
  require(evidence.target_room_inside[0], "inside target should be marked inside room");
  require(evidence.target_room_signed_distances[0] > 900.0f, "inside target should carry positive signed distance");
  require(evidence.target_room_outside[1], "outside target should be marked outside room");
  require(evidence.target_room_signed_distances[1] < -400.0f, "outside target should carry negative signed distance");
}

void timezone_catalog_accepts_only_supported_ids() {
  require(is_supported_timezone("Asia/Seoul"), "timezone catalog should include the default timezone");
  require(std::strcmp(timezone_posix("Asia/Seoul"), "KST-9") == 0,
          "timezone catalog should map IANA ids to embedded POSIX rules");
  require(std::strcmp(timezone_posix("America/Los_Angeles"), "PST8PDT,M3.2.0,M11.1.0") == 0,
          "timezone catalog should preserve daylight-saving rules");
  require(find_timezone("Moon/Sea_of_Tranquility") == nullptr,
          "timezone catalog should reject unsupported ids");
  require(timezone_posix(nullptr) == nullptr, "timezone catalog should reject null ids");
}

}  // namespace

int main() {
  no_detection_stays_idle();
  confirmation_requires_configured_hit_count();
  pir_hint_confirms_on_second_hit();
  tentative_track_expires_after_miss_budget();
  confirmed_track_coasts_and_reacquires();
  filter_block_ages_track_without_consuming_detection();
  non_exit_track_uses_long_coasting_budget();
  target_slot_reordering_preserves_stable_tracks();
  unmatched_detection_uses_free_track_slot();
  accepted_teleport_resets_filter_state();
  kalman_filter_smooths_measurement_and_caps_long_prediction();
  radial_motion_sets_approaching_and_away_directions();
  room_signed_distance_is_positive_inside_and_negative_outside();
  software_zone_evidence_carries_room_signed_distance();
  timezone_catalog_accepts_only_supported_ids();
  room_exit_sequence_expires_before_inside_room_hold();
  outside_without_crossing_does_not_create_room_exit();
  exit_evidence_still_expires_fastest();
  room_state_is_exposed_on_track_output();
  std::cout << "tracker_tests: ok\n";
  return 0;
}
