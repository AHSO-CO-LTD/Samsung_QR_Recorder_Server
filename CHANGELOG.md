# Changelog

## 1.1.8 - 2026-08-03

### Added

- Thêm màn hình `Cấu hình lỗi`, tự hợp nhất các mã lỗi đã cấu hình với mã NG thực tế nhận từ máy local và phân biệt trạng thái đã/chưa định danh.
- Bổ sung tên lỗi riêng cho tiếng Việt và tiếng Anh; chỉ dùng mã lỗi làm nội dung dự phòng khi ngôn ngữ hiện tại chưa có tên.
- Thêm bộ lọc loại lỗi và bộ lọc line cho lịch sử quét; loại lỗi mới nhận từ máy local tự xuất hiện trong danh sách.
- Thêm bốn biểu đồ đường Tổng, OK, NG và Rework trên trang tổng quan cùng các mốc hôm nay, 7 ngày, 30 ngày, 1 năm và toàn bộ.
- Thêm biểu đồ xếp hạng lỗi NG từ nhiều đến ít, bao gồm cả lỗi có số lượng bằng 0 trong khoảng thời gian đã chọn.
- Thêm luồng khôi phục hoặc tạo tài khoản DEV dành riêng cho ADMIN bằng thao tác giữ `Ctrl` và nhấn `F11` 10 lần trong tối đa 5 giây.
- Bổ sung phân trang phía server cho danh sách khóa trùng đang hoạt động.

### Changed

- Bộ lọc cuối của lịch sử quét được chuẩn hóa thành `Kết quả`; chọn loại lỗi tự chuyển kết quả sang NG, còn chuyển sang OK/PENDING tự xóa loại lỗi.
- Tên lỗi trên bộ lọc và dữ liệu quét chỉ hiển thị theo ngôn ngữ hiện tại, không ghép thêm mã khi đã có tên.
- Nhãn biểu đồ theo năm hiển thị theo tháng, dùng `T1`, `T2`... cho tiếng Việt và tên tháng viết tắt cho tiếng Anh.
- Ẩn tab danh sách mã trùng lặp; tab khóa đang hoạt động chỉ còn hiển thị cho tài khoản DEV.
- Nhóm lỗi chuyển thành thông tin tùy chọn vì việc tìm kiếm và định danh thực hiện trực tiếp theo mã lỗi.
- Biểu đồ Rework được giữ ở trạng thái `Sắp có` để chờ logic chuyển mã NG đã sửa thành OK.

### Fixed

- Electron bắt trực tiếp phím `Ctrl+F11`, tránh phím chức năng bị shell chặn trước khi tới giao diện.
- Bộ đếm phím khôi phục DEV bỏ qua auto-repeat và tự bắt đầu lại nếu quá cửa sổ 5 giây.
- Danh sách xếp hạng lỗi không còn biến mất khi khoảng thời gian được chọn chưa ghi nhận NG.

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
