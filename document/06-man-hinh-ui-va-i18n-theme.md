# Màn hình UI, song ngữ và theme

## 1. Mục tiêu UI

UI là giao diện desktop server cho kỹ thuật viên, admin hoặc người vận hành tại máy server. UI không phải landing page và không phải website public.

Phong cách UI cần:

- Rõ ràng.
- Có cấu trúc.
- Dễ đọc trên màn hình nhà máy.
- Không dùng hiệu ứng trang trí quá mức.
- Không dùng gradient nếu không có yêu cầu riêng.
- Không dùng alert/confirm/prompt mặc định của browser.
- Mọi hành động user-facing cần có feedback bằng Sonner.

## 2. Layout chính

UI có:

- Sidebar bên trái.
- Header trên cùng.
- Vùng nội dung chính.
- Nút đổi ngôn ngữ.
- Nút đổi theme sáng/tối.
- Nút mở Swagger.

## 3. Danh sách màn hình

### Tổng quan

Route:

```txt
/
```

Mục đích:

- Hiển thị trạng thái API.
- Hiển thị trạng thái máy local.
- Hiển thị số liệu nhanh: OK hôm nay, NG hôm nay, pending sync, duplicate window.

### Máy local

Route:

```txt
/machines
```

Mục đích:

- Xem danh sách máy local.
- Xem trạng thái online/offline.
- Xem heartbeat gần nhất.
- Xem số pending sync.
- Sau này thêm thao tác active/inactive machine.

### Profile

Route:

```txt
/profiles
```

Mục đích:

- Xem profile sản phẩm.
- Xem chassis code.
- Xem vendor.
- Xem LED slot.
- Xem version profile.
- Sau này thêm tạo/sửa profile và snapshot.

### Lịch sử scan

Route:

```txt
/scans
```

Mục đích:

- Tra cứu scan OK/NG.
- Xem full code raw.
- Xem duplicate key.
- Xem LED raw.
- Xem local status, server status, final status.
- Xem ng reason.

### Duplicate

Route:

```txt
/duplicates
```

Mục đích:

- Theo dõi `recent_duplicate_keys`.
- Xem first scan record giữ key.
- Xem expires_at.
- Xem kết quả historical duplicate report.

### Đồng bộ

Route:

```txt
/sync
```

Mục đích:

- Xem sync batch.
- Xem request logs.
- Debug máy local gửi gì, server trả gì.
- Sau này hiển thị offline incident.

### Thông báo

Route:

```txt
/notifications
```

Mục đích:

- Xem notification event.
- Xem notification template.
- Theo dõi máy offline, sync có NG, profile update.

### Cài đặt

Route:

```txt
/settings
```

Mục đích:

- Xem server settings.
- Mở Swagger.
- Xem duplicate rule.
- Sau này cấu hình duplicate days, heartbeat timeout, port, DB.

## 4. Song ngữ

App hỗ trợ:

- Tiếng Việt.
- Tiếng Anh.

Mặc định dùng tiếng Việt.

Các text UI nằm trong:

```txt
frontend/lib/i18n.ts
```

Quy ước:

- Không hardcode text dài trực tiếp trong component nếu text đó user nhìn thấy thường xuyên.
- Key tiếng Việt và tiếng Anh phải giữ cùng ý nghĩa.
- Nút đổi ngôn ngữ lưu vào localStorage.

## 5. Theme sáng/tối

App hỗ trợ:

- Light theme.
- Dark theme.

Theme dùng CSS variables trong:

```txt
frontend/app/globals.css
```

Quy ước:

- Không dùng gradient màu.
- Không lạm dụng shadow.
- Border radius tối đa nên giữ khoảng 8px.
- Theme tối phải đủ tương phản.
- Nút đổi theme lưu vào localStorage.

## 6. Feedback hành động

Ứng dụng dùng Sonner cho notification.

Ví dụ:

- Đổi theme thành công.
- Đổi ngôn ngữ thành công.
- Lỗi tải dữ liệu.
- Sau này: tạo profile thành công, update machine thành công, sync command đã gửi.

Không dùng:

- `alert`.
- `confirm`.
- `prompt`.
- Browser notification mặc định.
