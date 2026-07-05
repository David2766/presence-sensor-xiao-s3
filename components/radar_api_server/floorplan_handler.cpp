#include "floorplan_handler.h"

#include "http_response.h"

#include <cctype>
#include <cstdlib>
#include <esp_http_server.h>

namespace esphome {
namespace radar_api_server {

bool FloorplanHandler::can_handle(AsyncWebServerRequest *request) const {
  char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
  auto url = request->url_to(url_buf);

  if (request->method() == HTTP_GET) {
    return url == "/api/floorplan/status" || url == "/api/floorplan" || url == "/api/floorplan/image";
  }

  if (request->method() == HTTP_POST) {
    return url == "/api/floorplan" || url == "/api/floorplan/image" || url == "/api/floorplan/upload/start" ||
           url == "/api/floorplan/upload/chunk" || url == "/api/floorplan/upload/commit" ||
           url == "/api/floorplan/delete";
  }

  return false;
}

bool FloorplanHandler::handle(AsyncWebServerRequest *request) {
  if (!this->can_handle(request))
    return false;

  char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
  auto url = request->url_to(url_buf);

  if (request->method() == HTTP_GET) {
    if (url == "/api/floorplan/status") {
      this->handle_status_(request);
      return true;
    }
    if (url == "/api/floorplan") {
      this->handle_get_payload_(request, RadarPayloadTarget::CONFIG, "application/json", "config_not_found",
                                "config_read_failed");
      return true;
    }
    if (url == "/api/floorplan/image") {
      this->handle_get_payload_(request, RadarPayloadTarget::IMAGE, "image/webp", "image_not_found",
                                "image_read_failed");
      return true;
    }
  }

  if (request->method() == HTTP_POST) {
    if (url == "/api/floorplan") {
      this->handle_post_payload_(request, RadarPayloadTarget::CONFIG, "config_write_failed");
      return true;
    }
    if (url == "/api/floorplan/image") {
      this->handle_post_image_(request);
      return true;
    }
    if (url == "/api/floorplan/upload/start") {
      this->handle_upload_start_(request);
      return true;
    }
    if (url == "/api/floorplan/upload/chunk") {
      this->handle_upload_chunk_(request);
      return true;
    }
    if (url == "/api/floorplan/upload/commit") {
      this->handle_upload_commit_(request);
      return true;
    }
    if (url == "/api/floorplan/delete") {
      this->handle_delete_storage_(request);
      return true;
    }
  }

  return false;
}

void FloorplanHandler::handle_status_(AsyncWebServerRequest *request) {
  const auto status = this->storage_->status();
  const auto &header = status.header;

  auto *stream = request->beginResponseStream("application/json");
  stream->printf(
      R"({"ok":%s,"storage":"raw-partition","partition":"%s","hasConfig":%s,"hasImage":%s,"totalBytes":%u,"usedBytes":%u,"configBytes":%u,"imageBytes":%u,"uploadTarget":%u,"uploadSize":%u,"uploadWritten":%u})",
      status.ok ? "true" : "false", status.partition_label, header.config_size > 0 ? "true" : "false",
      header.image_size > 0 ? "true" : "false", static_cast<unsigned>(status.total_bytes),
      static_cast<unsigned>(status.used_bytes), static_cast<unsigned>(header.config_size),
      static_cast<unsigned>(header.image_size), static_cast<unsigned>(header.upload_target),
      static_cast<unsigned>(header.upload_size), static_cast<unsigned>(header.upload_written));
  request->send(stream);
}

void FloorplanHandler::handle_get_payload_(AsyncWebServerRequest *request, RadarPayloadTarget target,
                                              const char *content_type, const char *not_found_error,
                                              const char *read_error) {
  std::string data;
  if (!this->storage_->read_payload(target, &data)) {
    http_response::send_error(request, 404, not_found_error);
    return;
  }

  httpd_resp_set_type(*request, content_type);
  httpd_resp_set_hdr(*request, "Access-Control-Allow-Origin", "*");
  if (httpd_resp_send(*request, data.data(), data.size()) != ESP_OK) {
    http_response::send_error(request, 500, read_error);
    return;
  }
}

void FloorplanHandler::handle_post_payload_(AsyncWebServerRequest *request, RadarPayloadTarget target,
                                               const char *write_error) {
  if (!request->hasArg("data")) {
    http_response::send_error(request, 400, "missing_data");
    return;
  }

  const std::string data = request->arg("data");
  if (!this->storage_->write_payload(target, reinterpret_cast<const uint8_t *>(data.data()), data.size())) {
    http_response::send_error(request, 500, write_error);
    return;
  }

  http_response::send_json(request, 200, R"({"ok":true})");
}

void FloorplanHandler::handle_post_image_(AsyncWebServerRequest *request) {
  if (!request->hasArg("data")) {
    http_response::send_error(request, 400, "missing_data");
    return;
  }

  std::string decoded;
  if (!this->decode_hex_(request->arg("data"), &decoded)) {
    http_response::send_error(request, 400, "invalid_hex");
    return;
  }

  if (!this->storage_->write_payload(RadarPayloadTarget::IMAGE, reinterpret_cast<const uint8_t *>(decoded.data()),
                                     decoded.size())) {
    http_response::send_error(request, 500, "image_write_failed");
    return;
  }

  http_response::send_json(request, 200, R"({"ok":true})");
}

void FloorplanHandler::handle_upload_start_(AsyncWebServerRequest *request) {
  RadarPayloadTarget target{};
  if (!this->parse_floorplan_target_(request, &target)) {
    http_response::send_error(request, 400, "invalid_target");
    return;
  }
  uint32_t session_id = 0;
  if (!this->parse_upload_session_(request, &session_id)) {
    http_response::send_error(request, 400, "invalid_session");
    return;
  }
  if (!request->hasArg("size")) {
    http_response::send_error(request, 400, "missing_size");
    return;
  }

  const uint32_t size = std::strtoul(request->arg("size").c_str(), nullptr, 10);
  if (size == 0 || size > this->storage_->payload_max_size(target)) {
    http_response::send_error(request, 413, "payload_too_large");
    return;
  }

  if (!this->storage_->start_upload(target, size, session_id)) {
    http_response::send_error(request, 500, "erase_failed");
    return;
  }

  http_response::send_json(request, 200, R"({"ok":true})");
}

void FloorplanHandler::handle_upload_chunk_(AsyncWebServerRequest *request) {
  RadarPayloadTarget target{};
  if (!this->parse_floorplan_target_(request, &target)) {
    http_response::send_error(request, 400, "invalid_target");
    return;
  }
  if (!request->hasArg("offset") || !request->hasArg("data")) {
    http_response::send_error(request, 400, "missing_chunk");
    return;
  }
  uint32_t session_id = 0;
  if (!this->parse_upload_session_(request, &session_id)) {
    http_response::send_error(request, 400, "invalid_session");
    return;
  }

  const uint32_t offset = std::strtoul(request->arg("offset").c_str(), nullptr, 10);
  std::string decoded;
  if (!this->decode_hex_(request->arg("data"), &decoded)) {
    http_response::send_error(request, 400, "invalid_hex");
    return;
  }

  if (!this->storage_->write_upload_chunk(target, offset, reinterpret_cast<const uint8_t *>(decoded.data()),
                                          decoded.size(), session_id)) {
    http_response::send_error(request, 500, "chunk_write_failed");
    return;
  }

  http_response::send_json(request, 200, R"({"ok":true})");
}

void FloorplanHandler::handle_upload_commit_(AsyncWebServerRequest *request) {
  RadarPayloadTarget target{};
  if (!this->parse_floorplan_target_(request, &target)) {
    http_response::send_error(request, 400, "invalid_target");
    return;
  }
  uint32_t session_id = 0;
  if (!this->parse_upload_session_(request, &session_id)) {
    http_response::send_error(request, 400, "invalid_session");
    return;
  }

  if (!this->storage_->commit_upload(target, session_id)) {
    http_response::send_error(request, 409, "upload_incomplete");
    return;
  }

  http_response::send_json(request, 200, R"({"ok":true})");
}

void FloorplanHandler::handle_delete_storage_(AsyncWebServerRequest *request) {
  if (!request->hasArg("confirm") || request->arg("confirm") != "1") {
    http_response::send_error(request, 400, "missing_confirm");
    return;
  }

  if (!this->storage_->delete_floorplan()) {
    http_response::send_error(request, 500, "delete_failed");
    return;
  }

  http_response::send_json(request, 200, R"({"ok":true})");
}

bool FloorplanHandler::parse_floorplan_target_(AsyncWebServerRequest *request, RadarPayloadTarget *target) const {
  if (!request->hasArg("target") || !this->storage_->parse_target(request->arg("target"), target))
    return false;
  return *target == RadarPayloadTarget::CONFIG || *target == RadarPayloadTarget::IMAGE;
}

bool FloorplanHandler::parse_upload_session_(AsyncWebServerRequest *request, uint32_t *session_id) const {
  if (!request->hasArg("session"))
    return false;
  const uint32_t parsed = std::strtoul(request->arg("session").c_str(), nullptr, 0);
  if (parsed == 0)
    return false;
  *session_id = parsed;
  return true;
}

bool FloorplanHandler::decode_hex_(const std::string &hex, std::string *out) const {
  if ((hex.size() % 2) != 0)
    return false;

  out->clear();
  out->reserve(hex.size() / 2);
  for (size_t i = 0; i < hex.size(); i += 2) {
    char pair[3] = {hex[i], hex[i + 1], '\0'};
    if (!std::isxdigit(static_cast<unsigned char>(pair[0])) ||
        !std::isxdigit(static_cast<unsigned char>(pair[1])))
      return false;
    out->push_back(static_cast<char>(std::strtoul(pair, nullptr, 16)));
  }
  return true;
}

}  // namespace radar_api_server
}  // namespace esphome
