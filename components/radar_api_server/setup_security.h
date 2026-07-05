#pragma once

#include <string>

#include "esphome/components/api/api_server.h"

namespace esphome {
namespace radar_api_server {

const char *api_key_state();

#ifdef USE_API_NOISE
extern const api::psk_t DEMO_API_PSK;

bool psk_equals(const api::psk_t &left, const api::psk_t &right);
std::string encode_base64_psk(const api::psk_t &psk);
bool generate_api_key(api::psk_t *psk);
#endif

}  // namespace radar_api_server
}  // namespace esphome
