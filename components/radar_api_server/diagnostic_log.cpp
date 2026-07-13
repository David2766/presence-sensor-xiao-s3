#include "diagnostic_log.h"

#include <esp_heap_caps.h>
#include <cstdio>
#include <cstring>

namespace esphome {
namespace radar_api_server {

namespace {

bool same_text(const char *left, const std::string &right) {
  return right == (left != nullptr && left[0] != '\0' ? left : "none");
}

}  // namespace

DiagnosticLog::~DiagnosticLog() {
  if (this->events_ != nullptr) {
    heap_caps_free(this->events_);
    this->events_ = nullptr;
  }
}

void DiagnosticLog::update(const DiagnosticSnapshot &snapshot) {
  if (!this->ensure_allocated_())
    return;

  this->trim_(snapshot.ms);

  if (!this->has_previous_) {
    this->append_event_("diagnostic_started", "first_snapshot", snapshot);
  } else {
    if (snapshot.presence != this->previous_.presence) {
      this->append_event_(snapshot.presence ? "presence_on" : "presence_off",
                          snapshot.presence ? snapshot.presence_reason : snapshot.presence_off_reason, snapshot);
    }
    if (snapshot.motion != this->previous_.motion) {
      this->append_event_(snapshot.motion ? "motion_on" : "motion_off", snapshot.motion_reason, snapshot);
    }
    if (this->previous_.target_count <= 0 && snapshot.target_count > 0) {
      this->append_event_("target_seen", snapshot.presence_reason, snapshot);
    } else if (this->previous_.target_count > 0 && snapshot.target_count <= 0) {
      this->append_event_("target_lost", "no_valid_target", snapshot);
    }
    if (!same_text(snapshot.still_state, this->previous_still_state_)) {
      if (std::strcmp(safe_(snapshot.still_state), "confirmed") == 0) {
        this->append_event_("still_confirmed", snapshot.still_reason, snapshot);
      } else if (std::strcmp(safe_(snapshot.still_state), "lost") == 0) {
        this->append_event_("still_lost", snapshot.still_reason, snapshot);
      } else if (std::strcmp(safe_(snapshot.still_state), "holding") == 0) {
        this->append_event_("still_holding", snapshot.still_reason, snapshot);
      }
    }
    if (!this->previous_.still_hold_active && snapshot.still_hold_active) {
      this->append_event_("still_hold_started", snapshot.still_reason, snapshot);
    } else if (this->previous_.still_hold_active && !snapshot.still_hold_active) {
      this->append_event_("still_hold_ended", snapshot.still_reason, snapshot);
    }
    if (this->previous_.still_confidence >= 25 && snapshot.still_confidence < 25) {
      this->append_event_("still_confidence_low", snapshot.still_reason, snapshot);
    }
    if (!same_text(snapshot.range_reason, this->previous_range_reason_)) {
      if (std::strcmp(safe_(snapshot.range_reason), "ok") == 0) {
        this->append_event_("range_gate_recovered", "ok", snapshot);
      } else {
        this->append_event_("range_gate_blocked", snapshot.range_reason, snapshot);
      }
    }
    if (!this->previous_.exit_zone_active && snapshot.exit_zone_active) {
      this->append_event_("exit_zone_seen", "exit_zone_hit", snapshot);
    } else if (this->previous_.exit_zone_active && !snapshot.exit_zone_active) {
      this->append_event_("exit_zone_clear", "exit_zone_clear", snapshot);
    }
    if (snapshot.tracker_presence != this->previous_.tracker_presence) {
      this->append_event_(snapshot.tracker_presence ? "tracker_presence_on" : "tracker_presence_off",
                          snapshot.tracker_reason, snapshot);
    }
    if (!same_text(snapshot.tracker_state, this->previous_tracker_state_) ||
        !same_text(snapshot.tracker_reason, this->previous_tracker_reason_)) {
      this->append_event_("tracker_state", snapshot.tracker_reason, snapshot);
    }
  }

  this->previous_ = snapshot;
  this->previous_still_state_ = safe_(snapshot.still_state);
  this->previous_still_reason_ = safe_(snapshot.still_reason);
  this->previous_range_reason_ = safe_(snapshot.range_reason);
  this->previous_tracker_state_ = safe_(snapshot.tracker_state);
  this->previous_tracker_reason_ = safe_(snapshot.tracker_reason);
  this->has_previous_ = true;
}

std::string DiagnosticLog::to_text() const {
  std::string out;
  out.reserve(this->count() * 180);
  char line[512];
  this->format_text_header(line, sizeof(line));
  out += line;

  for (size_t i = 0; i < this->count(); i++) {
    if (this->format_text_event(i, line, sizeof(line)))
      out += line;
  }
  return out;
}

void DiagnosticLog::format_text_header(char *out, size_t out_size) const {
  if (out == nullptr || out_size == 0)
    return;
  std::snprintf(out, out_size,
                "# presence sensor diagnostic events\n"
                "# retention_ms=86400000 max_events=256 count=%u truncated=%s\n",
                static_cast<unsigned>(this->count()), this->truncated_ ? "true" : "false");
}

bool DiagnosticLog::format_text_event(size_t offset, char *out, size_t out_size) const {
  if (out == nullptr || out_size == 0 || offset >= this->count())
    return false;
  const auto &event = this->event_at_(offset);
  std::snprintf(out, out_size,
                "seq=%lu ms=%lu type=%s reason=%s presence=%u motion=%u pir=%u targets=%d moving=%d still=%d "
                "still_conf=%d still_hold=%u still_state=%s still_reason=%s range=%s range_suspect=%d "
                "range_oob=%d range_remote=%d empty=%d lux=%.0f tracker_presence=%u tracker_motion=%u "
                "exit_active=%u exit_mask=%d exit_targets=%d exit_age=%d "
                "tracker_state=%s tracker_reason=%s tracker_score=%d tracker_input=%d tracker_active=%d "
                "tracker_tentative=%d tracker_confirmed=%d tracker_coasting=%d tracker_moving=%d "
                "tracker_still=%d\n",
                static_cast<unsigned long>(event.sequence), static_cast<unsigned long>(event.ms), event.type,
                event.reason, event.presence ? 1 : 0, event.motion ? 1 : 0, event.pir_motion ? 1 : 0,
                event.target_count, event.moving_target_count, event.still_target_count, event.still_confidence,
                event.still_hold_active ? 1 : 0, event.still_state, event.still_reason, event.range_reason,
                event.range_suspect_count, event.range_out_of_range_count, event.range_remote_candidate_count,
                event.empty_samples, event.illuminance_lux, event.tracker_presence ? 1 : 0,
                event.tracker_motion ? 1 : 0, event.exit_zone_active ? 1 : 0, event.exit_zone_mask,
                event.exit_target_count, event.exit_last_seen_age_ms, event.tracker_state, event.tracker_reason,
                event.tracker_track_score,
                event.tracker_input_detection_count, event.tracker_active_track_count,
                event.tracker_tentative_track_count, event.tracker_confirmed_track_count,
                event.tracker_coasting_track_count, event.tracker_moving_track_count,
                event.tracker_still_track_count);
  return true;
}

void DiagnosticLog::format_json_header(char *out, size_t out_size) const {
  if (out == nullptr || out_size == 0)
    return;
  std::snprintf(out, out_size,
                R"({"ok":true,"data":{"retentionMs":86400000,"maxEvents":256,"count":%u,"truncated":%s,"events":[)",
                static_cast<unsigned>(this->count()), this->truncated_ ? "true" : "false");
}

bool DiagnosticLog::format_json_event(size_t offset, std::string *out) const {
  if (out == nullptr || offset >= this->count())
    return false;
  const auto &event = this->event_at_(offset);
  out->clear();
  out->reserve(640);
  *out += R"({"sequence":)";
  *out += std::to_string(event.sequence);
  *out += R"(,"ms":)";
  *out += std::to_string(event.ms);
  *out += R"(,"type":)";
  append_json_string_(*out, event.type);
  *out += R"(,"reason":)";
  append_json_string_(*out, event.reason);
  *out += R"(,"presence":)";
  *out += event.presence ? "true" : "false";
  *out += R"(,"motion":)";
  *out += event.motion ? "true" : "false";
  *out += R"(,"pirMotion":)";
  *out += event.pir_motion ? "true" : "false";
  *out += R"(,"targetCount":)";
  *out += std::to_string(event.target_count);
  *out += R"(,"movingTargetCount":)";
  *out += std::to_string(event.moving_target_count);
  *out += R"(,"stillTargetCount":)";
  *out += std::to_string(event.still_target_count);
  *out += R"(,"stillConfidence":)";
  *out += std::to_string(event.still_confidence);
  *out += R"(,"stillHoldActive":)";
  *out += event.still_hold_active ? "true" : "false";
  *out += R"(,"emptySamples":)";
  *out += std::to_string(event.empty_samples);
  *out += R"(,"illuminanceLux":)";
  *out += std::to_string(static_cast<int>(event.illuminance_lux));
  *out += R"(,"stillState":)";
  append_json_string_(*out, event.still_state);
  *out += R"(,"stillReason":)";
  append_json_string_(*out, event.still_reason);
  *out += R"(,"rangeReason":)";
  append_json_string_(*out, event.range_reason);
  *out += R"(,"rangeSuspectTargetCount":)";
  *out += std::to_string(event.range_suspect_count);
  *out += R"(,"rangeOutOfRangeTargetCount":)";
  *out += std::to_string(event.range_out_of_range_count);
  *out += R"(,"rangeRemoteCandidateCount":)";
  *out += std::to_string(event.range_remote_candidate_count);
  *out += R"(,"exit":{"active":)";
  *out += event.exit_zone_active ? "true" : "false";
  *out += R"(,"zoneMask":)";
  *out += std::to_string(event.exit_zone_mask);
  *out += R"(,"targetCount":)";
  *out += std::to_string(event.exit_target_count);
  *out += R"(,"lastSeenAgeMs":)";
  if (event.exit_last_seen_age_ms < 0) {
    *out += "null";
  } else {
    *out += std::to_string(event.exit_last_seen_age_ms);
  }
  *out += "}";
  *out += R"(,"tracker":{"presence":)";
  *out += event.tracker_presence ? "true" : "false";
  *out += R"(,"motion":)";
  *out += event.tracker_motion ? "true" : "false";
  *out += R"(,"state":)";
  append_json_string_(*out, event.tracker_state);
  *out += R"(,"reason":)";
  append_json_string_(*out, event.tracker_reason);
  *out += R"(,"trackScore":)";
  *out += std::to_string(event.tracker_track_score);
  *out += R"(,"inputDetectionCount":)";
  *out += std::to_string(event.tracker_input_detection_count);
  *out += R"(,"activeTrackCount":)";
  *out += std::to_string(event.tracker_active_track_count);
  *out += R"(,"tentativeTrackCount":)";
  *out += std::to_string(event.tracker_tentative_track_count);
  *out += R"(,"confirmedTrackCount":)";
  *out += std::to_string(event.tracker_confirmed_track_count);
  *out += R"(,"coastingTrackCount":)";
  *out += std::to_string(event.tracker_coasting_track_count);
  *out += R"(,"movingTrackCount":)";
  *out += std::to_string(event.tracker_moving_track_count);
  *out += R"(,"stillTrackCount":)";
  *out += std::to_string(event.tracker_still_track_count);
  *out += "}";
  *out += "}";
  return true;
}

void DiagnosticLog::format_json_footer(char *out, size_t out_size) const {
  if (out == nullptr || out_size == 0)
    return;
  std::snprintf(out, out_size,
                R"(]},"status":{"code":"%s","severity":"info","detail":{"format":"json","count":%u,"truncated":%s}}})",
                this->count() > 0 ? "debug_events_ready" : "debug_events_empty",
                static_cast<unsigned>(this->count()), this->truncated_ ? "true" : "false");
}

bool DiagnosticLog::ensure_allocated_() {
  if (this->events_ != nullptr)
    return true;
  if (this->allocation_failed_)
    return false;

  this->events_ = static_cast<Event *>(
      heap_caps_calloc(MAX_EVENTS, sizeof(Event), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (this->events_ != nullptr)
    return true;

  this->start_ = 0;
  this->count_ = 0;
  this->truncated_ = false;
  this->has_previous_ = false;
  this->allocation_failed_ = true;
  return false;
}

void DiagnosticLog::append_event_(const char *type, const char *reason, const DiagnosticSnapshot &snapshot) {
  if (!this->ensure_allocated_())
    return;

  this->trim_(snapshot.ms);

  size_t index = 0;
  if (this->count_ < MAX_EVENTS) {
    index = (this->start_ + this->count_) % MAX_EVENTS;
    this->count_++;
  } else {
    index = this->start_;
    this->start_ = (this->start_ + 1) % MAX_EVENTS;
    this->truncated_ = true;
  }

  auto &event = this->events_[index];
  event.sequence = this->next_sequence_++;
  event.ms = snapshot.ms;
  copy_string_(event.type, sizeof(event.type), type);
  copy_string_(event.reason, sizeof(event.reason), reason);
  event.presence = snapshot.presence;
  event.motion = snapshot.motion;
  event.pir_motion = snapshot.pir_motion;
  event.target_count = snapshot.target_count;
  event.moving_target_count = snapshot.moving_target_count;
  event.still_target_count = snapshot.still_target_count;
  event.still_confidence = snapshot.still_confidence;
  event.still_hold_active = snapshot.still_hold_active;
  event.empty_samples = snapshot.empty_samples;
  event.range_suspect_count = snapshot.range_suspect_count;
  event.range_out_of_range_count = snapshot.range_out_of_range_count;
  event.range_remote_candidate_count = snapshot.range_remote_candidate_count;
  event.illuminance_lux = snapshot.illuminance_lux;
  event.exit_zone_active = snapshot.exit_zone_active;
  event.exit_zone_mask = snapshot.exit_zone_mask;
  event.exit_target_count = snapshot.exit_target_count;
  event.exit_last_seen_age_ms = snapshot.exit_last_seen_age_ms;
  event.tracker_presence = snapshot.tracker_presence;
  event.tracker_motion = snapshot.tracker_motion;
  event.tracker_track_score = snapshot.tracker_track_score;
  event.tracker_input_detection_count = snapshot.tracker_input_detection_count;
  event.tracker_active_track_count = snapshot.tracker_active_track_count;
  event.tracker_tentative_track_count = snapshot.tracker_tentative_track_count;
  event.tracker_confirmed_track_count = snapshot.tracker_confirmed_track_count;
  event.tracker_coasting_track_count = snapshot.tracker_coasting_track_count;
  event.tracker_moving_track_count = snapshot.tracker_moving_track_count;
  event.tracker_still_track_count = snapshot.tracker_still_track_count;
  copy_string_(event.tracker_state, sizeof(event.tracker_state), snapshot.tracker_state);
  copy_string_(event.tracker_reason, sizeof(event.tracker_reason), snapshot.tracker_reason);
  copy_string_(event.still_state, sizeof(event.still_state), snapshot.still_state);
  copy_string_(event.still_reason, sizeof(event.still_reason), snapshot.still_reason);
  copy_string_(event.range_reason, sizeof(event.range_reason), snapshot.range_reason);
}

void DiagnosticLog::trim_(uint32_t now_ms) {
  if (this->events_ == nullptr)
    return;
  while (this->count_ > 0) {
    const auto &oldest = this->events_[this->start_];
    if ((now_ms - oldest.ms) <= RETENTION_MS)
      break;
    this->start_ = (this->start_ + 1) % MAX_EVENTS;
    this->count_--;
    this->truncated_ = true;
  }
}

const DiagnosticLog::Event &DiagnosticLog::event_at_(size_t offset) const {
  return this->events_[(this->start_ + offset) % MAX_EVENTS];
}

void DiagnosticLog::copy_string_(char *dst, size_t dst_size, const char *src) {
  if (dst == nullptr || dst_size == 0)
    return;
  const char *value = safe_(src);
  std::strncpy(dst, value, dst_size - 1);
  dst[dst_size - 1] = '\0';
}

const char *DiagnosticLog::safe_(const char *value) {
  return value != nullptr && value[0] != '\0' ? value : "none";
}

void DiagnosticLog::append_json_string_(std::string &out, const char *value) {
  out.push_back('"');
  const char *safe_value = safe_(value);
  for (const char *p = safe_value; *p != '\0'; ++p) {
    const unsigned char ch = static_cast<unsigned char>(*p);
    if (ch == '"' || ch == '\\') {
      out.push_back('\\');
      out.push_back(static_cast<char>(ch));
    } else if (ch < 0x20) {
      char buf[7];
      std::snprintf(buf, sizeof(buf), "\\u%04x", ch);
      out += buf;
    } else {
      out.push_back(static_cast<char>(ch));
    }
  }
  out.push_back('"');
}

}  // namespace radar_api_server
}  // namespace esphome
