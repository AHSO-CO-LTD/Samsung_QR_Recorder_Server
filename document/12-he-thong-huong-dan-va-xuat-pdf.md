# Hệ thống hướng dẫn trong app và xuất PDF

## 1. Mục tiêu

Hệ thống hướng dẫn giúp kỹ thuật viên và người vận hành:

- Tra cứu quy trình theo từng chức năng tại route `/guides`.
- Tìm nhanh theo tiêu đề, mô tả hoặc nội dung bước.
- Mở hướng dẫn theo từng bước trong dialog.
- Đọc nội dung thao tác trước rồi mới xem ảnh minh họa.
- Xuất toàn bộ tài liệu hướng dẫn thành PDF.

Catalog trong app, dialog và PDF dùng chung một nguồn dữ liệu để tránh lệch nội dung.

## 2. Nguồn dữ liệu

Mỗi hướng dẫn nằm trong:

```txt
frontend/public/guides/<order>-<slug>/
```

Ví dụ:

```txt
20-local-manual/
  guide.json
  01.json
  01.png
  02.json
  02.png
```

`guide.json`:

```json
{
  "title": "Một số lưu ý ở máy local",
  "description": "Lưu ý một số tính năng mới và cách sử dụng chúng."
}
```

Metadata của một bước:

```json
{
  "title": "Thay đổi địa chỉ IP của server",
  "content": "Nhấn nút Change server IP, nhập địa chỉ mới và xác nhận."
}
```

## 3. Quy ước bắt buộc

- Folder guide bắt đầu bằng số order và dấu `-` hoặc `_`.
- `guide.json` bắt buộc có `title`.
- Metadata bước chỉ dùng tên số liên tục: `01.json`, `02.json`, `03.json`.
- Ảnh dùng cùng basename với metadata: `01.png` đi với `01.json`.
- Không bỏ số hoặc trùng số bước.
- Ảnh hỗ trợ `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`.
- Guide có `"hidden": true` trong `guide.json` sẽ không được đưa vào manifest.
- Khi thêm order mới, phải khai báo group chứa order đó trong `guides-view.tsx`.

## 4. Tạo manifest

Script:

```txt
scripts/generate-guide-manifest.mjs
```

Lệnh chạy:

```bash
npm run guides:manifest
```

Kết quả:

```txt
frontend/public/guides/manifest.json
```

Dev/build frontend tự chạy lại manifest. Nếu metadata thiếu, JSON lỗi hoặc thứ tự không liên tục, build frontend sẽ dừng và báo chính xác file lỗi.

## 5. Catalog và dialog

Các file chính:

```txt
frontend/features/guides/guide-catalog.ts
frontend/features/guides/guides-view.tsx
frontend/features/guides/guide-dialog.tsx
frontend/features/guides/guide-slide-panel.tsx
```

Luồng:

1. `loadGuideCatalog()` đọc `manifest.json`.
2. `GuidesView` nhóm guide theo order và hỗ trợ tìm kiếm.
3. Người dùng chọn một guide để mở `GuideDialog`.
4. `GuideSlidePanel` hiển thị từng bước.

Thứ tự đọc của mỗi bước:

1. Số bước.
2. Tiêu đề.
3. Nội dung thao tác.
4. Ảnh minh họa.

Thứ tự này áp dụng chung cho mọi guide hiện có và guide thêm mới.

## 6. Xuất PDF

Có hai luồng xuất PDF:

### Electron

```txt
frontend/features/guides/guide-manual-pdf-export.tsx
electron/src/main.ts
```

Frontend render tài liệu in ẩn, chờ font/ảnh sẵn sàng rồi Electron mở hộp thoại lưu PDF.

### Browser fallback

```txt
frontend/features/guides/guide-manual-browser-pdf.ts
```

Browser dùng `pdfmake`. Nếu hỗ trợ File System Access API, người dùng chọn nơi lưu; nếu không, file được tải về thư mục download mặc định và Sonner thông báo rõ.

Cả hai luồng dùng thứ tự:

```txt
bước -> tiêu đề -> nội dung -> ảnh
```

## 7. Thêm hướng dẫn máy local

Guide `20-local-manual` gồm sáu nội dung:

1. Thay đổi địa chỉ IP server.
2. Thêm reader mới.
3. Xóa reader.
4. Bật máy quét mã vạch cầm tay HID.
5. Cấu hình thời gian chờ trước khi báo lỗi.
6. Đồng bộ mã sản phẩm từ server.

Guide thuộc group `Hướng dẫn máy local` và xuất hiện trong cả catalog lẫn mục lục PDF.

## 8. Checklist thêm guide mới

1. Tạo folder có order chưa sử dụng.
2. Tạo `guide.json`.
3. Tạo metadata bước từ `01.json`.
4. Thêm ảnh cùng basename nếu có.
5. Đảm bảo số bước liên tục.
6. Cập nhật group trong `guides-view.tsx` nếu order nằm ngoài các range hiện tại.
7. Chạy:

```bash
npm run guides:manifest
npm run build:web
```

8. Kiểm tra `/guides`.
9. Mở từng bước và xác nhận nội dung nằm trên ảnh.
10. Xuất PDF và kiểm tra mục lục, tiếng Việt, ảnh và thứ tự nội dung.

## 9. Xử lý lỗi thường gặp

### WEB không khởi động

Kiểm tra:

```txt
logs/desktop-runtime.log
```

Nếu log báo `Step metadata is missing for image`, kiểm tra tên JSON có khớp chính xác basename của ảnh và chỉ dùng số thứ tự.

### Guide có trong manifest nhưng không xuất hiện

- Kiểm tra guide có ít nhất một ảnh nếu catalog đang ẩn guide không có ảnh.
- Kiểm tra order của guide thuộc một group trong `guides-view.tsx`.
- Kiểm tra `guide.json.hidden` không phải `true`.

### PDF thiếu ảnh

- Mở trực tiếp URL ảnh từ `/guides/...`.
- Kiểm tra file ảnh có trong `frontend/public/guides`.
- Chạy lại manifest và build frontend.
