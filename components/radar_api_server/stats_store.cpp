#include "stats_store.h"

#include <algorithm>
#include <cstring>
#include <esp_http_server.h>

namespace esphome {
namespace radar_api_server {

namespace {

static constexpr uint32_t STATS_INTERNAL_UPLOAD_SESSION = 0x53544154u;
static constexpr size_t STATS_STORAGE_WRITE_CHUNK_SIZE = 512;
static constexpr size_t STATS_STORAGE_READ_CHUNK_SIZE = 512;
static constexpr size_t MAX_STATS_JSON_VALUE_SIZE = 16 * 1024;
static constexpr size_t MAX_STATS_DAILY_ENTRIES = 30;

struct CountJsonContext {
  uint32_t size{0};
};

struct HttpJsonContext {
  httpd_req *request{nullptr};
};

struct StorageJsonContext {
  RadarStorage *storage{nullptr};
  uint32_t session{0};
  uint32_t offset{0};
  char buffer[STATS_STORAGE_WRITE_CHUNK_SIZE]{};
  size_t used{0};
};

struct StatsJsonParts {
  std::string today;
  std::vector<std::string> daily;
  std::string heatmap_today;
  std::vector<std::string> heatmap_daily;
};

class StorageJsonReader {
 public:
  StorageJsonReader(RadarStorage *storage, uint32_t offset, uint32_t size) : storage_(storage), offset_(offset), size_(size) {}

  bool read(char *out) {
    if (out == nullptr)
      return false;
    if (this->has_peek_) {
      *out = this->peek_;
      this->has_peek_ = false;
      return true;
    }
    if (this->buffer_pos_ >= this->buffer_len_ && !this->fill_())
      return false;
    *out = this->buffer_[this->buffer_pos_++];
    return true;
  }

  bool peek(char *out) {
    if (out == nullptr)
      return false;
    if (!this->has_peek_) {
      if (!this->read(&this->peek_))
        return false;
      this->has_peek_ = true;
    }
    *out = this->peek_;
    return true;
  }

 private:
  bool fill_() {
    if (this->read_pos_ >= this->size_ || this->storage_ == nullptr)
      return false;
    const uint32_t chunk = std::min<uint32_t>(sizeof(this->buffer_), this->size_ - this->read_pos_);
    if (!this->storage_->read_storage_range(this->offset_ + this->read_pos_, reinterpret_cast<uint8_t *>(this->buffer_),
                                            chunk))
      return false;
    this->read_pos_ += chunk;
    this->buffer_pos_ = 0;
    this->buffer_len_ = chunk;
    return true;
  }

  RadarStorage *storage_{nullptr};
  uint32_t offset_{0};
  uint32_t size_{0};
  uint32_t read_pos_{0};
  char buffer_[STATS_STORAGE_READ_CHUNK_SIZE]{};
  uint32_t buffer_pos_{0};
  uint32_t buffer_len_{0};
  bool has_peek_{false};
  char peek_{0};
};

bool count_json_write(void *context, const char *, size_t size) {
  auto *counter = static_cast<CountJsonContext *>(context);
  if (counter == nullptr || size > UINT32_MAX - counter->size)
    return false;
  counter->size += static_cast<uint32_t>(size);
  return true;
}

bool http_json_write(void *context, const char *data, size_t size) {
  auto *http = static_cast<HttpJsonContext *>(context);
  return http != nullptr && http->request != nullptr && httpd_resp_send_chunk(http->request, data, size) == ESP_OK;
}

bool flush_storage_json(StorageJsonContext *context) {
  if (context == nullptr || context->storage == nullptr)
    return false;
  if (context->used == 0)
    return true;
  const bool ok = context->storage->write_upload_chunk(
      RadarPayloadTarget::STATS, context->offset, reinterpret_cast<const uint8_t *>(context->buffer),
      static_cast<uint32_t>(context->used), context->session);
  if (!ok)
    return false;
  context->offset += static_cast<uint32_t>(context->used);
  context->used = 0;
  return true;
}

bool storage_json_write(void *context, const char *data, size_t size) {
  auto *storage = static_cast<StorageJsonContext *>(context);
  if (storage == nullptr || data == nullptr)
    return false;

  size_t cursor = 0;
  while (cursor < size) {
    if (storage->used >= sizeof(storage->buffer) && !flush_storage_json(storage))
      return false;
    const size_t chunk = std::min<size_t>(sizeof(storage->buffer) - storage->used, size - cursor);
    std::memcpy(storage->buffer + storage->used, data + cursor, chunk);
    storage->used += chunk;
    cursor += chunk;
  }
  return true;
}

bool skip_json_ws(StorageJsonReader *reader) {
  if (reader == nullptr)
    return false;
  char ch = 0;
  while (reader->peek(&ch)) {
    if (ch != ' ' && ch != '\n' && ch != '\r' && ch != '\t')
      return true;
    reader->read(&ch);
  }
  return false;
}

bool read_json_string(StorageJsonReader *reader, std::string *out, size_t max_size) {
  if (reader == nullptr || out == nullptr)
    return false;
  out->clear();
  char ch = 0;
  if (!reader->read(&ch) || ch != '"')
    return false;
  bool escaped = false;
  while (reader->read(&ch)) {
    if (escaped) {
      if (out->size() >= max_size)
        return false;
      out->push_back(ch);
      escaped = false;
      continue;
    }
    if (ch == '\\') {
      escaped = true;
      continue;
    }
    if (ch == '"')
      return true;
    if (out->size() >= max_size)
      return false;
    out->push_back(ch);
  }
  return false;
}

bool skip_json_string(StorageJsonReader *reader) {
  if (reader == nullptr)
    return false;
  char ch = 0;
  if (!reader->read(&ch) || ch != '"')
    return false;
  bool escaped = false;
  while (reader->read(&ch)) {
    if (escaped) {
      escaped = false;
    } else if (ch == '\\') {
      escaped = true;
    } else if (ch == '"') {
      return true;
    }
  }
  return false;
}

bool capture_json_compound(StorageJsonReader *reader, char open, char close, std::string *out, size_t max_size) {
  if (reader == nullptr || out == nullptr)
    return false;
  out->clear();
  char ch = 0;
  if (!reader->read(&ch) || ch != open)
    return false;
  out->push_back(ch);
  int depth = 1;
  bool in_string = false;
  bool escaped = false;
  while (reader->read(&ch)) {
    if (out->size() >= max_size)
      return false;
    out->push_back(ch);
    if (in_string) {
      if (escaped) {
        escaped = false;
      } else if (ch == '\\') {
        escaped = true;
      } else if (ch == '"') {
        in_string = false;
      }
      continue;
    }
    if (ch == '"') {
      in_string = true;
    } else if (ch == open) {
      depth++;
    } else if (ch == close) {
      depth--;
      if (depth == 0)
        return true;
    }
  }
  return false;
}

bool skip_json_compound(StorageJsonReader *reader, char open, char close) {
  if (reader == nullptr)
    return false;
  char ch = 0;
  if (!reader->read(&ch) || ch != open)
    return false;
  int depth = 1;
  bool in_string = false;
  bool escaped = false;
  while (reader->read(&ch)) {
    if (in_string) {
      if (escaped) {
        escaped = false;
      } else if (ch == '\\') {
        escaped = true;
      } else if (ch == '"') {
        in_string = false;
      }
      continue;
    }
    if (ch == '"') {
      in_string = true;
    } else if (ch == open) {
      depth++;
    } else if (ch == close) {
      depth--;
      if (depth == 0)
        return true;
    }
  }
  return false;
}

bool skip_json_primitive(StorageJsonReader *reader) {
  if (reader == nullptr)
    return false;
  char ch = 0;
  while (reader->peek(&ch)) {
    if (ch == ',' || ch == '}' || ch == ']')
      return true;
    reader->read(&ch);
  }
  return true;
}

bool skip_json_value(StorageJsonReader *reader) {
  if (!skip_json_ws(reader))
    return false;
  char ch = 0;
  if (!reader->peek(&ch))
    return false;
  if (ch == '"')
    return skip_json_string(reader);
  if (ch == '{')
    return skip_json_compound(reader, '{', '}');
  if (ch == '[')
    return skip_json_compound(reader, '[', ']');
  return skip_json_primitive(reader);
}

bool read_json_object_array(StorageJsonReader *reader, std::vector<std::string> *out) {
  if (reader == nullptr || out == nullptr)
    return false;
  char ch = 0;
  if (!skip_json_ws(reader) || !reader->read(&ch) || ch != '[')
    return false;
  while (skip_json_ws(reader)) {
    if (!reader->peek(&ch))
      return false;
    if (ch == ']') {
      reader->read(&ch);
      return true;
    }
    if (ch == '{') {
      std::string object;
      if (!capture_json_compound(reader, '{', '}', &object, MAX_STATS_JSON_VALUE_SIZE))
        return false;
      if (out->size() < MAX_STATS_DAILY_ENTRIES)
        out->push_back(object);
    } else if (!skip_json_value(reader)) {
      return false;
    }
    if (!skip_json_ws(reader) || !reader->read(&ch))
      return false;
    if (ch == ']')
      return true;
    if (ch != ',')
      return false;
  }
  return false;
}

bool parse_heatmap_object(StorageJsonReader *reader, StatsJsonParts *parts) {
  if (reader == nullptr || parts == nullptr)
    return false;
  char ch = 0;
  if (!skip_json_ws(reader) || !reader->read(&ch) || ch != '{')
    return false;
  while (skip_json_ws(reader)) {
    if (!reader->peek(&ch))
      return false;
    if (ch == '}') {
      reader->read(&ch);
      return true;
    }
    std::string key;
    if (!read_json_string(reader, &key, 64) || !skip_json_ws(reader) || !reader->read(&ch) || ch != ':')
      return false;
    if (key == "today") {
      if (!skip_json_ws(reader) || !read_json_string(reader, &parts->heatmap_today, MAX_STATS_JSON_VALUE_SIZE))
        return false;
    } else if (key == "daily") {
      if (!read_json_object_array(reader, &parts->heatmap_daily))
        return false;
    } else if (!skip_json_value(reader)) {
      return false;
    }
    if (!skip_json_ws(reader) || !reader->read(&ch))
      return false;
    if (ch == '}')
      return true;
    if (ch != ',')
      return false;
  }
  return false;
}

bool parse_stats_document(StorageJsonReader *reader, StatsJsonParts *parts) {
  if (reader == nullptr || parts == nullptr)
    return false;
  char ch = 0;
  if (!skip_json_ws(reader) || !reader->read(&ch) || ch != '{')
    return false;
  while (skip_json_ws(reader)) {
    if (!reader->peek(&ch))
      return false;
    if (ch == '}') {
      reader->read(&ch);
      return true;
    }
    std::string key;
    if (!read_json_string(reader, &key, 64) || !skip_json_ws(reader) || !reader->read(&ch) || ch != ':')
      return false;
    if (key == "today") {
      if (!skip_json_ws(reader) ||
          !capture_json_compound(reader, '{', '}', &parts->today, MAX_STATS_JSON_VALUE_SIZE))
        return false;
    } else if (key == "daily") {
      if (!read_json_object_array(reader, &parts->daily))
        return false;
    } else if (key == "heatmap") {
      if (!parse_heatmap_object(reader, parts))
        return false;
    } else if (!skip_json_value(reader)) {
      return false;
    }
    if (!skip_json_ws(reader) || !reader->read(&ch))
      return false;
    if (ch == '}')
      return true;
    if (ch != ',')
      return false;
  }
  return false;
}

}  // namespace

void StatsStore::load(RadarStorage *storage) {
  this->storage_ = storage;
  this->today_json_.clear();
  this->daily_.clear();
  this->today_heatmap_cells_.fill(0);
  this->heatmap_daily_.clear();

  if (storage != nullptr)
    this->load_from_storage_(storage);
}

void StatsStore::update_today(const std::string &today_json) { this->today_json_ = today_json; }

void StatsStore::record_heatmap_hit(float tx, float ty) {
  const int cell_mm = 300;
  const int x_min = -4800;
  const int y_min = 0;
  const int cols = 33;
  const int rows = 26;
  int col = static_cast<int>((tx - x_min) / cell_mm);
  int row = static_cast<int>((ty - y_min) / cell_mm);
  if (col < 0) col = 0;
  if (col >= cols) col = cols - 1;
  if (row < 0) row = 0;
  if (row >= rows) row = rows - 1;
  const int index = row * cols + col;
  if (this->today_heatmap_cells_[index] < 65535)
    this->today_heatmap_cells_[index]++;
}

bool StatsStore::finish_day(const std::string &finished_day_json, const std::string &new_today_json) {
  if (!finished_day_json.empty()) {
    const int finished_day = parse_totals_(finished_day_json).day;
    if (finished_day > 0) {
      const std::string finished_heatmap_rle = this->compact_today_heatmap_rle_();
      this->daily_.erase(std::remove_if(this->daily_.begin(), this->daily_.end(),
                                        [&](const std::string &entry) {
                                          return parse_totals_(entry).day == finished_day;
                                        }),
                         this->daily_.end());
      this->daily_.insert(this->daily_.begin(), finished_day_json);
      this->trim_daily_();
      this->heatmap_daily_.erase(std::remove_if(this->heatmap_daily_.begin(), this->heatmap_daily_.end(),
                                                [&](const std::string &entry) {
                                                  return parse_int_after_(entry, "\"d\":") == finished_day;
                                                }),
                                 this->heatmap_daily_.end());
      this->heatmap_daily_.insert(this->heatmap_daily_.begin(),
                                  "{\"d\":" + std::to_string(finished_day) + ",\"data\":" +
                                      json_string_(finished_heatmap_rle) + "}");
      this->trim_heatmap_daily_();
    }
  }
  this->today_json_ = new_today_json;
  this->today_heatmap_cells_.fill(0);
  return this->persist_();
}

bool StatsStore::reset_today(const std::string &new_today_json) {
  this->today_json_ = new_today_json;
  this->today_heatmap_cells_.fill(0);
  return this->persist_();
}

void StatsStore::clear() {
  this->today_json_.clear();
  this->daily_.clear();
  this->today_heatmap_cells_.fill(0);
  this->heatmap_daily_.clear();
}

bool StatsStore::write_json_(bool (*write)(void *context, const char *data, size_t size), void *context) const {
  if (write == nullptr)
    return false;

  const std::string today = this->today_json_.empty()
                                ? "{\"d\":0,\"f\":0,\"r\":0,\"fz\":[0,0,0,0],\"rz\":[0,0,0,0],\"sz\":[0,0,0,0,0,0]}"
                                : this->today_json_;
  const Totals today_totals = parse_totals_(today);
  const int today_serial = day_serial_(today_totals.day);

  auto build_summary = [&](int days) -> std::string {
    Totals result;
    if (today_serial > 0 && day_serial_(today_totals.day) >= today_serial - days + 1) {
      add_totals_(&result, today_totals);
    }
    if (today_serial > 0) {
      for (const auto &entry : this->daily_) {
        const Totals daily = parse_totals_(entry);
        if (daily.day == today_totals.day)
          continue;
        const int daily_serial = day_serial_(daily.day);
        if (daily_serial >= today_serial - days + 1 && daily_serial <= today_serial) {
          add_totals_(&result, daily);
        }
      }
    }
    return totals_json_(result, days);
  };

  auto write_cstr = [&](const char *value) -> bool { return write(context, value, std::strlen(value)); };
  auto write_string = [&](const std::string &value) -> bool { return write(context, value.data(), value.size()); };

  if (!write_cstr("{\"version\":1,\"today\":") || !write_string(today) || !write_cstr(",\"daily\":["))
    return false;
  for (size_t index = 0; index < this->daily_.size(); index++) {
    if (index > 0 && !write_cstr(","))
      return false;
    if (!write_string(this->daily_[index]))
      return false;
  }
  if (!write_cstr("],\"summary\":{\"last3Days\":") || !write_string(build_summary(3)) ||
      !write_cstr(",\"last7Days\":") || !write_string(build_summary(7)) ||
      !write_cstr(",\"last15Days\":") || !write_string(build_summary(15)) ||
      !write_cstr(",\"last30Days\":") || !write_string(build_summary(30)) ||
      !write_cstr("},\"heatmap\":{\"version\":1,\"cols\":33,\"rows\":26,\"cellMm\":300,\"encoding\":\"rle\","
                  "\"today\":") ||
      !write_string(json_string_(this->compact_today_heatmap_rle_())) || !write_cstr(",\"daily\":["))
    return false;
  for (size_t index = 0; index < this->heatmap_daily_.size(); index++) {
    if (index > 0 && !write_cstr(","))
      return false;
    if (!write_string(this->heatmap_daily_[index]))
      return false;
  }
  return write_cstr("]}}");
}

bool StatsStore::stream_json(httpd_req *request) const {
  if (request == nullptr)
    return false;
  HttpJsonContext context{request};
  return this->write_json_(http_json_write, &context) && httpd_resp_send_chunk(request, nullptr, 0) == ESP_OK;
}

bool StatsStore::load_from_storage_(RadarStorage *storage) {
  if (storage == nullptr)
    return false;

  uint32_t payload_offset = 0;
  uint32_t payload_size = 0;
  if (!storage->payload_info(RadarPayloadTarget::STATS, &payload_offset, &payload_size))
    return false;

  StorageJsonReader reader(storage, payload_offset, payload_size);
  StatsJsonParts parts;
  if (!parse_stats_document(&reader, &parts))
    return false;

  std::array<uint16_t, 858> heatmap_cells{};
  decode_heatmap_rle_(parts.heatmap_today, &heatmap_cells);

  this->today_json_ = parts.today;
  this->daily_ = parts.daily;
  this->today_heatmap_cells_ = heatmap_cells;
  this->heatmap_daily_ = parts.heatmap_daily;
  this->trim_daily_();
  this->trim_heatmap_daily_();
  return true;
}

int StatsStore::parse_int_after_(const std::string &json, const char *key) {
  const size_t key_pos = json.find(key);
  if (key_pos == std::string::npos)
    return 0;
  size_t pos = key_pos + std::strlen(key);
  bool negative = false;
  if (pos < json.size() && json[pos] == '-') {
    negative = true;
    pos++;
  }
  int value = 0;
  while (pos < json.size() && json[pos] >= '0' && json[pos] <= '9') {
    value = value * 10 + (json[pos] - '0');
    pos++;
  }
  return negative ? -value : value;
}

void StatsStore::parse_int_array_(const std::string &json, const char *key, int *out, size_t count) {
  const size_t key_pos = json.find(key);
  if (key_pos == std::string::npos)
    return;
  size_t pos = key_pos + std::strlen(key);
  for (size_t index = 0; index < count && pos < json.size(); index++) {
    while (pos < json.size() && (json[pos] < '0' || json[pos] > '9') && json[pos] != '-')
      pos++;
    bool negative = false;
    if (pos < json.size() && json[pos] == '-') {
      negative = true;
      pos++;
    }
    int value = 0;
    while (pos < json.size() && json[pos] >= '0' && json[pos] <= '9') {
      value = value * 10 + (json[pos] - '0');
      pos++;
    }
    out[index] = negative ? -value : value;
  }
}

StatsStore::Totals StatsStore::parse_totals_(const std::string &json) {
  Totals totals;
  totals.day = parse_int_after_(json, "\"d\":");
  totals.f = parse_int_after_(json, "\"f\":");
  totals.r = parse_int_after_(json, "\"r\":");
  parse_int_array_(json, "\"fz\":[", totals.fz, 4);
  parse_int_array_(json, "\"rz\":[", totals.rz, 4);
  parse_int_array_(json, "\"sz\":[", totals.sz, 6);
  return totals;
}

int StatsStore::day_serial_(int day_key) {
  if (day_key <= 0)
    return 0;
  int year = day_key / 10000;
  int month = (day_key / 100) % 100;
  int day = day_key % 100;
  if (month <= 2) {
    year--;
    month += 12;
  }
  return 365 * year + year / 4 - year / 100 + year / 400 + (153 * (month - 3) + 2) / 5 + day - 1;
}

void StatsStore::add_totals_(Totals *target, const Totals &source) {
  target->f += source.f;
  target->r += source.r;
  for (int index = 0; index < 4; index++) {
    target->fz[index] += source.fz[index];
    target->rz[index] += source.rz[index];
  }
  for (int index = 0; index < 6; index++) {
    target->sz[index] += source.sz[index];
  }
}

std::string StatsStore::totals_json_(const Totals &totals, int days) {
  std::string json = "{\"days\":";
  json += std::to_string(days);
  json += ",\"f\":";
  json += std::to_string(totals.f);
  json += ",\"r\":";
  json += std::to_string(totals.r);
  json += ",\"fz\":[";
  for (int index = 0; index < 4; index++) {
    if (index > 0)
      json += ",";
    json += std::to_string(totals.fz[index]);
  }
  json += "],\"rz\":[";
  for (int index = 0; index < 4; index++) {
    if (index > 0)
      json += ",";
    json += std::to_string(totals.rz[index]);
  }
  json += "],\"sz\":[";
  for (int index = 0; index < 6; index++) {
    if (index > 0)
      json += ",";
    json += std::to_string(totals.sz[index]);
  }
  json += "]}";
  return json;
}

std::string StatsStore::default_heatmap_rle_() { return "0x858"; }

std::string StatsStore::json_string_(const std::string &value) {
  std::string out = "\"";
  for (const char ch : value) {
    if (ch == '"' || ch == '\\') {
      out += '\\';
      out += ch;
    } else if (ch == '\n') {
      out += "\\n";
    } else if (ch == '\r') {
      out += "\\r";
    } else if (ch == '\t') {
      out += "\\t";
    } else {
      out += ch;
    }
  }
  out += "\"";
  return out;
}

void StatsStore::decode_heatmap_rle_(const std::string &rle, std::array<uint16_t, 858> *cells) {
  if (cells == nullptr)
    return;
  cells->fill(0);
  if (rle.empty())
    return;

  size_t cursor = 0;
  size_t cell_index = 0;
  while (cursor < rle.size() && cell_index < cells->size()) {
    int value = 0;
    while (cursor < rle.size() && rle[cursor] >= '0' && rle[cursor] <= '9') {
      value = value * 10 + (rle[cursor] - '0');
      cursor++;
    }
    if (cursor >= rle.size() || rle[cursor] != 'x')
      break;
    cursor++;

    int run = 0;
    while (cursor < rle.size() && rle[cursor] >= '0' && rle[cursor] <= '9') {
      run = run * 10 + (rle[cursor] - '0');
      cursor++;
    }
    if (run <= 0)
      break;

    const uint16_t clamped_value = value < 0 ? 0 : value > 65535 ? 65535 : static_cast<uint16_t>(value);
    for (int count = 0; count < run && cell_index < cells->size(); count++) {
      (*cells)[cell_index++] = clamped_value;
    }

    if (cursor < rle.size() && rle[cursor] == ',')
      cursor++;
  }
}

std::string StatsStore::compact_today_heatmap_rle_() const {
  std::string out;
  uint16_t value = this->today_heatmap_cells_[0];
  int run = 1;
  for (size_t index = 1; index < this->today_heatmap_cells_.size(); index++) {
    const uint16_t next = this->today_heatmap_cells_[index];
    if (next == value) {
      run++;
      continue;
    }
    if (!out.empty())
      out += ",";
    out += std::to_string(value);
    out += "x";
    out += std::to_string(run);
    value = next;
    run = 1;
  }
  if (!out.empty())
    out += ",";
  out += std::to_string(value);
  out += "x";
  out += std::to_string(run);
  return out;
}

void StatsStore::trim_daily_() {
  std::sort(this->daily_.begin(), this->daily_.end(), [](const std::string &left, const std::string &right) {
    return parse_totals_(left).day > parse_totals_(right).day;
  });
  if (this->daily_.size() > MAX_DAILY_ENTRIES)
    this->daily_.resize(MAX_DAILY_ENTRIES);
}

void StatsStore::trim_heatmap_daily_() {
  std::sort(this->heatmap_daily_.begin(), this->heatmap_daily_.end(), [](const std::string &left, const std::string &right) {
    return parse_int_after_(left, "\"d\":") > parse_int_after_(right, "\"d\":");
  });
  if (this->heatmap_daily_.size() > MAX_DAILY_ENTRIES)
    this->heatmap_daily_.resize(MAX_DAILY_ENTRIES);
}

bool StatsStore::persist_() const {
  if (this->storage_ == nullptr)
    return false;

  CountJsonContext count_context;
  if (!this->write_json_(count_json_write, &count_context) || count_context.size == 0)
    return false;

  if (!this->storage_->start_upload(RadarPayloadTarget::STATS, count_context.size, STATS_INTERNAL_UPLOAD_SESSION))
    return false;

  StorageJsonContext storage_context{this->storage_, STATS_INTERNAL_UPLOAD_SESSION};
  if (!this->write_json_(storage_json_write, &storage_context))
    return false;
  if (!flush_storage_json(&storage_context))
    return false;

  return this->storage_->commit_upload(RadarPayloadTarget::STATS, STATS_INTERNAL_UPLOAD_SESSION);
}

}  // namespace radar_api_server
}  // namespace esphome
