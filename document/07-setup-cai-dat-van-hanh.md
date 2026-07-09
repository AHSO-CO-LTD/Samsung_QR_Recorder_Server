# Setup, cài đặt và vận hành

## 1. Yêu cầu môi trường phát triển

Cần có:

- Node.js 22 trở lên.
- npm 10 trở lên.
- PostgreSQL.
- Windows để test Electron installer.

Workspace hiện tại dùng npm workspaces vì máy hiện chưa có `pnpm`.

## 2. Cài dependency

Từ thư mục:

```txt
root dự án
```

Chạy:

```bash
npm install
```

## 3. Cấu hình môi trường

Copy file:

```txt
.env.example
```

thành:

```txt
.env
```

Cấu hình tối thiểu:

```txt
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/samsung_qrrecorder"
API_HOST="0.0.0.0"
API_PORT="3979"
FRONTEND_PORT="3969"
```

Ý nghĩa:

- `DATABASE_URL`: chuỗi kết nối PostgreSQL.
- `API_HOST`: `0.0.0.0` để máy local trong LAN gọi được.
- `API_PORT`: port backend NestJS.
- `FRONTEND_PORT`: port Next.js UI khi dev.

## 4. Prisma

Validate schema:

```bash
npm run prisma:validate
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Chạy migration dev:

```bash
npm run prisma:migrate
```

Mở Prisma Studio:

```bash
npm run prisma:studio
```

Seed tài khoản đăng nhập mặc định:

```bash
npm run db:seed
```

Tài khoản mặc định dùng cho dev:

- `admin` / `Admin@123456`
- `dev` / `Dev@123456`

Có thể đổi trước khi seed bằng các biến trong `.env`: `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, `SEED_DEV_USERNAME`, `SEED_DEV_PASSWORD`.

## 5. Chạy dev

Chạy toàn bộ:

```bash
npm run dev
```

Lệnh này chạy:

- Backend NestJS tại `http://127.0.0.1:3979/api`.
- Swagger tại `http://127.0.0.1:3979/api/docs`.
- Frontend Next.js tại `http://127.0.0.1:3969`.
- Electron shell mở UI.

Trên Windows, `npm run dev` và `npm run dev:desktop` sẽ hỏi quyền Administrator bằng UAC trước khi mở app. Nếu người dùng từ chối quyền này, app không chạy tiếp. Khi đã có quyền Administrator, Electron sẽ tự dọn các port của dự án theo `.env` trước khi bật API/Web nền, giúp tránh lỗi port đang bị process khác chiếm.

Electron chỉ mở cửa sổ chính khi backend API và frontend Next.js đều sẵn sàng. Sau đó người dùng sẽ thấy màn hình đăng nhập. Nếu user chọn nhớ mật khẩu, lần mở app sau frontend sẽ validate token với backend và tự đăng nhập nếu phiên còn hợp lệ.

## 6. Build

Build toàn bộ:

```bash
npm run build
```

Build từng phần:

```bash
npm run build -w shared
npm run build -w backend
npm run build -w frontend
npm run build -w electron
```

## 7. Installer

Electron builder config nằm ở:

```txt
electron/electron-builder.yml
```

Định hướng production:

- Build backend NestJS ra `backend/dist`.
- Build Next.js ra standalone hoặc static runtime phù hợp.
- Electron start backend local.
- Electron load frontend local.
- Installer cài app vào máy server.
- Cần có first-run setup để cấu hình database và port.

Hiện tại scaffold đã có nền Electron và config installer, nhưng lifecycle production cần hoàn thiện thêm ở giai đoạn sau.

## 8. Vận hành trong nhà máy

Máy server cần:

- Có IP LAN ổn định.
- Port API mở cho máy local.
- PostgreSQL chạy ổn định.
- Backup database định kỳ.
- Người vận hành biết cách kiểm tra dashboard, sync, duplicate và notifications.

Máy local cần:

- Biết `SERVER-IP`.
- Biết `API_PORT`.
- Có `machine_code` đã đăng ký trên server.
- Heartbeat định kỳ.
- Lưu local DB trước khi gửi server.

## 9. Các bước nên làm trước chạy thử thật

1. Tạo database PostgreSQL.
2. Chạy migration.
3. Seed `server_settings`.
4. Seed `machines`.
5. Seed `vendors`.
6. Seed `chassis_codes`, `led_codes`, `product_profiles`.
7. Tạo `profile_snapshots`.
8. Tạo `error_codes`.
9. Tạo `notification_templates`.
10. Test `POST /api/machines/heartbeat`.
11. Test `POST /api/scans/submit` với local OK.
12. Test gửi lại cùng duplicate key để nhận `SERVER_DUPLICATE`.
13. Test local NG để chắc chắn server skip duplicate.
