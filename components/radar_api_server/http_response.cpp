#include "http_response.h"

#include <string>

namespace esphome {
namespace radar_api_server {
namespace http_response {

void send_gzip_asset(AsyncWebServerRequest *request, const char *content_type, const uint8_t *data, size_t size) {
  auto *response = request->beginResponse(200, content_type, data, size);
  response->addHeader("Content-Encoding", "gzip");
  response->addHeader("Cache-Control", "no-store");
  request->send(response);
}

void send_json(AsyncWebServerRequest *request, int code, const char *json) {
  request->send(code, "application/json", json);
}

void send_error(AsyncWebServerRequest *request, int code, const char *message) {
  std::string body = R"({"ok":false,"error":")";
  body += message;
  body += R"("})";
  auto *response = request->beginResponse(code, "application/json", body);
  request->send(response);
}

void send_error_info(AsyncWebServerRequest *request, int http_code, const char *code, const char *severity) {
  send_error_info(request, http_code, code, severity, "{}");
}

void send_error_info(AsyncWebServerRequest *request, int http_code, const char *code, const char *severity,
                     const char *detail_json) {
  send_error_info(request, http_code, code, code, severity, detail_json);
}

void send_error_info(AsyncWebServerRequest *request, int http_code, const char *legacy_error, const char *info_code,
                     const char *severity, const char *detail_json) {
  std::string body = R"({"ok":false,"error":")";
  body += legacy_error;
  body += R"(","errorInfo":{"code":")";
  body += info_code;
  body += R"(","severity":")";
  body += severity;
  body += R"(","detail":)";
  body += detail_json != nullptr ? detail_json : "{}";
  body += R"(}})";
  auto *response = request->beginResponse(http_code, "application/json", body);
  request->send(response);
}

}  // namespace http_response
}  // namespace radar_api_server
}  // namespace esphome
