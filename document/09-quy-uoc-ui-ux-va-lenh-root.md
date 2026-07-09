# Quy ước UI/UX và bộ lệnh root

Tài liệu này là điểm tham chiếu duy nhất cho quy ước UI/UX và lệnh thao tác dự án từ root.

## 1. Nguyên tắc làm UI/UX

Khi làm UI/UX cho dự án này, luôn dùng taste skill có chọn lọc.

Lưu ý quan trọng: đây là ứng dụng desktop factory dashboard, không phải landing page. Vì vậy chỉ áp dụng những phần taste skill phù hợp với product UI:

- Đọc đúng ngữ cảnh trước khi thiết kế.
- Tránh giao diện AI mặc định.
- Giữ bố cục rõ ràng, có nhịp, có phân cấp.
- Không overdesign.
- Không dùng gradient nếu user không yêu cầu.
- Không lạm dụng shadow, glow, glass, decoration.
- Không dùng browser `alert`, `confirm`, `prompt`.
- Luôn có loading, empty, error state.
- Luôn có feedback bằng Sonner cho thao tác user-facing.

Design read mặc định cho dự án:

```txt
Desktop factory admin/dashboard UI cho kỹ thuật viên và người vận hành, ngôn ngữ thiết kế rõ ràng, chắc chắn, có mật độ dữ liệu vừa cao, dùng TailwindCSS + shadcn/ui + Sonner + Recharts.
```

## 2. Stack UI bắt buộc

Frontend phải bám các công nghệ sau:

- TailwindCSS cho styling.
- shadcn/ui style components cho button, card, badge, table, chart và các component UI nền.
- Sonner cho notification.
- Recharts cho biểu đồ.
- shadcn chart pattern để bọc Recharts bằng design token.

Không dùng:

- Browser alert/confirm/prompt.
- UI library khác nếu chưa được xác nhận.
- Gradient màu trang trí nếu user chưa yêu cầu.
- Component monolithic quá lớn.
- Text hardcode lặp lại nhiều nơi.

## 3. Vị trí file UI quan trọng

```txt
frontend/components/ui/button.tsx
frontend/components/ui/card.tsx
frontend/components/ui/badge.tsx
frontend/components/ui/table.tsx
frontend/components/ui/chart.tsx
frontend/components/layout/app-shell.tsx
frontend/features/dashboard/scan-trend-chart.tsx
frontend/lib/i18n.ts
frontend/app/globals.css
```

## 4. Quy ước TailwindCSS

- Dùng CSS variables trong `frontend/app/globals.css` cho màu semantic.
- Dùng class Tailwind trực tiếp trong component.
- Không hardcode màu quá nhiều trong component.
- Không dùng gradient nếu chưa được yêu cầu.
- Radius mặc định giữ khoảng 4px đến 8px.
- Layout dashboard ưu tiên grid rõ ràng.
- Text trong button không được wrap ở desktop.
- Responsive phải có collapse rõ ràng cho mobile.

## 5. Quy ước shadcn/ui

Component shadcn/ui được lưu như code nội bộ, không phụ thuộc runtime framework riêng.

Khi thêm component mới:

1. Đặt trong `frontend/components/ui/`.
2. Dùng `cn()` từ `frontend/lib/utils.ts`.
3. Dùng token màu semantic.
4. Có focus state và disabled state nếu là interactive component.
5. Không copy default rồi để nguyên nếu giao diện chưa hợp dự án.

Component đã có:

- `Button`
- `Card`
- `Badge`
- `Table`
- `ChartContainer`
- `ChartTooltipContent`
- `ChartLegendContent`

## 6. Quy ước Sonner

Mọi hành động user-facing phải có feedback:

- Thành công: `toast.success(...)`
- Lỗi: `toast.error(...)`
- Cảnh báo: `toast.warning(...)`
- Đang xử lý: dùng loading state trong UI, sau này có thể dùng `toast.promise(...)`

Không dùng:

```ts
alert(...)
confirm(...)
prompt(...)
```

## 7. Quy ước Recharts và shadcn chart

Biểu đồ phải dùng Recharts qua wrapper shadcn chart:

```txt
frontend/components/ui/chart.tsx
```

Khi thêm chart:

1. Tạo component riêng trong `frontend/features/<module>/`.
2. Dùng `ChartContainer`.
3. Khai báo `chartConfig`.
4. Dùng CSS variable cho màu chart.
5. Không hardcode dữ liệu giả mà không ghi chú.
6. Sau khi có API thống kê, thay dữ liệu mẫu bằng dữ liệu thật từ backend.

Ví dụ hiện tại:

```txt
frontend/features/dashboard/scan-trend-chart.tsx
```

## 8. Quy ước bảng dữ liệu

Bảng dùng shadcn-style table:

```txt
frontend/components/ui/table.tsx
```

Khi làm màn dữ liệu thật:

- Có filter theo ngày, machine, profile, status nếu phù hợp.
- Có empty state khi chưa có dữ liệu.
- Có error state khi API lỗi.
- Không nhồi JSON raw làm UI production.
- JSON viewer chỉ dùng tạm ở giai đoạn scaffold.

## 9. Bộ lệnh root

Tất cả lệnh thao tác chính chạy từ root dự án.

Xem menu lệnh:

```bash
npm run help
```

## 10. Setup

Cài dependency và generate Prisma Client:

```bash
npm run setup
```

Cài lại toàn bộ dependency:

```bash
npm run install:all
```

Reset workspace nhẹ:

```bash
npm run reset
```

Lệnh reset sẽ:

1. Xóa build cache bằng `npm run clean`.
2. Chạy `npm install`.
3. Chạy `npm run prisma:generate`.

Clean build cache:

```bash
npm run clean
```

## 11. Chạy dev

Chạy toàn bộ API, Web và Electron:

```bash
npm run dev
```

Lệnh này tương đương:

```bash
npm run dev:desktop
```

Chạy riêng backend:

```bash
npm run dev:api
```

Backend dev dùng `ts-node-dev`, không dùng `tsx watch`, vì NestJS cần decorator metadata để inject service vào controller.

Chạy riêng frontend:

```bash
npm run dev:web
```

Chạy riêng Electron:

```bash
npm run dev:desktop
```

Lệnh này chạy giống app thật trong môi trường dev:

- Electron là process chính hiển thị UI.
- Trên Windows, app sẽ hỏi quyền Administrator bằng UAC trước khi mở.
- Nếu người dùng bấm No hoặc từ chối quyền Administrator, app không chạy tiếp.
- Khi đã có quyền Administrator, app sẽ dọn các port thuộc dự án trước khi bật service nền.
- Port mặc định được lấy từ `.env`: `API_PORT=3979` và `FRONTEND_PORT=3969`.
- Nếu có process khác đang chiếm các port này, app sẽ kill process đó để nhường port cho dự án.
- Trong lúc khởi động, Electron hiển thị cửa sổ startup để báo bước đang chạy.
- Log startup được ghi vào `logs/desktop-runtime.log`.
- NestJS API chạy ngầm tại `http://127.0.0.1:3979`.
- Next.js UI chạy ngầm tại `http://127.0.0.1:3969`.
- Terminal chính không hiển thị log dài của Web/API.
- Log Web/API được gom vào terminal riêng trong Electron.

Để mở terminal/log ẩn trong Electron:

```txt
Bấm F12 liên tiếp 5 lần
```

Cửa sổ terminal này mặc định ẩn. Khi đóng cửa sổ terminal, nó chỉ bị ẩn lại, không dừng API/Web.

Nếu chỉ muốn chạy Web rồi mở Electron, không chạy API:

```bash
npm run dev:ui
```

Lệnh `dev:ui` là chế độ debug UI, vẫn hiển thị log ở terminal vì chạy bằng `concurrently`.

Nếu UI đã chạy sẵn và chỉ muốn mở Electron:

```bash
npm run dev:electron
```

## 12. Build và kiểm tra

Build toàn bộ:

```bash
npm run build
```

Validate Prisma và build toàn bộ:

```bash
npm run check
```

Build riêng backend:

```bash
npm run build:api
```

Build riêng frontend:

```bash
npm run build:web
```

Build riêng Electron:

```bash
npm run build:desktop
```

Build riêng shared:

```bash
npm run build:shared
```

## 13. Database

Validate Prisma schema:

```bash
npm run db:validate
```

Generate Prisma Client:

```bash
npm run db:generate
```

Tạo/chạy migration dev:

```bash
npm run db:migrate
```

Deploy migration production:

```bash
npm run db:deploy
```

Mở Prisma Studio:

```bash
npm run db:studio
```

Seed tài khoản mặc định:

```bash
npm run db:seed
```

Tài khoản seed mặc định:

- `admin` / `Admin@123456`
- `dev` / `Dev@123456`

Màn hình đăng nhập chỉ hiển thị sau khi Electron xác nhận API và Web đã sẵn sàng. Nếu chọn nhớ mật khẩu, app lưu token phiên đăng nhập để lần mở sau tự validate với backend và tự đăng nhập nếu còn hợp lệ.

## 14. Cài thư viện

Cài thư viện cho frontend:

```bash
npm run add:web -- recharts
```

Cài dev dependency cho frontend:

```bash
npm run add:web -- -D some-dev-package
```

Cài thư viện cho backend:

```bash
npm run add:api -- @nestjs/jwt
```

Cài thư viện cho Electron:

```bash
npm run add:desktop -- electron-updater
```

Cài thư viện cho shared:

```bash
npm run add:shared -- zod
```

Cài thư viện ở root:

```bash
npm run add:root -- -D eslint
```

## 15. Checklist trước khi kết thúc task UI

- Đã dùng taste skill có chọn lọc.
- UI dùng TailwindCSS.
- Component mới theo shadcn/ui style.
- Notification dùng Sonner.
- Chart dùng Recharts qua shadcn chart.
- Màn dữ liệu có loading, error, empty state.
- Không dùng gradient nếu user chưa yêu cầu.
- Không dùng browser alert/confirm/prompt.
- `npm run build` pass.
- Nếu sửa Prisma, `npm run db:validate` pass.
