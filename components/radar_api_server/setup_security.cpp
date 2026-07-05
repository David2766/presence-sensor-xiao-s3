#include "setup_security.h"

#include "esphome/core/helpers.h"

#include <algorithm>
#include <cstdint>

namespace esphome {
namespace radar_api_server {

#ifdef USE_API_NOISE
const api::psk_t DEMO_API_PSK = {'D', 'E', 'M', 'O', '_', 'O', 'N', 'L', 'Y', '_', 'N', 'O', 'T', '_', 'S', 'E',
                                 'C', 'U', 'R', 'E', '_', 'A', 'P', 'I', '_', 'K', 'E', 'Y', '!', '!', '!', '!'};

bool psk_equals(const api::psk_t &left, const api::psk_t &right) {
  return std::equal(left.begin(), left.end(), right.begin());
}

std::string encode_base64_psk(const api::psk_t &psk) {
  static const char TABLE[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve(44);
  for (size_t index = 0; index < psk.size(); index += 3) {
    const uint32_t b0 = psk[index];
    const uint32_t b1 = index + 1 < psk.size() ? psk[index + 1] : 0;
    const uint32_t b2 = index + 2 < psk.size() ? psk[index + 2] : 0;
    const uint32_t triple = (b0 << 16) | (b1 << 8) | b2;
    out.push_back(TABLE[(triple >> 18) & 0x3F]);
    out.push_back(TABLE[(triple >> 12) & 0x3F]);
    out.push_back(index + 1 < psk.size() ? TABLE[(triple >> 6) & 0x3F] : '=');
    out.push_back(index + 2 < psk.size() ? TABLE[triple & 0x3F] : '=');
  }
  return out;
}

const char *api_key_state() {
  if (api::global_api_server == nullptr)
    return "unavailable";
  const auto &ctx = api::global_api_server->get_noise_ctx();
  if (!ctx.has_psk())
    return "none";
  return psk_equals(ctx.get_psk(), DEMO_API_PSK) ? "demo" : "custom";
}

bool generate_api_key(api::psk_t *psk) {
  if (psk == nullptr)
    return false;
  return random_bytes(psk->data(), psk->size());
}
#else
const char *api_key_state() { return "unsupported"; }
#endif

}  // namespace radar_api_server
}  // namespace esphome
