#pragma once

#include "esphome/components/web_server_base/web_server_base.h"

#include <cstddef>
#include <cstdint>

namespace esphome {
namespace radar_api_server {
namespace http_response {

void send_gzip_asset(AsyncWebServerRequest *request, const char *content_type, const uint8_t *data, size_t size);
void send_json(AsyncWebServerRequest *request, int code, const char *json);
void send_error(AsyncWebServerRequest *request, int code, const char *message);
void send_error_info(AsyncWebServerRequest *request, int http_code, const char *code, const char *severity);
void send_error_info(AsyncWebServerRequest *request, int http_code, const char *code, const char *severity,
                     const char *detail_json);
void send_error_info(AsyncWebServerRequest *request, int http_code, const char *legacy_error, const char *info_code,
                     const char *severity, const char *detail_json);

}  // namespace http_response
}  // namespace radar_api_server
}  // namespace esphome
