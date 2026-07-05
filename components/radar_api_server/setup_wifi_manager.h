#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace esphome {
namespace radar_api_server {

enum class SetupWifiStage {
  IDLE,
  READY,
  CONNECTING,
  CONNECTED,
  FAILED,
};

struct NetworkInfo {
  std::string ssid;
  int rssi{0};
  bool locked{false};
};

extern SetupWifiStage setup_wifi_stage;
extern std::string setup_wifi_ssid;
extern std::string setup_wifi_psk;
extern std::string setup_wifi_connected_ip;
extern uint32_t setup_wifi_started_ms;
extern uint32_t setup_wifi_connected_ms;
extern uint8_t setup_wifi_disconnect_count;
extern bool setup_wifi_credentials_saved;
extern bool setup_network_scan_running;
extern std::string setup_network_scan_reason;
extern std::vector<NetworkInfo> setup_network_cache;
extern uint32_t setup_network_cache_ms;
extern bool setup_network_cache_ready;

void reset_setup_wifi_state_();
const char *setup_wifi_stage_to_string(SetupWifiStage stage);
void ensure_setup_wifi_events_registered();
bool wifi_connected();
bool setup_mode_active();
std::string wifi_sta_ip_address();
bool cached_network_is_open_(const std::string &ssid);
bool start_setup_network_scan_from_idf_(const char *reason, bool disconnect_first);
bool finish_setup_network_scan_from_idf_(const char *reason);
void pause_setup_sta_now_();
void persist_setup_wifi_credentials_();

}  // namespace radar_api_server
}  // namespace esphome
