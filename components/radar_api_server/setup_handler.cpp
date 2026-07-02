#include "setup_handler.h"

#include "radar_api_server.h"

#include "esphome/components/wifi/wifi_component.h"
#include "esphome/core/application.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"

#include <algorithm>
#include <cstdio>
#include <string>
#include <vector>

namespace esphome {
namespace radar_api_server {

namespace {

static const char *const TAG = "radar_setup";

std::string json_escape(const char *value) {
  std::string out;
  if (value == nullptr)
    return out;
  for (const char *p = value; *p != '\0'; ++p) {
    const unsigned char ch = static_cast<unsigned char>(*p);
    if (ch == '"' || ch == '\\') {
      out.push_back('\\');
      out.push_back(static_cast<char>(ch));
    } else if (ch == '\n') {
      out += "\\n";
    } else if (ch == '\r') {
      out += "\\r";
    } else if (ch == '\t') {
      out += "\\t";
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

std::string json_escape(const std::string &value) { return json_escape(value.c_str()); }

bool wifi_connected() {
  return wifi::global_wifi_component != nullptr && wifi::global_wifi_component->is_connected();
}

bool setup_mode_active() {
  return wifi::global_wifi_component != nullptr && wifi::global_wifi_component->is_ap_active() && !wifi_connected();
}

struct NetworkInfo {
  std::string ssid;
  int rssi{0};
  bool locked{false};
};

const char SETUP_PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Presence Sensor 설정</title>
<style>
:root{color-scheme:dark;--bg:#0b1117;--panel:#101923;--panel2:#152330;--text:#e8f0f6;--muted:#91a4b5;--line:#263849;--accent:#19b394;--danger:#e45757}
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;background:linear-gradient(180deg,#0b1117,#0e161e);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);display:flex;align-items:center;justify-content:center;padding:clamp(14px,4vw,28px)}
.wrap{width:min(520px,100%)}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.eyebrow{font-size:13px;color:var(--accent);font-weight:700;margin:0 0 8px}.title{font-size:25px;line-height:1.2;font-weight:800;margin:0 0 8px}.desc{font-size:14px;line-height:1.55;color:var(--muted);margin:0 0 18px}
.notice{margin:0 0 16px;padding:12px 13px;border:1px solid rgba(25,179,148,.28);border-radius:12px;background:rgba(25,179,148,.08);color:#b8f1e4;font-size:13px;line-height:1.45}
.status{display:grid;grid-template-columns:1fr auto;gap:8px 14px;margin:0 0 18px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0d151d}.status span{font-size:13px;color:var(--muted)}.status b{font-size:13px;text-align:right}
label{display:block;font-size:13px;color:var(--muted);margin:14px 0 7px}.networks{display:grid;gap:8px;margin:8px 0 8px;max-height:36dvh;overflow-y:auto;overflow-x:hidden;padding-right:2px}.net{width:100%;max-width:100%;min-width:0;min-height:50px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;text-align:left;font:inherit}.net span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.net.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.net small{color:var(--muted);flex:0 0 auto;white-space:nowrap}.net-more{display:none;width:100%;max-width:100%;height:42px;margin:0 0 12px;border:1px dashed var(--line);border-radius:12px;background:transparent;color:var(--accent);font:inherit;font-weight:750}.net-more.visible{display:block}
input{width:100%;height:46px;border-radius:12px;border:1px solid var(--line);background:#0d151d;color:var(--text);padding:0 13px;font-size:16px}input:focus{outline:2px solid rgba(25,179,148,.35);border-color:var(--accent)}
.actions{display:flex;gap:10px;margin-top:16px}.btn{border:0;border-radius:12px;height:46px;padding:0 16px;font-size:15px;font-weight:750;color:#07110f;background:var(--accent);flex:1}.btn.secondary{background:#1a2a38;color:var(--text);border:1px solid var(--line);flex:0 0 auto}.btn:disabled{opacity:.55}
.message{min-height:22px;margin-top:13px;font-size:14px;color:var(--muted);line-height:1.45}.message.error{color:#ff9b9b}.message.ok{color:#7de2c8}
@media (min-width:641px) and (max-width:1024px){.wrap{width:min(560px,100%)}.card{padding:24px}.networks{max-height:42dvh}}
@media (max-width:640px){body{align-items:flex-start;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}.wrap{width:100%}.card{border-radius:14px;padding:16px;box-shadow:0 10px 28px rgba(0,0,0,.28)}.title{font-size:22px}.desc{font-size:13px;margin-bottom:14px}.notice{font-size:12.5px;padding:11px 12px}.status{grid-template-columns:minmax(0,1fr) auto;padding:12px;gap:7px 10px}.status b{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.networks{max-height:34dvh}.net{min-height:54px;padding:13px 12px}.net small{font-size:12px}.net-more{height:46px}.actions{flex-direction:column-reverse}.btn,.btn.secondary{width:100%;flex:0 0 auto;height:48px}.message{font-size:13px}}
</style>
</head>
<body>
<main class="wrap">
  <section class="card">
    <p class="eyebrow">초기 Wi-Fi 설정</p>
    <h1 class="title" id="deviceName">Presence Sensor</h1>
    <p class="desc">연결할 Wi-Fi를 선택하고 비밀번호를 입력하세요. 설정이 완료되면 기기가 새 네트워크로 이동합니다.</p>
    <div class="notice">이 Wi-Fi는 인터넷이 없는 설정용 네트워크입니다. 휴대폰이나 PC가 연결 해제를 묻는 경우 연결 유지를 선택하세요.</div>
    <div class="status">
      <span>상태</span><b id="stateText">확인 중</b>
      <span>설정 주소</span><b>192.168.4.1</b>
    </div>
    <label>Wi-Fi 목록</label>
    <div class="networks" id="networks"><div class="message">주변 Wi-Fi를 찾는 중입니다.</div></div>
    <button class="net-more" id="networkToggle" type="button"></button>
    <label for="password">비밀번호</label>
    <input id="password" type="password" autocomplete="current-password" placeholder="Wi-Fi 비밀번호">
    <div class="actions">
      <button class="btn secondary" id="refresh" type="button">새로고침</button>
      <button class="btn" id="connect" type="button" disabled>연결하기</button>
    </div>
    <div class="message" id="message"></div>
  </section>
</main>
<script>
const $=id=>document.getElementById(id);let selected='',allNetworks=[],networksExpanded=false;
function msg(text,type=''){const el=$('message');el.textContent=text;el.className='message '+type}
function bars(rssi){if(rssi>=-55)return '강함';if(rssi>=-70)return '보통';return '약함'}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderNetworks(){const box=$('networks');const toggle=$('networkToggle');box.innerHTML='';const shown=networksExpanded?allNetworks:allNetworks.slice(0,5);shown.forEach(n=>{const b=document.createElement('button');b.type='button';b.className='net'+(n.ssid===selected?' selected':'');b.innerHTML='<span>'+esc(n.ssid)+'</span><small>'+(n.locked?'잠금 · ':'')+bars(n.rssi)+' · '+n.rssi+'dBm</small>';b.onclick=()=>{selected=n.ssid;document.querySelectorAll('.net').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('connect').disabled=false;msg('')};box.appendChild(b)});if(allNetworks.length>5){toggle.textContent=networksExpanded?'접기':'더 보기 '+(allNetworks.length-5)+'개';toggle.classList.add('visible');toggle.onclick=()=>{networksExpanded=!networksExpanded;renderNetworks()}}else{toggle.classList.remove('visible');toggle.onclick=null;toggle.textContent=''}}
async function loadStatus(){try{const s=await fetch('/api/setup/status',{cache:'no-store'}).then(r=>r.json());$('deviceName').textContent=s.device?.name||'Presence Sensor';$('stateText').textContent=s.wifi?.connected?'연결됨':'설정 대기'}catch(e){$('stateText').textContent='설정 대기'}}
async function loadNetworks(){const box=$('networks');const hadList=box.querySelector('.net,.net-more');if(!hadList)box.innerHTML='<div class="message">주변 Wi-Fi를 찾는 중입니다.</div>';try{const data=await fetch('/api/setup/networks',{cache:'no-store'}).then(r=>r.json());allNetworks=(data.networks||[]).filter(n=>n.ssid).sort((a,b)=>(b.rssi??-999)-(a.rssi??-999));if(!allNetworks.length){if(!hadList)box.innerHTML='<div class="message">검색된 Wi-Fi가 없습니다. 새로고침을 눌러 다시 검색하세요.</div>';return}if(!allNetworks.some(n=>n.ssid===selected)){selected='';$('connect').disabled=true}renderNetworks()}catch(e){msg('Wi-Fi 목록을 불러오지 못했습니다. 새로고침을 다시 눌러주세요.','error')}}
async function refreshNetworks(){msg('주변 Wi-Fi를 다시 검색합니다.','');$('refresh').disabled=true;try{await fetch('/api/setup/scan',{method:'POST'});setTimeout(loadNetworks,2800)}catch(e){msg('Wi-Fi 검색을 시작하지 못했습니다.','error')}finally{setTimeout(()=>$('refresh').disabled=false,3000)}}
async function connect(){if(!selected)return;const fd=new URLSearchParams();fd.set('ssid',selected);fd.set('psk',$('password').value);$('connect').disabled=true;msg('Wi-Fi 정보를 저장하고 연결을 시도합니다.','');try{const r=await fetch('/api/setup/wifi',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd});if(!r.ok)throw new Error(await r.text());msg('저장되었습니다. 연결되면 이 임시 Wi-Fi가 자동으로 종료될 수 있습니다.','ok');setTimeout(()=>{msg('설정이 완료되었습니다. 이 창은 닫아도 됩니다.','ok')},3000)}catch(e){msg('저장하지 못했습니다. 비밀번호를 확인한 뒤 다시 시도하세요.','error');$('connect').disabled=false}}
$('refresh').onclick=refreshNetworks;$('connect').onclick=connect;loadStatus();loadNetworks();
</script>
</body>
</html>)HTML";

}  // namespace

bool SetupHandler::can_handle(AsyncWebServerRequest *request) const {
  char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
  auto url = request->url_to(url_buf);
  if (request->method() == HTTP_GET) {
    return url == "/" || url == "/setup" || url == "/api/setup/status" || url == "/api/setup/networks";
  }
  if (request->method() == HTTP_POST) {
    return url == "/api/setup/scan" || url == "/api/setup/wifi";
  }
  return false;
}

bool SetupHandler::handle(AsyncWebServerRequest *request) {
  if (!this->can_handle(request))
    return false;

  char url_buf[AsyncWebServerRequest::URL_BUF_SIZE];
  auto url = request->url_to(url_buf);
  if (request->method() == HTTP_GET && url == "/") {
    this->handle_root_(request);
    return true;
  }
  if (request->method() == HTTP_GET && url == "/setup") {
    this->handle_setup_page_(request);
    return true;
  }
  if (request->method() == HTTP_GET && url == "/api/setup/status") {
    this->handle_status_(request);
    return true;
  }
  if (request->method() == HTTP_GET && url == "/api/setup/networks") {
    this->handle_networks_(request);
    return true;
  }
  if (request->method() == HTTP_POST && url == "/api/setup/scan") {
    this->handle_scan_(request);
    return true;
  }
  if (request->method() == HTTP_POST && url == "/api/setup/wifi") {
    this->handle_wifi_save_(request);
    return true;
  }

  request->send(404, "application/json", "{\"ok\":false,\"error\":\"not_found\"}");
  return true;
}

void SetupHandler::handle_root_(AsyncWebServerRequest *request) const {
  if (setup_mode_active()) {
    request->redirect("/setup");
  } else {
    request->redirect("/dashboard");
  }
}

void SetupHandler::handle_setup_page_(AsyncWebServerRequest *request) const {
  auto *response = request->beginResponse(200, "text/html; charset=utf-8", reinterpret_cast<const uint8_t *>(SETUP_PAGE),
                                          sizeof(SETUP_PAGE) - 1);
  response->addHeader("Cache-Control", "no-store");
  request->send(response);
}

void SetupHandler::handle_status_(AsyncWebServerRequest *request) const {
  char mac_s[18];
  get_mac_address_pretty_into_buffer(mac_s);
  const bool connected = wifi_connected();
  const bool ap_active = wifi::global_wifi_component != nullptr && wifi::global_wifi_component->is_ap_active();
  const auto name = json_escape(App.get_name());

  auto *stream = request->beginResponseStream("application/json");
  stream->printf("{\"ok\":true,\"device\":{\"name\":\"%s\",\"mac\":\"%s\"},\"wifi\":{\"connected\":%s,\"apActive\":%s}}",
                 name.c_str(), mac_s, connected ? "true" : "false", ap_active ? "true" : "false");
  request->send(stream);
}

void SetupHandler::handle_networks_(AsyncWebServerRequest *request) const {
  if (wifi::global_wifi_component == nullptr) {
    request->send(503, "application/json", "{\"ok\":false,\"error\":\"wifi_unavailable\"}");
    return;
  }

  std::vector<NetworkInfo> networks;
  for (const auto &scan : wifi::global_wifi_component->get_scan_result()) {
    if (scan.get_is_hidden())
      continue;
    const std::string ssid = scan.get_ssid().str();
    if (ssid.empty())
      continue;

    auto found = std::find_if(networks.begin(), networks.end(), [&ssid](const NetworkInfo &item) {
      return item.ssid == ssid;
    });
    if (found == networks.end()) {
      networks.push_back(NetworkInfo{ssid, scan.get_rssi(), scan.get_with_auth()});
    } else if (scan.get_rssi() > found->rssi) {
      found->rssi = scan.get_rssi();
      found->locked = scan.get_with_auth();
    }
  }

  std::sort(networks.begin(), networks.end(), [](const NetworkInfo &a, const NetworkInfo &b) {
    return a.rssi > b.rssi;
  });

  auto *stream = request->beginResponseStream("application/json");
  stream->print("{\"ok\":true,\"networks\":[");
  bool first = true;
  for (const auto &network : networks) {
    if (!first)
      stream->print(",");
    first = false;
    const auto ssid = json_escape(network.ssid);
    stream->printf("{\"ssid\":\"%s\",\"rssi\":%d,\"locked\":%s}", ssid.c_str(), network.rssi,
                   network.locked ? "true" : "false");
  }
  stream->print("]}");
  request->send(stream);
}

void SetupHandler::handle_scan_(AsyncWebServerRequest *request) const {
  if (wifi::global_wifi_component == nullptr) {
    request->send(503, "application/json", "{\"ok\":false,\"error\":\"wifi_unavailable\"}");
    return;
  }

  wifi::global_wifi_component->start_scanning();
  request->send(200, "application/json", "{\"ok\":true,\"message\":\"scan_started\"}");
}

void SetupHandler::handle_wifi_save_(AsyncWebServerRequest *request) const {
  if (wifi::global_wifi_component == nullptr) {
    request->send(503, "application/json", "{\"ok\":false,\"error\":\"wifi_unavailable\"}");
    return;
  }

  const auto ssid = request->arg("ssid");
  const auto psk = request->arg("psk");
  if (ssid.empty()) {
    request->send(400, "application/json", "{\"ok\":false,\"error\":\"missing_ssid\"}");
    return;
  }

  ESP_LOGI(TAG, "Requested setup WiFi change: SSID='%s'", ssid.c_str());
  this->server_->save_wifi_sta_deferred(ssid, psk);
  request->send(200, "application/json", "{\"ok\":true,\"message\":\"saved\"}");
}

}  // namespace radar_api_server
}  // namespace esphome
