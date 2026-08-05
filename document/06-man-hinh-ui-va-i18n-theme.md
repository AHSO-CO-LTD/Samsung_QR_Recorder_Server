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

- Hiển thị trạng thái API và trạng thái máy local.
- Hiển thị bốn biểu đồ đường: Tổng màu xanh dương, OK màu xanh lá, NG màu đỏ và Rework màu cam.
- Mỗi biểu đồ hỗ trợ các mốc hôm nay, 7 ngày, 30 ngày, 1 năm và toàn bộ; lựa chọn được lưu riêng trên máy.
- Dữ liệu theo năm dùng nhãn tháng theo ngôn ngữ hiện tại; không ép cố định đủ 12 điểm nếu khoảng dữ liệu không yêu cầu.
- Rework hiện mang nhãn `Sắp có` và trả về 0 cho đến khi có logic xác định mã NG được sửa thành OK.
- Bên dưới khu vực máy local có biểu đồ xếp hạng toàn bộ lỗi NG từ nhiều đến ít theo mốc thời gian đã chọn.
- Xếp hạng vẫn hiển thị lỗi đã biết với giá trị 0 khi khoảng thời gian chưa ghi nhận lỗi.

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
- Bộ lọc `Line` thay cho lọc theo máy. Danh sách line được lấy từ các máy hiện có và loại bỏ giá trị trùng.
- Bộ lọc `Kết quả` hỗ trợ OK, NG và PENDING; bộ lọc `Loại lỗi` lấy động từ danh sách lỗi đã cấu hình hoặc đã ghi nhận.
- Hai biểu đồ dùng cùng bộ lọc với danh sách quét: `Tổng quan kết quả quét` hiển thị donut OK/NG và các tổng số; `Xếp hạng lỗi theo máy` dùng biểu đồ thanh ngang giống ranking ở trang Tổng quan, hiển thị số NG và tỷ lệ của toàn bộ máy đang hoạt động. Máy mới được tự động bổ sung vào ranking.
- Chọn loại lỗi tự chuyển kết quả sang NG. Chuyển kết quả sang OK hoặc PENDING tự xóa loại lỗi để tránh điều kiện xung đột.
- Ẩn tab danh sách mã trùng lặp vì trùng chức năng với luồng kiểm tra trùng chuyên biệt.
- Tab khóa trùng đang hoạt động chỉ hiển thị cho DEV và dùng phân trang phía server.

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

### Cấu hình lỗi

Route:

```txt
/error-config
```

Mục đích:

- Hợp nhất mã lỗi đã cấu hình với các mã thực tế trong `scan_records` và `scan_led_items`.
- Tự hiển thị mã lỗi mới được máy local gửi lên mà không cần cập nhật danh sách cố định trong frontend.
- Phân biệt mã đã định danh và chưa định danh.
- Tìm trực tiếp theo mã lỗi; nhóm lỗi là thông tin tùy chọn, không dùng để ép thứ tự hiển thị.
- Cho phép kỹ thuật viên, admin và dev đặt riêng tên tiếng Việt, tên tiếng Anh, thông báo mặc định, mức độ, nhóm tùy chọn và hướng xử lý local.
- Ghi audit log cho thao tác định danh hoặc cập nhật cấu hình lỗi.
- Giữ cơ chế hiển thị dự phòng cho mã chưa định danh.

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

### Khôi phục tài khoản DEV

- Chỉ hoạt động khi người dùng đang đăng nhập bằng tài khoản ADMIN.
- Giữ `Ctrl` và nhấn/thả `F11` đủ 10 lần trong tối đa 5 giây để mở modal ẩn.
- Electron bắt phím ở tiến trình desktop rồi chuyển sự kiện an toàn vào frontend; trình duyệt dùng listener capture làm phương án dự phòng.
- Nếu đã có tài khoản DEV, ADMIN có thể đặt lại mật khẩu và kích hoạt lại tài khoản được chọn.
- Nếu chưa có tài khoản DEV, modal cho phép tạo tài khoản DEV đầu tiên.
- API kiểm tra lại vai trò ADMIN, băm mật khẩu bằng PBKDF2 và ghi audit log; quá 5 giây bộ đếm bắt đầu lại.

### Hướng dẫn

Route:

```txt
/guides
```

Mục đích:

- Tra cứu toàn bộ hướng dẫn theo nhóm nghiệp vụ.
- Tìm theo tên, mô tả, tiêu đề bước hoặc nội dung bước.
- Mở hướng dẫn chi tiết theo từng bước.
- Đọc nội dung thao tác trước, sau đó xem ảnh minh họa.
- Xuất toàn bộ catalog hướng dẫn thành PDF.
- Hiển thị đầy đủ loading, error, empty state và feedback bằng Sonner.

Chi tiết kiến trúc và quy trình cập nhật nội dung nằm tại:

```txt
document/12-he-thong-huong-dan-va-xuat-pdf.md
```

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
