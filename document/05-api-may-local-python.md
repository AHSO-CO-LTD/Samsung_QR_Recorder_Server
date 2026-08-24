# API máy local Python

Tài liệu này là bản tóm tắt contract API. Bản hướng dẫn tích hợp đầy đủ cho đội viết máy local Python nằm tại `document/10-huong-dan-api-may-local-python.md`.

## 1. Nguyên tắc tích hợp

Máy local Python chỉ gọi backend NestJS của máy server qua LAN.

```txt
Python local -> http://SERVER-IP:3979/api -> NestJS backend -> PostgreSQL
```

Máy local không gọi Next.js.

Máy local không thao tác trực tiếp PostgreSQL.

Máy local không cần đăng nhập user. Ở startup/pairing, máy local dùng `serial` + `uid` để hỏi server và tải cấu hình. Sau khi server duyệt, local nhận `machine_code` chính thức để dùng cho heartbeat, runtime, scan và sync. Khi gửi request định danh lần đầu, body chỉ cần `serial`, `uid`, `ip_address`; server tự tạo raw license key tạm thời theo format `{serial}|{uid}`.

Máy local mới lắp đặt phải gửi yêu cầu kết nối trước, sau đó tự poll trạng thái vì server không gọi trực tiếp ngược về local.

```txt
GET  /api/machines/identity/status?serial=...&uid=...
POST /api/machines/register-request
GET  /api/machines/register-requests/{request_id}/status?serial=...&uid=...
```

Payload register:

```json
{
  "serial": "SN-LOCAL01-2026",
  "uid": "UID-8f8f2f1c-local01",
  "ip_address": "192.168.1.50"
}
```

Sau khi request được tạo, admin/dev trên server sẽ xuất file thông tin máy, import file license raw để kích hoạt request, rồi mới duyệt đặt `machine_code`. Giai đoạn hiện tại chưa check công thức license thật.

Nhóm API máy local:

| Nhóm | API chính |
| --- | --- |
| Kiểm server | `GET /api/health` |
| Định danh/pairing | `GET /api/machines/identity/status`, `POST /api/machines/register-request`, `GET /api/machines/register-requests/{request_id}/status` |
| Lấy cấu hình | `GET /api/machines/config?serial=...&uid=...` |
| Runtime | `POST /api/machines/heartbeat`, `GET /api/machines/commands/poll?serial=...&uid=...`, `POST /api/machines/commands/{id}/ack` |
| Scan/sync | `POST /api/scans/submit`, `POST /api/sync/reconcile/check`, `POST /api/sync/reconcile/pull`, `POST /api/sync/batches/submit` |

Trạng thái UI local nên dùng:

```txt
BOOTING, SERVER_OFFLINE, NOT_REGISTERED, REGISTERING,
WAITING_LICENSE, WAITING_APPROVAL, REJECTED,
READY, SCANNING, SYNCING, BLOCKED, ERROR
```

Đối soát dữ liệu local/server dùng 2 bước:

```txt
POST /api/sync/reconcile/check
POST /api/sync/reconcile/pull
```

`reconcile/check` request tối thiểu chỉ cần `serial`, `uid`, `ip_address`. Nếu không gửi thời gian, server tự kiểm từ lần check gần nhất đến thời điểm hiện tại. Với request tối thiểu, server dùng tổng local gần nhất từ heartbeat để kết luận nếu đã có heartbeat; nếu chưa có heartbeat thì chỉ trả snapshot. Nếu muốn so sâu từng record, local gửi thêm manifest record. API này không ghi đè dữ liệu.

- `Sync theo Server`: local gọi `reconcile/pull`, nhận record server trả về và upsert vào DB local.
- `Sync theo Local`: local dùng `POST /api/sync/batches/submit` để đẩy record server thiếu lên server.

## 2. Swagger

Swagger chạy tại:

```txt
http://SERVER-IP:3979/api/docs
```

Trong môi trường dev trên chính máy server:

```txt
http://127.0.0.1:3979/api/docs
```

Swagger là nguồn tham chiếu contract chính cho đội viết máy local.

## 3. Response chuẩn

Mọi response nên theo dạng:

```json
{
  "success": true,
  "code": "SERVER_OK",
  "message": "Server accepted scan. No duplicate was detected.",
  "data": {}
}
```

Ý nghĩa:

- `success`: request xử lý thành công hay không.
- `code`: mã kết quả chuẩn để local xử lý logic.
- `message`: message dễ đọc để debug hoặc hiển thị.
- `data`: dữ liệu chi tiết.

Local nên dựa vào `code`, không nên parse `message`.

## 4. Heartbeat

Endpoint:

```txt
POST /api/machines/heartbeat
```

Payload mẫu:

```json
{
  "machine_code": "LOCAL01",
  "serial": "SN-LOCAL01-2026",
  "uid": "UID-8f8f2f1c-local01",
  "ip_address": "192.168.1.50",
  "app_version": "1.0.0",
  "local_db_version": "20260709.001",
  "local_total_record": 1200,
  "local_ok_record": 1180,
  "local_ng_record": 20,
  "local_pending_sync": 3,
  "local_checksum": "sha256:summary"
}
```

Server xử lý:

1. Tìm `machines.machine_code`.
2. Kiểm `serial` và `uid` có khớp máy đã định danh không.
3. Nếu không có hoặc inactive thì trả lỗi `MACHINE_NOT_FOUND`.
4. Nếu sai định danh thì trả lỗi `MACHINE_IDENTITY_MISMATCH`.
5. Upsert `machine_sync_states`.
6. Ghi `machine_connection_logs` event `HEARTBEAT`.
7. Trả `HEARTBEAT_ACCEPTED`.

Response mẫu:

```json
{
  "success": true,
  "code": "HEARTBEAT_ACCEPTED",
  "message": "Heartbeat accepted.",
  "data": {
    "machine": {},
    "sync_state": {}
  }
}
```

## 5. Submit scan

Endpoint:

```txt
POST /api/scans/submit
```

Payload mẫu local OK:

```json
{
  "local_scan_id": "LOCAL01-20260708-000001",
  "machine_code": "LOCAL01",
  "serial": "SN-LOCAL01-2026",
  "uid": "UID-8f8f2f1c-local01",
  "profile_id": 5,
  "duplicate_key": "1A1Y420673",
  "full_code": {
    "raw": "VN39BN9660877C1A1L60376ADYS3Y420673",
    "prefix": "VN39",
    "chassis_code": "BN96-60877C",
    "before_vendor": "1A1",
    "vendor_char": "L",
    "led_code": "BN96-60376A",
    "factory_code": "DYS3",
    "after_factory": "Y420673"
  },
  "chassis_scan_raw": "BN96-60877C",
  "led_scans": [
    {
      "slot": 1,
      "index": 1,
      "raw": "ZB36L582465U528LD0376A",
      "lot_no": "528",
      "vendor_char": "L",
      "suffix": "0376A",
      "status": "OK",
      "ng_reason": null
    }
  ],
  "local_status": "OK",
  "local_ng_reason": null,
  "scan_at": "2026-07-08T14:30:25+07:00"
}
```

Payload mẫu local NG:

```json
{
  "local_scan_id": "LOCAL01-20260708-000002",
  "machine_code": "LOCAL01",
  "serial": "SN-LOCAL01-2026",
  "uid": "UID-8f8f2f1c-local01",
  "profile_id": 5,
  "duplicate_key": "1A1Y420674",
  "full_code": {
    "raw": "VN39BN9660877C1A1L60376ADYS3Y420674",
    "prefix": "VN39",
    "chassis_code": "BN96-60877C",
    "before_vendor": "1A1",
    "vendor_char": "L",
    "led_code": "BN96-60376A",
    "factory_code": "DYS3",
    "after_factory": "Y420674"
  },
  "chassis_scan_raw": "BN96-60877C",
  "led_scans": [
    {
      "slot": 1,
      "index": 1,
      "raw": "ZB36L582465U528LD9999X",
      "lot_no": "528",
      "vendor_char": "L",
      "suffix": "9999X",
      "status": "NG",
      "ng_reason": "LED_SUFFIX_NOT_MATCH"
    }
  ],
  "local_status": "NG",
  "local_ng_reason": "LED_SUFFIX_NOT_MATCH",
  "scan_at": "2026-07-08T14:31:25+07:00"
}
```

Payload mẫu local REWORK:

```json
{
  "local_scan_id": "RW-LOCAL01-20260708-000002",
  "machine_code": "LOCAL01",
  "serial": "SN-LOCAL01-2026",
  "uid": "UID-8f8f2f1c-local01",
  "profile_id": 5,
  "duplicate_key": "1A1Y420675",
  "full_code": {
    "raw": "VN39BN9660877C1A1L60376ADYS3Y420675",
    "prefix": "VN39",
    "chassis_code": "BN96-60877C",
    "before_vendor": "1A1",
    "vendor_char": "L",
    "led_code": "BN96-60376A",
    "factory_code": "DYS3",
    "after_factory": "Y420675"
  },
  "chassis_scan_raw": "BN96-60877C",
  "led_scans": [
    {
      "slot": 1,
      "index": 1,
      "raw": "ZB36L582465U528LD9999X",
      "lot_no": "528",
      "vendor_char": "L",
      "suffix": "9999X",
      "status": "REWORK",
      "ng_reason": "LED_SUFFIX_NOT_MATCH"
    }
  ],
  "local_status": "REWORK",
  "local_ng_reason": "LED_SUFFIX_NOT_MATCH",
  "scan_at": "2026-07-08T14:32:25+07:00"
}
```

Mỗi lượt REWORK dùng một `local_scan_id` mới theo dạng `RW-<local_scan_id_của_lượt_NG_gốc>`. REWORK phải gửi đầy đủ `duplicate_key`, `full_code`, `chassis_scan_raw` và `led_scans` như local OK để server kiểm tra trùng; đồng thời gửi `local_ng_reason` (hoặc `ng_reason` trong LED) để lưu vết lỗi đang được sửa. Nếu trùng, server trả `SERVER_DUPLICATE`, không lưu record REWORK và giữ nguyên lượt NG gốc. Nếu không trùng, server lưu record REWORK mới và đổi lượt NG gốc thành `NG_REWORK`, giữ nguyên thời gian NG.

## 6. Response submit scan

### Local OK, server OK

```json
{
  "success": true,
  "code": "SERVER_OK",
  "message": "Server accepted scan. No duplicate was detected.",
  "data": {
    "decision": "SERVER_OK",
    "server_scan_id": 123,
    "final_status": "OK",
    "ng_reason": null
  }
}
```

### Local OK, server duplicate

```json
{
  "success": true,
  "code": "SERVER_DUPLICATE",
  "message": "Server detected duplicate within the configured duplicate window.",
  "data": {
    "decision": "SERVER_DUPLICATE",
    "server_scan_id": 124,
    "first_scan_record_id": 123,
    "final_status": "NG",
    "ng_reason": "SERVER_DUPLICATE"
  }
}
```

### Local NG saved

```json
{
  "success": true,
  "code": "LOCAL_NG_SAVED",
  "message": "Local NG scan was saved. Server duplicate check was skipped.",
  "data": {
    "decision": "LOCAL_NG_SAVED",
    "server_scan_id": 125,
    "final_status": "NG",
    "ng_reason": "LED_SUFFIX_NOT_MATCH"
  }
}
```

### Local REWORK saved

```json
{
  "success": true,
  "code": "LOCAL_REWORK_SAVED",
  "message": "Đã lưu lượt quét REWORK và cập nhật lượt NG gốc.",
  "data": {
    "decision": "LOCAL_REWORK_SAVED",
    "server_scan_id": 126,
    "reworked_scan_record_id": 125,
    "final_status": "REWORK",
    "ng_reason": "LED_SUFFIX_NOT_MATCH"
  }
}
```

## 7. Lưu ý cho máy local

Máy local nên:

- Tự tạo `local_scan_id` unique.
- Lưu local DB trước khi gửi server.
- Nếu server mất kết nối, giữ scan ở trạng thái pending.
- Không hiển thị final OK khi chưa có server OK.
- Dựa vào `code` để quyết định UI.
- Gửi local OK, NG và REWORK lên server để server lưu trace.

Máy local không nên:

- Gọi trực tiếp database.
- Gọi Next.js UI.
- Tự quyết định duplicate 30/31 ngày thay cho server.
- Gửi scan thiếu `machine_code`, `serial`, `uid`, `profile_id`, `duplicate_key`.
