#pragma once

#include <cstddef>
#include <cstring>

namespace esphome {
namespace radar_api_server {

struct TimezoneDefinition {
  const char *id;
  const char *posix;
};

inline constexpr TimezoneDefinition TIMEZONE_DEFINITIONS[] = {
    {"UTC", "UTC0"},
    {"Pacific/Honolulu", "HST10"},
    {"America/Anchorage", "AKST9AKDT,M3.2.0,M11.1.0"},
    {"America/Los_Angeles", "PST8PDT,M3.2.0,M11.1.0"},
    {"America/Denver", "MST7MDT,M3.2.0,M11.1.0"},
    {"America/Chicago", "CST6CDT,M3.2.0,M11.1.0"},
    {"America/New_York", "EST5EDT,M3.2.0,M11.1.0"},
    {"America/Sao_Paulo", "<-03>3"},
    {"Europe/London", "GMT0BST,M3.5.0/1,M10.5.0"},
    {"Europe/Berlin", "CET-1CEST,M3.5.0,M10.5.0/3"},
    {"Africa/Johannesburg", "SAST-2"},
    {"Asia/Dubai", "<+04>-4"},
    {"Asia/Kolkata", "IST-5:30"},
    {"Asia/Bangkok", "<+07>-7"},
    {"Asia/Shanghai", "CST-8"},
    {"Asia/Seoul", "KST-9"},
    {"Asia/Tokyo", "JST-9"},
    {"Australia/Perth", "AWST-8"},
    {"Australia/Sydney", "AEST-10AEDT,M10.1.0,M4.1.0/3"},
    {"Pacific/Auckland", "NZST-12NZDT,M9.5.0,M4.1.0/3"},
};

inline const TimezoneDefinition *find_timezone(const char *id) {
  if (id == nullptr)
    return nullptr;
  for (const auto &definition : TIMEZONE_DEFINITIONS) {
    if (std::strcmp(definition.id, id) == 0)
      return &definition;
  }
  return nullptr;
}

inline bool is_supported_timezone(const char *id) { return find_timezone(id) != nullptr; }

inline const char *timezone_posix(const char *id) {
  const auto *definition = find_timezone(id);
  return definition == nullptr ? nullptr : definition->posix;
}

}  // namespace radar_api_server
}  // namespace esphome
