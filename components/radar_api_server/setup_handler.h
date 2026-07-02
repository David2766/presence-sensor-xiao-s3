#pragma once

#include "esphome/components/web_server_base/web_server_base.h"

namespace esphome {
namespace radar_api_server {

class RadarApiServer;

class SetupHandler {
 public:
  explicit SetupHandler(RadarApiServer *server) : server_(server) {}

  bool can_handle(AsyncWebServerRequest *request) const;
  bool handle(AsyncWebServerRequest *request);

 protected:
  void handle_root_(AsyncWebServerRequest *request) const;
  void handle_setup_page_(AsyncWebServerRequest *request) const;
  void handle_status_(AsyncWebServerRequest *request) const;
  void handle_networks_(AsyncWebServerRequest *request) const;
  void handle_scan_(AsyncWebServerRequest *request) const;
  void handle_wifi_save_(AsyncWebServerRequest *request) const;

  RadarApiServer *server_;
};

}  // namespace radar_api_server
}  // namespace esphome
