# Tổng quan dự án

## 1. Mục tiêu

Dự án xây dựng một ứng dụng desktop server để kiểm tra mã độc nhất của TV trong dây chuyền sản xuất. Server nhận dữ liệu scan từ các máy local, lưu lại toàn bộ lịch sử scan và kiểm tra duplicate trong một khoảng thời gian gần nhất, thường là 30 hoặc 31 ngày.

Mục tiêu quan trọng nhất là đảm bảo một mã đã được server xác nhận OK thì không được xuất hiện lại trong cửa sổ duplicate. Nếu xuất hiện lại, server phải trả kết quả NG với lý do `SERVER_DUPLICATE`.

## 2. Phạm vi hiện tại

Phạm vi hiện tại chỉ xây dựng máy server:

- Ứng dụng desktop server có file setup cài đặt.
- Giao diện quản trị và vận hành chạy bên trong Electron.
- Backend API để giao diện server và máy local Python gọi vào.
- Database PostgreSQL để lưu cấu hình, profile, scan, duplicate, sync, notification và audit.
- Swagger để tài liệu hóa API cho phía máy local Python.

Máy local Python không nằm trong phạm vi code của repo này, nhưng server phải thiết kế API rõ ràng để máy local có thể tích hợp.

## 3. Vai trò của máy server

Máy server là nguồn dữ liệu chính thức. Server có các trách nhiệm:

- Quản lý danh sách máy local được phép gửi dữ liệu.
- Quản lý profile sản phẩm, chassis code, LED code, vendor và rule parse.
- Nhận heartbeat từ máy local.
- Nhận dữ liệu scan từ máy local.
- Lưu tất cả scan OK và NG để truy vết.
- Chỉ kiểm duplicate với scan local OK.
- Không dùng scan local NG để so sánh duplicate.
- Trả response cuối cùng cho máy local.
- Lưu notification, error code, audit log và request log.
- Cung cấp Swagger để đội viết máy local bám đúng contract.

## 4. Vai trò của máy local Python

Máy local là app riêng, viết thuần Python. Máy local có trách nhiệm:

- Scan full code, chassis code và LED raw.
- Kiểm tra format, vendor, factory, chassis, LED suffix theo profile đang cache.
- Kiểm tra duplicate trong phạm vi local, ví dụ trong ngày hoặc trong ca.
- Nếu local OK thì gửi lên server để server kiểm duplicate trong 30/31 ngày.
- Nếu local NG thì vẫn gửi lên server để lưu trace, nhưng server không kiểm duplicate.
- Khi mất mạng, local lưu tạm và sync lại sau.
- Local luôn chủ động gọi server qua LAN. Server không gọi ngược lại máy local.

## 5. Nguyên tắc nghiệp vụ quan trọng

Nguyên tắc quan trọng nhất:

```txt
Chỉ so sánh OK với OK.
```

Điều này có nghĩa:

- Local OK mới được server kiểm duplicate.
- Server duplicate chỉ so sánh với các record đã final OK hoặc với khóa trong `recent_duplicate_keys`.
- Local NG chỉ lưu lại để truy vết, không được làm nguồn duplicate.
- Local NG không được làm cho một mã OK sau này bị báo duplicate.

## 6. Kết quả server trả cho local

Server có 3 kết quả chính:

1. `SERVER_OK`
   - Local gửi OK.
   - Server không tìm thấy duplicate.
   - Server lưu scan là final OK.
   - Server ghi key vào `recent_duplicate_keys`.

2. `SERVER_DUPLICATE`
   - Local gửi OK.
   - Server tìm thấy duplicate trong cửa sổ 30/31 ngày.
   - Server lưu scan là final NG.
   - Server không ghi key mới vào `recent_duplicate_keys`.

3. `LOCAL_NG_SAVED`
   - Local gửi NG.
   - Server lưu scan là final NG.
   - Server đặt `server_status = SKIPPED`.
   - Server không kiểm duplicate.
   - Server không ghi key vào `recent_duplicate_keys`.
