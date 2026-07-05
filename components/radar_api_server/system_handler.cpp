#include "system_handler.h"

#include "dashboard_assets.h"
#include "http_response.h"
#include "radar_api_server.h"
#include "setup_security.h"

#include "esphome/components/api/api_server.h"
#include "esphome/components/wifi/wifi_component.h"
#include "esphome/core/application.h"

#include "esp_flash.h"
#include "esp_heap_caps.h"
#include "esp_image_format.h"
#include "esp_mac.h"
#include "esp_netif.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"

#include <cstdio>
#include <cstring>
#include <string>

namespace esphome {
namespace radar_api_server {

namespace {

static const char *const TAG = "radar_system";
static constexpr uint32_t RESET_REBOOT_DELAY_MS = 2500;

std::string json_escape(const char *value) {
  std::string out;
  if (value == nullptr) return out;
  for (const char *p = value; *p != '\0'; ++p) {
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
  return out;
}

}  // namespace

bool SystemHandler::can_handle(AsyncWebServerRequest *request) const {
  char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
  auto url = request->url_to(url_buf);
  if (request->method() == HTTP_GET && url == "/api/system/status")
    return true;
  if (request->method() == HTTP_GET && url == "/api/system/api-key")
    return true;
  if (request->method() == HTTP_POST && url == "/api/system/ha-setup-handoff")
    return true;
  if (request->method() == HTTP_POST && url == "/api/system/reboot")
    return true;
  return request->method() == HTTP_POST && url == "/api/system/reset";
}

bool SystemHandler::handle(AsyncWebServerRequest *request) {
  if (!this->can_handle(request)) return false;
  char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
  auto url = request->url_to(url_buf);
  if (request->method() == HTTP_POST && url == "/api/system/reset") {
    this->handle_reset_(request);
  } else if (request->method() == HTTP_POST && url == "/api/system/reboot") {
    this->handle_reboot_(request);
  } else if (request->method() == HTTP_POST && url == "/api/system/ha-setup-handoff") {
    this->handle_ha_setup_handoff_(request);
  } else if (request->method() == HTTP_GET && url == "/api/system/api-key") {
    this->handle_api_key_(request);
  } else {
    this->handle_status_(request);
  }
  return true;
}

void SystemHandler::handle_reboot_(AsyncWebServerRequest *request) {
  auto *stream = request->beginResponseStream("application/json");
  stream->printf("{\"ok\":true,\"rebootInMs\":%u}", static_cast<unsigned>(RESET_REBOOT_DELAY_MS));
  request->send(stream);
  this->server_->reboot_after(RESET_REBOOT_DELAY_MS);
}

void SystemHandler::handle_api_key_(AsyncWebServerRequest *request) {
#ifdef USE_API_NOISE
  if (api::global_api_server == nullptr) {
    http_response::send_error(request, 503, "api_key_unavailable");
    return;
  }
  const auto &ctx = api::global_api_server->get_noise_ctx();
  if (!ctx.has_psk()) {
    http_response::send_error(request, 404, "api_key_not_set");
    return;
  }
  const auto api_key = json_escape(encode_base64_psk(ctx.get_psk()).c_str());
  auto *stream = request->beginResponseStream("application/json");
  stream->printf("{\"ok\":true,\"apiKey\":\"%s\",\"visibleSeconds\":30}", api_key.c_str());
  request->send(stream);
#else
  http_response::send_error(request, 503, "api_key_unsupported");
#endif
}

void SystemHandler::handle_ha_setup_handoff_(AsyncWebServerRequest *request) {
#ifdef USE_ESP32
  if (wifi::global_wifi_component == nullptr) {
    http_response::send_error(request, 503, "wifi_unavailable");
    return;
  }
  wifi_config_t config{};
  const auto config_err = esp_wifi_get_config(WIFI_IF_STA, &config);
  const auto ssid_len = strnlen(reinterpret_cast<const char *>(config.sta.ssid), sizeof(config.sta.ssid));
  if (config_err != ESP_OK || ssid_len == 0) {
    ESP_LOGE(TAG, "HA setup handoff requested without STA config config=%d ssid_len=%u", static_cast<int>(config_err),
             static_cast<unsigned>(ssid_len));
    http_response::send_error(request, 409, "wifi_not_ready");
    return;
  }
  // User-confirmed handoff: ESP-IDF has validated Wi-Fi, now ESPHome resumes native API ownership.
  ESP_LOGI(TAG, "HA setup handoff accepted, waiting for native API client");
  request->send(200, "application/json", "{\"ok\":true,\"message\":\"ha_setup_handoff_started\",\"waitSeconds\":10}");
  this->server_->handoff_wifi_to_esphome_after(350);
#else
  http_response::send_error(request, 503, "wifi_unsupported");
#endif
}

bool SystemHandler::request_bool_(AsyncWebServerRequest *request, const char *key, bool default_value) const {
  if (request->hasArg(key)) {
    const auto value = request->arg(key);
    return value == "1" || value == "true" || value == "on";
  }

  if (!request->hasArg("data"))
    return default_value;
  const auto body = request->arg("data");
  const std::string true_pattern = std::string("\"") + key + "\":true";
  const std::string false_pattern = std::string("\"") + key + "\":false";
  if (body.find(true_pattern) != std::string::npos)
    return true;
  if (body.find(false_pattern) != std::string::npos)
    return false;
  return default_value;
}

bool SystemHandler::reset_api_key_() const {
#ifdef USE_API_NOISE
  if (api::global_api_server == nullptr) {
    ESP_LOGE(TAG, "API server is not available for API key reset");
    return false;
  }
  if (!api::global_api_server->save_noise_psk(DEMO_API_PSK, true)) {
    ESP_LOGE(TAG, "Failed to reset API key");
    return false;
  }
#else
  ESP_LOGE(TAG, "API key reset requested, but API noise support is not enabled");
  return false;
#endif
  return true;
}

bool SystemHandler::reset_settings_(bool *api_key_reset, bool *floorplan_reset, bool *device_config_reset) const {
  if (!this->reset_api_key_())
    return false;
  if (api_key_reset != nullptr)
    *api_key_reset = true;

  if (!this->storage_->delete_payload(RadarPayloadTarget::CONFIG) ||
      !this->storage_->delete_payload(RadarPayloadTarget::IMAGE)) {
    return false;
  }
  if (floorplan_reset != nullptr)
    *floorplan_reset = true;

  if (!this->storage_->delete_payload(RadarPayloadTarget::DEVICE_CONFIG))
    return false;
  if (device_config_reset != nullptr)
    *device_config_reset = true;

  this->device_config_cache_->clear();
  return true;
}

bool SystemHandler::reset_stats_() const {
  if (!this->storage_->delete_payload(RadarPayloadTarget::STATS))
    return false;
  this->stats_store_->clear();
  return true;
}

void SystemHandler::handle_reset_(AsyncWebServerRequest *request) {
  const bool reset_settings = this->request_bool_(request, "settings", false);
  const bool reset_wifi = this->request_bool_(request, "wifi", false);
  const bool reset_stats = this->request_bool_(request, "stats", false);
  bool api_key_reset = false;
  bool floorplan_reset = false;
  bool device_config_reset = false;
  bool stats_reset = false;
  const bool wifi_reset_scheduled = reset_wifi;

  if (!reset_settings && !reset_wifi && !reset_stats) {
    http_response::send_error(request, 400, "nothing_selected");
    return;
  }

  if (reset_settings) {
    if (!this->reset_settings_(&api_key_reset, &floorplan_reset, &device_config_reset)) {
      http_response::send_error(request, 500, "settings_reset_failed");
      return;
    }
  }

  if (reset_stats) {
    if (!this->reset_stats_()) {
      http_response::send_error(request, 500, "stats_reset_failed");
      return;
    }
    stats_reset = true;
  }

  auto *stream = request->beginResponseStream("application/json");
  stream->printf(
      "{\"ok\":true,\"reset\":{\"settings\":%s,\"wifi\":%s,\"stats\":%s},"
      "\"details\":{\"apiKey\":%s,\"floorplan\":%s,\"deviceConfig\":%s,\"stats\":%s,\"wifiScheduled\":%s},"
      "\"rebootRequired\":%s,\"rebootInMs\":%u}",
      reset_settings ? "true" : "false", reset_wifi ? "true" : "false", reset_stats ? "true" : "false",
      api_key_reset ? "true" : "false", floorplan_reset ? "true" : "false",
      device_config_reset ? "true" : "false", stats_reset ? "true" : "false",
      wifi_reset_scheduled ? "true" : "false",
      (reset_settings || reset_wifi) ? "true" : "false",
      static_cast<unsigned>(RESET_REBOOT_DELAY_MS));
  request->send(stream);

  if (reset_wifi) {
    this->server_->reset_wifi_credentials_and_reboot_after(RESET_REBOOT_DELAY_MS);
  } else if (reset_settings) {
    this->server_->reboot_after(RESET_REBOOT_DELAY_MS);
  }
}

void SystemHandler::handle_status_(AsyncWebServerRequest *request) {
  const auto storage_status = this->storage_->status();

  wifi_ap_record_t ap_info{};
  const bool wifi_connected = esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK;
  const std::string ssid = wifi_connected ? json_escape(reinterpret_cast<const char *>(ap_info.ssid)) : "";
  const int rssi = wifi_connected ? static_cast<int>(ap_info.rssi) : 0;
  uint8_t mac[6] = {0, 0, 0, 0, 0, 0};
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char mac_buf[18];
  char device_suffix[7];
  std::snprintf(mac_buf, sizeof(mac_buf), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4],
                mac[5]);
  std::snprintf(device_suffix, sizeof(device_suffix), "%02x%02x%02x", mac[3], mac[4], mac[5]);
  char device_name_suffix[7];
  std::snprintf(device_name_suffix, sizeof(device_name_suffix), "%02X%02X%02X", mac[3], mac[4], mac[5]);
  const std::string device_id = std::string("presence-sensor-") + device_suffix;
  const std::string device_name = std::string("Presence Sensor ") + device_name_suffix;
  const std::string host_name = App.get_name() + ".local";
  char ip_buf[16] = "";
  auto *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
  esp_netif_ip_info_t ip_info{};
  if (sta_netif != nullptr && esp_netif_get_ip_info(sta_netif, &ip_info) == ESP_OK && ip_info.ip.addr != 0) {
    std::snprintf(ip_buf, sizeof(ip_buf), IPSTR, IP2STR(&ip_info.ip));
  }

  const uint32_t free_heap = esp_get_free_heap_size();
  const uint32_t min_free_heap = esp_get_minimum_free_heap_size();
  const size_t internal_total = heap_caps_get_total_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  const size_t internal_free = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  const size_t internal_min_free = heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  const size_t psram_total = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
  const size_t psram_free = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
  const int64_t uptime_seconds = esp_timer_get_time() / 1000000LL;
  constexpr int64_t BOOT_GUARD_SECONDS = 60;
  const bool boot_guard_active = uptime_seconds < BOOT_GUARD_SECONDS;
#ifdef USE_API
  const bool api_connected = api::global_api_server != nullptr && api::global_api_server->is_connected();
  const bool api_warning = api::global_api_server != nullptr && api::global_api_server->status_has_warning();
#else
  const bool api_connected = false;
  const bool api_warning = false;
#endif
  uint32_t flash_total = 0;
  if (esp_flash_get_size(nullptr, &flash_total) != ESP_OK) {
    flash_total = 0;
  }

  const esp_partition_t *running_partition = esp_ota_get_running_partition();
  const esp_partition_t *next_ota_partition = esp_ota_get_next_update_partition(running_partition);
  uint32_t firmware_slot_size = running_partition != nullptr ? running_partition->size : 0;
  uint32_t ota_slot_size = next_ota_partition != nullptr ? next_ota_partition->size : 0;
  uint32_t firmware_used_size = 0;
  if (running_partition != nullptr) {
    esp_partition_pos_t running_pos{};
    running_pos.offset = running_partition->address;
    running_pos.size = running_partition->size;
    esp_image_metadata_t metadata{};
    if (esp_image_get_metadata(&running_pos, &metadata) == ESP_OK) {
      firmware_used_size = metadata.image_len;
    }
  }

  auto *stream = request->beginResponseStream("application/json");
  stream->printf(
        "{\"ok\":true,"
        "\"device\":{\"type\":\"presence-sensor\",\"id\":\"%s\",\"name\":\"%s\",\"dashboardPath\":\"/dashboard\"},"
        "\"network\":{\"ip\":\"%s\",\"mac\":\"%s\",\"host\":\"%s\"},"
        "\"firmware\":{\"version\":\"%s\",\"buildTime\":\"%s %s\",\"uptimeSeconds\":%lld},"
        "\"api\":{\"connected\":%s,\"warning\":%s},"
        "\"boot\":{\"initialGuardActive\":%s,\"guardSeconds\":%lld},"
        "\"dashboard\":{\"version\":\"%s\",\"gzipBytes\":%u},"
        "\"schema\":{\"config\":%d,\"floorplan\":%d,\"stats\":%d},"
        "\"memory\":{\"freeHeap\":%u,\"minFreeHeap\":%u,"
        "\"internalTotalBytes\":%u,\"internalFreeBytes\":%u,\"internalMinFreeBytes\":%u,"
        "\"psramTotal\":%u,\"psramFree\":%u,\"externalTotalBytes\":%u,\"externalFreeBytes\":%u},"
        "\"flash\":{\"totalBytes\":%u,\"firmwareUsedBytes\":%u,\"firmwareSlotBytes\":%u,"
        "\"otaSlotBytes\":%u,\"storageUsedBytes\":%u,\"storageTotalBytes\":%u},"
        "\"storage\":{\"ok\":%s,\"partition\":\"%s\",\"totalBytes\":%u,\"usedBytes\":%u,"
        "\"floorplanConfigBytes\":%u,\"floorplanImageBytes\":%u,\"deviceConfigBytes\":%u,\"statsBytes\":%u,"
        "\"maxPayloadBytes\":%u},"
        "\"wifi\":{\"connected\":%s,\"ssid\":\"%s\",\"rssi\":%d},"
        "\"bluetooth\":{\"enabled\":true,\"connected\":false}}",
        device_id.c_str(), device_name.c_str(), ip_buf, mac_buf, host_name.c_str(), dashboard_assets::FIRMWARE_VERSION,
        __DATE__, __TIME__, static_cast<long long>(uptime_seconds),
        api_connected ? "true" : "false", api_warning ? "true" : "false",
        boot_guard_active ? "true" : "false", static_cast<long long>(BOOT_GUARD_SECONDS),
        dashboard_assets::DASHBOARD_VERSION, static_cast<unsigned>(dashboard_assets::DASHBOARD_TOTAL_GZ_SIZE),
        dashboard_assets::CONFIG_SCHEMA_VERSION, dashboard_assets::FLOORPLAN_SCHEMA_VERSION,
        dashboard_assets::STATS_SCHEMA_VERSION, static_cast<unsigned>(free_heap), static_cast<unsigned>(min_free_heap),
        static_cast<unsigned>(internal_total), static_cast<unsigned>(internal_free), static_cast<unsigned>(internal_min_free),
        static_cast<unsigned>(psram_total), static_cast<unsigned>(psram_free), static_cast<unsigned>(psram_total),
        static_cast<unsigned>(psram_free), static_cast<unsigned>(flash_total),
        static_cast<unsigned>(firmware_used_size), static_cast<unsigned>(firmware_slot_size),
        static_cast<unsigned>(ota_slot_size), static_cast<unsigned>(storage_status.used_bytes),
        static_cast<unsigned>(storage_status.total_bytes), storage_status.ok ? "true" : "false",
        storage_status.partition_label, static_cast<unsigned>(storage_status.total_bytes),
        static_cast<unsigned>(storage_status.used_bytes), static_cast<unsigned>(storage_status.header.config_size),
        static_cast<unsigned>(storage_status.header.image_size), static_cast<unsigned>(storage_status.header.reserved[0]),
        static_cast<unsigned>(storage_status.header.reserved[1]),
        static_cast<unsigned>(this->storage_->payload_max_size(RadarPayloadTarget::DEVICE_CONFIG)),
        wifi_connected ? "true" : "false", ssid.c_str(), rssi);
  request->send(stream);
}

}  // namespace radar_api_server
}  // namespace esphome
