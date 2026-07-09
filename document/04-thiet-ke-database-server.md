# Thiết kế database server

## 1. Tổng quan

Server DB hiện tại gồm 23 bảng, bám theo `db-design.pdf` và file `prisma/schema.prisma`.

Các nhóm chính:

- Nhóm người dùng và phân quyền.
- Nhóm máy local.
- Nhóm profile sản phẩm.
- Nhóm scan và LED item.
- Nhóm duplicate.
- Nhóm sync/offline.
- Nhóm error code và notification.
- Nhóm audit.

## 2. Nhóm người dùng

### `users`

Lưu tài khoản đăng nhập trên máy server. Local Python không dùng bảng này.

Các field quan trọng:

- `username`: tên đăng nhập, unique.
- `password_hash`: mật khẩu đã hash.
- `role`: `operator`, `engineer`, `admin`, `dev`.
- `is_active`: khóa hoặc mở tài khoản.

Role `dev` phải ẩn khỏi UI/API thường, chỉ dùng cho môi trường kỹ thuật.

## 3. Nhóm máy local

### `machines`

Lưu danh sách máy local được phép kết nối.

Các field quan trọng:

- `machine_code`: mã máy, ví dụ `LOCAL01`, unique.
- `machine_name`: tên máy.
- `line_name`: tên line.
- `station_name`: tên trạm.
- `ip_address`: IP gần nhất hoặc IP cấu hình.
- `is_active`: máy inactive không được submit scan.

### `machine_sync_states`

Lưu trạng thái hiện tại của từng máy local.

Các field quan trọng:

- `connection_status`: `ONLINE`, `OFFLINE`, `UNKNOWN`.
- `last_seen_at`: lần cuối local heartbeat.
- `local_total_record`: tổng record local báo lên.
- `local_pending_sync`: số record còn chờ sync.
- `server_total_record`: tổng record server đang có.
- `need_sync`: server đánh dấu local có cần sync không.

### `machine_connection_logs`

Lưu lịch sử heartbeat, mất kết nối, sync started, sync done, sync failed.

### `machine_commands`

Lưu hàng lệnh server muốn local xử lý. Local phải chủ động poll, vì server không gọi ngược local qua LAN.

## 4. Nhóm profile sản phẩm

### `chassis_codes`

Lưu chassis rear code. Chassis là tên hiển thị profile.

### `led_codes`

Lưu LED model. Một LED model có thể dùng lại ở nhiều profile.

### `product_profiles`

Lưu profile sản phẩm. Không có `profile_name`.

Tên hiển thị profile lấy từ:

```txt
product_profiles.chassis_code_id -> chassis_codes.code_full
```

Các field quan trọng:

- `chassis_code_id`: unique, mỗi chassis chỉ thuộc một profile.
- `vendor_id`: vendor chính của profile.
- `factory_code`: dùng để đối chiếu với full code local gửi lên.
- `full_code_length`: mặc định 35.
- `full_vendor_position`: mặc định 18.
- `led_scan_length`: mặc định 22.
- `led_vendor_position`: mặc định 16.
- `version`: version profile.

### `profile_led_codes`

Gắn LED model vào profile. Mỗi profile có tối đa slot 1 và slot 2.

### `profile_snapshots`

Lưu snapshot rule profile mỗi lần thay đổi. Scan cũ phải truy vết được bằng rule tại thời điểm scan.

## 5. Nhóm scan

### `scan_records`

Đây là bảng chính lưu từng lần scan TV/full code. Bảng này lưu cả OK và NG.

Không tách bảng NG riêng vì:

- Một lần scan dù OK hay NG vẫn là một event vận hành.
- Cần truy vết theo máy, profile, ngày, full code và LED raw.
- Tránh duplicate schema.
- Dễ query báo cáo.

Các status quan trọng:

- `local_status`: local trả OK hoặc NG.
- `server_status`: server trả OK, NG, SKIPPED hoặc PENDING.
- `final_status`: kết quả cuối cùng OK, NG hoặc PENDING.
- `ng_stage`: lỗi đến từ LOCAL, SERVER hoặc SYSTEM.
- `ng_reason`: mã lỗi chuẩn.

### `scan_led_items`

Lưu từng thanh LED raw thuộc một scan. Một scan có thể có nhiều LED item.

## 6. Nhóm duplicate

### `recent_duplicate_keys`

Bảng khóa duplicate trong cửa sổ 30/31 ngày.

Chỉ record final OK mới được insert vào bảng này.

Local NG không được insert.

Server duplicate NG cũng không được insert key mới.

Unique constraint:

```txt
UNIQUE(profile_id, duplicate_key)
```

Đây là ràng buộc quan trọng để tránh race condition.

### `historical_duplicate_jobs`

Job kiểm duplicate toàn bộ lịch sử để báo cáo. Không đổi final status cũ.

### `historical_duplicate_results`

Kết quả duplicate lịch sử.

## 7. Nhóm sync/offline

### `scan_sync_batches`

Lưu batch dữ liệu local gửi lên khi startup, shutdown, reconnect hoặc manual sync.

### `sync_request_logs`

Lưu request/response từ local để debug.

Đây là bảng rất quan trọng khi cần chứng minh local đã gửi gì và server đã trả gì.

## 8. Nhóm lỗi và notification

### `error_codes`

Chuẩn hóa mã lỗi. Không nên để mỗi nơi tự viết message khác nhau.

Ví dụ:

- `SERVER_DUPLICATE`
- `LED_SUFFIX_NOT_MATCH`
- `MACHINE_NOT_FOUND`
- `PROFILE_NOT_FOUND`

### `notification_templates`

Mẫu thông báo dùng chung.

### `notification_events`

Thông báo đã phát sinh thực tế.

## 9. Audit

### `audit_logs`

Lưu thao tác quản trị:

- login.
- create profile.
- update profile.
- disable machine.
- export report.
- import master data.

Audit giúp truy vết khi có thay đổi cấu hình làm ảnh hưởng line sản xuất.
