# Checklist phát triển

## 1. Checklist kỹ thuật nền

- [x] Có cấu trúc `electron/`.
- [x] Có cấu trúc `frontend/`.
- [x] Có cấu trúc `backend/`.
- [x] Có cấu trúc `prisma/`.
- [x] Có cấu trúc `shared/`.
- [x] Có cấu trúc `document/`.
- [x] Có npm workspaces.
- [x] Có Prisma schema server.
- [x] Có NestJS API.
- [x] Có Swagger.
- [x] Có Next.js UI.
- [x] Có Electron shell.
- [x] Có song ngữ Việt/Anh.
- [x] Có theme sáng/tối.

## 2. Checklist nghiệp vụ duplicate

- [x] Local OK mới kiểm duplicate.
- [x] Local NG chỉ lưu trace.
- [x] Local NG không insert `recent_duplicate_keys`.
- [x] Server duplicate không insert key mới.
- [x] Duplicate key chính là `profile_id + duplicate_key`.
- [x] OK server mới insert `recent_duplicate_keys`.
- [ ] Bổ sung xử lý race condition khi insert unique key bị trùng.
- [ ] Bổ sung request log cho submit scan.
- [ ] Bổ sung notification khi server duplicate.
- [ ] Bổ sung seed error code.

## 3. Checklist API

- [x] `GET /api/health`.
- [x] `POST /api/machines/heartbeat`.
- [x] `GET /api/machines`.
- [x] `POST /api/scans/submit`.
- [x] `GET /api/scans`.
- [x] `GET /api/profiles`.
- [x] `GET /api/duplicates/recent-keys`.
- [x] `GET /api/duplicates/historical-results`.
- [x] `GET /api/sync/batches`.
- [x] `GET /api/sync/request-logs`.
- [x] `GET /api/notifications`.
- [x] `GET /api/notifications/templates`.
- [x] `GET /api/settings/server`.
- [ ] Thêm CRUD machines.
- [ ] Thêm CRUD profiles.
- [ ] Thêm CRUD vendors/chassis/LED.
- [ ] Thêm command polling cho máy local.
- [ ] Thêm batch submit endpoint.

## 4. Checklist UI

- [x] Có sidebar.
- [x] Có header.
- [x] Có dashboard.
- [x] Có màn machines.
- [x] Có màn profiles.
- [x] Có màn scans.
- [x] Có màn duplicates.
- [x] Có màn sync.
- [x] Có màn notifications.
- [x] Có màn settings.
- [x] Có loading state.
- [x] Có error state.
- [x] Có empty state.
- [x] Có Sonner notification.
- [ ] Thay JSON viewer bằng bảng dữ liệu chuyên dụng.
- [ ] Thêm form tạo/sửa profile.
- [ ] Thêm form tạo/sửa machine.
- [ ] Thêm filter ngày/profile/machine cho scan.
- [ ] Thêm export report.

## 5. Checklist accessibility

- [x] Dùng semantic layout cơ bản.
- [x] Nút có focus outline.
- [x] Có aria label cho nav.
- [x] Màu có contrast cơ bản cho light/dark.
- [ ] Kiểm tra keyboard navigation toàn bộ form sau khi thêm CRUD.
- [ ] Kiểm tra screen reader label cho field nhập liệu.

## 6. Checklist trước khi giao bản chạy thử

- [x] `npm install` sạch.
- [x] `npm run prisma:validate` pass.
- [x] `npm run prisma:generate` pass.
- [x] `npm run build -w backend` pass.
- [x] `npm run build -w frontend` pass.
- [x] `npm run build -w electron` pass.
- [ ] Backend chạy được với PostgreSQL thật.
- [ ] Swagger mở được.
- [ ] Heartbeat local test pass.
- [ ] Submit scan OK pass.
- [ ] Submit scan duplicate pass.
- [ ] Submit scan local NG pass.
- [ ] Electron mở UI được.
- [ ] Installer build được.

## 8. Ghi chú audit dependency hiện tại

Sau khi nâng Electron lên `43.1.0` và electron-builder lên `26.15.3`, audit production chỉ còn cảnh báo moderate từ `next@16.2.10` do dependency nội bộ `postcss@8.4.31`.

Không chạy `npm audit fix --force` ở thời điểm này vì npm đề xuất downgrade Next về `9.3.3`, đây là thay đổi phá vỡ kiến trúc hiện tại. Khi Next stable phát hành bản dùng PostCSS đã vá, cần nâng Next và chạy lại audit.

## 7. Checklist thiết kế cần xin xác nhận trước khi làm tiếp

- [ ] Có cần màn đăng nhập không.
- [ ] Role nào được thấy Swagger.
- [ ] Có cần first-run setup database không.
- [ ] Có cần app tự cài PostgreSQL không hay dùng PostgreSQL cài riêng.
- [ ] Duplicate window mặc định chính xác là 30 hay 31 ngày.
- [ ] Local duplicate scope là theo ngày, theo ca hay ngày + máy.
- [ ] Có cần batch sync endpoint ngay phase 1 không.
