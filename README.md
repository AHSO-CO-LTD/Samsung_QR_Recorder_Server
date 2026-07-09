# Samsung QR Recorder Server App

Ứng dụng desktop server cho dự án kiểm tra mã độc nhất TV.

## Cấu trúc

```txt
electron/   Electron shell và installer config
frontend/   Next.js UI
backend/    NestJS API và Swagger
prisma/     Prisma schema server
shared/     Constants/types dùng chung
document/   Tài liệu tiếng Việt chi tiết
```

## Chạy nhanh

```bash
npm run help
npm install
npm run prisma:validate
npm run prisma:generate
npm run build
```

Frontend dev server:

```bash
npm run dev -w frontend
```

Toàn bộ app dev sau khi có PostgreSQL:

```bash
npm run db:seed
npm run dev
```

Lệnh này mở desktop app và chạy API/Web ngầm. Trên Windows, app sẽ hỏi quyền Administrator bằng UAC; nếu bấm No thì app không chạy. Khi được cấp quyền, app dọn các port của dự án trước khi bật service nền. Trong lúc khởi động, app hiện cửa sổ startup và ghi log vào `logs/desktop-runtime.log`. Trong Electron, bấm `F12` liên tiếp 5 lần để mở terminal log ẩn.

Tài khoản mặc định sau khi seed:

```txt
admin / Admin@123456
dev   / Dev@123456
```

Swagger:

```txt
http://127.0.0.1:3979/api/docs
```

Tài liệu chính bắt đầu tại:

```txt
document/00-muc-luc.md
```

Quy ước UI/UX và bộ lệnh root nằm tại:

```txt
document/09-quy-uoc-ui-ux-va-lenh-root.md
```
