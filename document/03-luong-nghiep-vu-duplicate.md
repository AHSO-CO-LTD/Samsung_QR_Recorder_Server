# Luồng nghiệp vụ duplicate

## 1. Mục tiêu duplicate

Server cần đảm bảo mã TV không bị trùng trong khoảng thời gian gần nhất. Khoảng này được cấu hình bằng `server_settings.duplicate_days`, mặc định nên là 30 hoặc 31 ngày.

Key duplicate chính là:

```txt
profile_id + duplicate_key
```

Trong đó:

- `profile_id` xác định profile sản phẩm đang chạy.
- `duplicate_key` là key đã parse từ full code, ví dụ `1A1Y420673`.

Không dùng `full_code_raw` làm duplicate key chính vì full code có nhiều phần khác nhau, còn nghiệp vụ đã chốt duplicate theo key parse từ profile.

## 2. Nguyên tắc vàng

```txt
Chỉ so sánh OK với OK.
```

Server không được lấy mã NG để làm nguồn duplicate.

Điều này tránh tình huống sai:

1. Local scan một mã bị NG do sai LED suffix.
2. Server lưu mã đó.
3. Sau đó cùng mã được scan lại đúng.
4. Nếu server đem NG ra so duplicate thì mã đúng sẽ bị báo duplicate sai.

Vì vậy:

- Local NG chỉ lưu trace.
- Local NG không insert vào `recent_duplicate_keys`.
- Server duplicate chỉ nhìn vào key của record đã final OK.

## 3. Luồng local OK, server OK

Điều kiện:

- Local đã kiểm format OK.
- Local đã kiểm duplicate trong ngày/local scope OK.
- Local gửi `local_status = OK`.
- Server không tìm thấy `profile_id + duplicate_key` trong `recent_duplicate_keys` còn hạn.

Server xử lý:

1. Kiểm tra `machine_code` có tồn tại và active.
2. Kiểm tra `profile_id` có tồn tại và active.
3. Tìm profile snapshot hiện tại.
4. Kiểm tra `recent_duplicate_keys`.
5. Nếu không có duplicate:
   - Tạo record trong `scan_records`.
   - Tạo LED item trong `scan_led_items`.
   - Đặt `local_status = OK`.
   - Đặt `server_status = OK`.
   - Đặt `final_status = OK`.
   - Đặt `ng_stage = null`.
   - Đặt `ng_reason = null`.
   - Insert vào `recent_duplicate_keys`.
6. Trả response `SERVER_OK`.

Response ý nghĩa:

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

## 4. Luồng local OK, server duplicate

Điều kiện:

- Local gửi `local_status = OK`.
- Server tìm thấy `profile_id + duplicate_key` trong `recent_duplicate_keys`.
- Key đó chưa hết hạn theo `expires_at`.

Server xử lý:

1. Tạo record mới trong `scan_records` để lưu lần scan hiện tại.
2. Tạo LED item trong `scan_led_items`.
3. Đặt `local_status = OK`.
4. Đặt `server_status = NG`.
5. Đặt `final_status = NG`.
6. Đặt `ng_stage = SERVER`.
7. Đặt `ng_reason = SERVER_DUPLICATE`.
8. Không insert key mới vào `recent_duplicate_keys`.
9. Trả response `SERVER_DUPLICATE`.

Response ý nghĩa:

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

## 5. Luồng local NG

Điều kiện:

- Local kiểm sai format, sai vendor, sai factory, sai chassis, sai LED suffix hoặc duplicate local.
- Local gửi `local_status = NG`.

Server xử lý:

1. Không kiểm duplicate.
2. Tạo record trong `scan_records`.
3. Tạo LED item trong `scan_led_items`.
4. Đặt `local_status = NG`.
5. Đặt `server_status = SKIPPED`.
6. Đặt `final_status = NG`.
7. Đặt `ng_stage = LOCAL`.
8. Đặt `ng_reason` theo lỗi local gửi lên.
9. Không insert vào `recent_duplicate_keys`.
10. Trả response `LOCAL_NG_SAVED`.

Response ý nghĩa:

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

## 6. Luồng local REWORK

Điều kiện:

- Local gửi `local_status = REWORK` qua `POST /api/scans/submit` với `local_scan_id` có dạng `RW-<local_scan_id_NG_gốc>`.
- REWORK gửi đầy đủ `duplicate_key`, `full_code`, `chassis_scan_raw` và `led_scans` như lượt OK để server kiểm tra trùng.

Server lưu kết quả:

1. Kiểm tra duplicate giống lượt OK.
2. Nếu trùng, trả `SERVER_DUPLICATE`, `final_status = NG`, `server_scan_id = null` và không tạo record REWORK.
3. Nếu không trùng, tạo một record mới trong `scan_records` với `local_status = REWORK`, `server_status = OK`, `final_status = REWORK`.
4. Lưu `ng_stage = LOCAL` và `ng_reason` từ `local_ng_reason` (hoặc lỗi LED đầu tiên) để biết REWORK đang sửa lỗi gì.
5. Ghi `recent_duplicate_keys` để các lượt sau tiếp tục được kiểm tra trùng.
6. Tách tiền tố `RW-` để tìm đúng bản ghi NG gốc của cùng máy, rồi cập nhật bản ghi đó thành `final_status = NG_REWORK`; giữ nguyên `scan_at`, mã lỗi và toàn bộ dữ liệu NG ban đầu. `NG_REWORK` vẫn được tính là NG trong biểu đồ và báo cáo.
7. Trả response `LOCAL_REWORK_SAVED`.

Gửi lại đúng cùng `machine_code + local_scan_id` chỉ trả kết quả replay để chống lưu trùng do retry mạng. Một lượt REWORK mới phải có `local_scan_id` mới.

## 7. Race condition

Trong môi trường nhiều máy local gửi cùng lúc, duplicate có thể bị race condition nếu chỉ query rồi insert `scan_records`. Vì vậy server cần bảng `recent_duplicate_keys` có unique constraint:

```txt
UNIQUE(profile_id, duplicate_key)
```

Khi record final OK được tạo, server insert key vào bảng này. Nếu có máy khác cùng lúc insert cùng key, database sẽ chặn bằng unique constraint.

Ở bản scaffold hiện tại, service đã đặt nền theo hướng này. Khi làm production, cần bổ sung xử lý lỗi unique race một cách rõ ràng:

- Nếu insert recent key bị lỗi unique, rollback scan OK.
- Tạo scan mới hoặc retry theo hướng final NG `SERVER_DUPLICATE`.
- Ghi request log để debug.
