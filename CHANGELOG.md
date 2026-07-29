# Changelog

## 1.1.7 - 2026-07-29

### Added

- Thêm bộ chọn ngày và ngày giờ dùng chung theo shadcn `Popover + Calendar`.
- Bổ sung kiểm thử định dạng ngày, ngày giờ và chuyển đổi giá trị cho bộ chọn lịch.

### Changed

- Toàn bộ màn hình nhập/chọn ngày hiển thị theo thứ tự `dd/MM/yyyy`.
- Các trường có giờ hiển thị theo định dạng `dd/MM/yyyy HH:mm`.
- Chuẩn hóa ngày hiển thị ở cả giao diện tiếng Việt, tiếng Anh và biểu đồ xu hướng.
- Báo cáo Excel giữ kiểu dữ liệu ngày thật và dùng định dạng `dd/mm/yyyy hh:mm:ss`.

### Fixed

- Loại bỏ định dạng `MM/DD/YYYY` phụ thuộc locale của Chromium trên các bộ lọc lịch.

## 1.1.6 - 2026-07-29

### Added

- Thêm nhóm `Hướng dẫn máy local` vào catalog `/guides`.
- Thêm sáu bước hướng dẫn máy local kèm ảnh minh họa.
- Đưa hướng dẫn máy local vào mục lục và nội dung PDF.
- Bổ sung tài liệu kiến trúc, quy ước nội dung và kiểm tra hệ thống hướng dẫn.

### Changed

- Toàn bộ modal hướng dẫn hiển thị nội dung thao tác trước ảnh minh họa.
- Electron PDF và browser PDF dùng cùng thứ tự nội dung trước ảnh.
- Cập nhật tài liệu UI, installer và quy trình GitHub Release.

### Fixed

- Chuẩn hóa tên metadata/ảnh guide máy local để frontend tạo manifest và khởi động ổn định.
