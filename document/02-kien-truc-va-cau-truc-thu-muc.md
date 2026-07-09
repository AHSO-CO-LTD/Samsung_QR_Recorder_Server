# Kiến trúc và cấu trúc thư mục

## 1. Kiến trúc tổng thể

Ứng dụng server được thiết kế là desktop app có installer, không phải website public. Tuy nhiên bên trong app vẫn tách rõ giao diện và backend để dễ vận hành, dễ test và dễ tích hợp với máy local Python.

Luồng tổng thể:

```txt
Máy local Python
  -> gọi NestJS API qua LAN
  -> NestJS xử lý nghiệp vụ
  -> Prisma ghi/đọc PostgreSQL

Electron desktop app
  -> mở Next.js UI
  -> Next.js UI gọi NestJS API
  -> NestJS API trả dữ liệu để hiển thị
```

## 2. Công nghệ sử dụng

### Electron

Electron là desktop shell. Vai trò:

- Mở cửa sổ ứng dụng server.
- Đóng gói thành file setup cài đặt.
- Về sau có thể quản lý lifecycle của backend/frontend khi chạy production.
- Về sau có thể thêm màn hình first-run setup.

### Next.js

Next.js là frontend UI. Vai trò:

- Hiển thị dashboard.
- Quản lý máy local.
- Quản lý profile.
- Tra cứu scan.
- Theo dõi duplicate.
- Theo dõi sync/offline.
- Theo dõi notification.
- Cài đặt server.

Next.js không xử lý nghiệp vụ duplicate. Nghiệp vụ duplicate nằm trong NestJS.

### NestJS

NestJS là backend API chính. Vai trò:

- Nhận request từ máy local Python.
- Nhận request từ Next.js UI.
- Kiểm duplicate.
- Ghi scan.
- Ghi recent duplicate key.
- Ghi heartbeat.
- Ghi request log, notification và audit.
- Cung cấp Swagger.

### PostgreSQL

PostgreSQL là database chính thức của máy server. Vai trò:

- Lưu master data.
- Lưu scan history.
- Lưu duplicate key đang active.
- Lưu trạng thái máy local.
- Lưu sync batch.
- Lưu notification và audit.

### Prisma

Prisma là ORM và migration layer. Vai trò:

- Định nghĩa schema server.
- Sinh Prisma Client.
- Quản lý migration.
- Giúp backend thao tác DB có type safety.

## 3. Lý do tách frontend và backend

Dù đây là desktop app, vẫn nên tách FE/BE vì:

- Máy local Python cần gọi API ổn định qua LAN.
- Duplicate check cần transaction và unique constraint chắc chắn.
- Swagger cần nằm ở backend.
- Backend có thể chạy độc lập để test API.
- Frontend chỉ tập trung UI.
- Sau này nếu cần realtime hoặc sync phức tạp, NestJS phù hợp hơn Next.js API routes.

Không nên dùng Next.js làm backend chính cho dự án này vì Next.js phù hợp UI/BFF hơn là backend vận hành nhà máy có heartbeat, sync batch, duplicate race condition và audit.

## 4. Cấu trúc thư mục

```txt
electron/
  src/
    main.ts
    preload.ts
  electron-builder.yml

frontend/
  app/
  components/
  features/
  lib/

backend/
  src/
    modules/
    prisma/
    common/

prisma/
  schema.prisma

shared/
  src/

document/
```

## 5. Vai trò từng thư mục

### `electron/`

Chứa code Electron shell. Hiện tại Electron mở URL frontend tại `http://127.0.0.1:3969`. Khi đóng gói production, phần này sẽ được mở rộng để chạy UI build và backend build phù hợp với installer.

### `frontend/`

Chứa Next.js UI. UI đã có nền:

- Layout desktop.
- Sidebar.
- Topbar.
- Hỗ trợ tiếng Việt và tiếng Anh.
- Hỗ trợ theme sáng/tối.
- Sonner notification.
- Các màn hình chính.

### `backend/`

Chứa NestJS API. Backend đã có nền:

- Swagger tại `/api/docs`.
- Health check tại `/api/health`.
- Machines heartbeat.
- Submit scan.
- Profiles.
- Scans.
- Duplicates.
- Sync.
- Notifications.
- Settings.

### `prisma/`

Chứa schema Prisma server. Schema hiện tại bám theo thiết kế Server DB trong `db-design.pdf`, gồm 23 bảng server.

### `shared/`

Chứa constants/type dùng chung. Hiện tại có:

- Locale.
- Theme.
- Scan status.
- Error code.
- Notification code.
- API response type.

### `document/`

Chứa tài liệu tiếng Việt chi tiết của dự án.
