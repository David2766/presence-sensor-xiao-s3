#pragma once

#include "device_config_cache.h"
#include "radar_storage.h"
#include "stats_store.h"
#include "esphome/components/web_server_base/web_server_base.h"

namespace esphome {
namespace radar_api_server {

class RadarApiServer;

class SystemHandler {
 public:
  SystemHandler(RadarStorage *storage, DeviceConfigCache *device_config_cache, StatsStore *stats_store,
                RadarApiServer *server)
      : storage_(storage), device_config_cache_(device_config_cache), stats_store_(stats_store), server_(server) {}

  bool can_handle(AsyncWebServerRequest *request) const;
  bool handle(AsyncWebServerRequest *request);

 protected:
  RadarStorage *storage_;
  DeviceConfigCache *device_config_cache_;
  StatsStore *stats_store_;
  RadarApiServer *server_;

  void handle_status_(AsyncWebServerRequest *request);
  void handle_api_key_(AsyncWebServerRequest *request);
  void handle_ha_setup_handoff_(AsyncWebServerRequest *request);
  void handle_reboot_(AsyncWebServerRequest *request);
  void handle_reset_(AsyncWebServerRequest *request);
  bool request_bool_(AsyncWebServerRequest *request, const char *key, bool default_value) const;
  bool reset_api_key_() const;
  bool reset_settings_(bool *api_key_reset, bool *floorplan_reset, bool *device_config_reset) const;
  bool reset_stats_() const;
};

}  // namespace radar_api_server
}  // namespace esphome
