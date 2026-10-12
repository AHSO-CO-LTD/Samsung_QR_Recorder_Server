# Project Profile - Samsung QR Recorder Server

Last reviewed: 2026-10-12

## Project

- Ứng dụng desktop server nội bộ cho dây chuyền sản xuất TV, dùng để quản lý máy local và kiểm tra mã QR/barcode trùng lặp.
- Server là nguồn dữ liệu chính thức cho profile, lịch sử scan, duplicate, đồng bộ, thông báo và audit.
- Ứng dụng máy local viết bằng Python nằm ngoài repository này. Máy local luôn chủ động kết nối tới server qua LAN.
- Môi trường đích là Windows factory workstation; ứng dụng và installer yêu cầu quyền Administrator.

## Stack

- Monorepo: npm workspaces, Node.js >= 22, npm >= 10.
- Frontend: Next.js 16 App Router, React 19, TypeScript strict, TailwindCSS 3, Radix/shadcn-style components, Sonner, Recharts, Socket.IO client.
- Backend: NestJS 11, TypeScript strict, Swagger/OpenAPI, class-validator, Socket.IO.
- Desktop: Electron 43, electron-builder 26, NSIS.
- Database: PostgreSQL, Prisma 6.19.3.
- Shared: TypeScript constants/types trong workspace `shared/`.

## Repository Boundaries

- `frontend/`: giao diện Next.js chạy trong Electron.
- `backend/`: NestJS API, WebSocket gateway và nghiệp vụ server.
- `electron/`: desktop shell, lifecycle API/Web, licensing, update và IPC.
- `prisma/`: schema và migration PostgreSQL server.
- `shared/`: constants/types dùng chung; hiện mức chia sẻ còn nhỏ.
- `setup/`: NSIS hooks và PowerShell provisioning/uninstall.
- `scripts/`: build runtime, dev desktop, seed và tạo guide manifest.
- `document/`: tài liệu nghiệp vụ/kỹ thuật chi tiết bằng tiếng Việt.
- `external/license-key/`: SDK và tài liệu tích hợp license bên ngoài.

## Architecture

```text
Python local machines
  -> HTTP / Socket.IO over factory LAN
  -> NestJS API
  -> Prisma
  -> PostgreSQL

Electron renderer
  -> Next.js UI on 127.0.0.1:3969
  -> NestJS API on configured API host/port (default 3979)
  -> PostgreSQL
```

- Electron khởi động và giám sát hai child process API/Web trong runtime hiện tại.
- Backend chịu trách nhiệm toàn bộ nghiệp vụ scan, duplicate, runtime session, sync và audit; frontend không quyết định kết quả duplicate.
- Socket.IO namespace `/machine-runtime` nhận trạng thái phiên chạy; server phát sự kiện runtime/scan cho dashboard.
- API hiện dùng global prefix `/api`, chưa có version path như `/v1`.
- Response contract hiện hành là `{ success, code, message, data?, meta? }`.

## Core Business Rules

- Duplicate key chính là `(profile_id, duplicate_key)`.
- Chỉ scan OK/REWORK hợp lệ mới tham gia nguồn kiểm tra duplicate; local NG chỉ được lưu để truy vết.
- `recent_duplicate_keys` có unique constraint để chặn race condition giữa nhiều máy.
- Idempotency scan dựa trên unique `(machine_id, local_scan_id)`.
- REWORK dùng ID `RW-<local_scan_id_NG_gốc>`, tạo record REWORK mới và chuyển record NG gốc sang `NG_REWORK` trong cùng transaction.
- `NG_REWORK` vẫn thuộc nhóm NG; REWORK được thống kê riêng.
- Máy local phải được đăng ký, active và khớp `machine_code + serial + uid` trước khi gửi dữ liệu vận hành.

## Database

- PostgreSQL là source of truth; Prisma schema hiện có 24 model và 11 migration.
- Nhóm dữ liệu chính: users/roles, machines/registration/runtime, profiles/master data, scans/LED, recent/historical duplicate, sync, notifications/errors và audit.
- Scan quan trọng dùng FK `Restrict`; một số master/operational records dùng `is_active` thay cho hard delete.
- Migration production chạy bằng `prisma migrate deploy` trong installer/update flow.
- Chưa có contract app-version-to-schema-range riêng ngoài lịch sử Prisma migration.
- Chi tiết schema: `prisma/schema.prisma` và `document/04-thiet-ke-database-server.md`.

## Authentication and Authorization

- UI server dùng bearer token HMAC-SHA256 tự triển khai; TTL hiện là 12 giờ hoặc 30 ngày khi bật remembered login.
- Password dùng PBKDF2-SHA256, random salt, 120.000 vòng.
- Role cố định: `OPERATOR`, `ENGINEER`, `ADMIN`, `DEV`.
- Quyền màn hình được cấu hình động bằng `role_permissions`; DEV luôn có toàn quyền.
- Backend mutation vẫn chủ yếu dùng `@Roles(...)`; quyền màn hình không phải permission `resource.action` và không thay thế authorization API.
- Token không có session record/revocation riêng; logout hiện chỉ xóa token phía renderer.
- API/WebSocket của máy local hiện xác thực định danh bằng machine code, serial và UID, chưa có machine secret/token độc lập.
- First-admin setup, health và các endpoint tích hợp máy local được public có chủ đích trong kiến trúc hiện tại.

## UI

- Desktop dashboard có 17 route App Router cho dashboard, machines, runtime, scans, reports, master data, duplicate, users, audit, notifications, settings và guides.
- UI dùng TailwindCSS, semantic CSS variables, component shadcn-style, Sonner và Recharts qua chart wrapper.
- Có Light/Dark và tiếng Việt/English; lựa chọn được lưu trong localStorage. Giá trị khởi tạo hiện tại là Light + tiếng Việt.
- Dữ liệu chính có loading/error/empty handling; thao tác destructive và app actions dùng custom dialog.
- Giao diện tối ưu desktop, cửa sổ tối thiểu 1180x720; Electron hỗ trợ windowed/fullscreen/borderless.
- Timezone nghiệp vụ và hiển thị là `Asia/Ho_Chi_Minh` (GMT+7).

## Desktop

- Security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload qua `contextBridge`.
- Main window chỉ điều hướng nội bộ tới frontend URL; URL ngoài được chuyển qua `shell.openExternal`.
- Electron kiểm tra quyền Administrator, chiếm lại port dự án, khởi động API/Web, chờ readiness và chạy watchdog.
- API readiness hiện dựa vào `/api/health`; Prisma connect trong startup backend nên lỗi kết nối DB sẽ ngăn API ready.
- Chưa có preflight riêng cho schema compatibility, updater compatibility hoặc màn retry từng prerequisite.
- Renderer có IPC cho quit/restart, display settings, export PDF, update và license.

## Installer

- electron-builder tạo NSIS per-machine installer, yêu cầu Administrator và cho chọn thư mục cài.
- PowerShell setup kiểm tra/có thể cài Node.js, npm, PostgreSQL và pgAdmin qua winget.
- Installer cho reuse database hiện có hoặc chọn tên database khác, ghi runtime `.env`, deploy migration và seed dữ liệu nền.
- Nếu cài mới thất bại, database do lần cài đó tạo có thể được rollback; database có sẵn không bị xóa trong rollback setup.
- Uninstaller mặc định `KeepBoth` (remove app only); các chế độ xóa DB/framework yêu cầu người dùng chọn rõ.

## Updater

- Update hiện được triển khai trong Electron main process, dùng GitHub Releases của repository dự án.
- UI tách check/download-install confirmation; updater tải full NSIS installer, backup runtime env rồi chạy installer với `/UPDATE`.
- Trạng thái pending được dùng để thông báo khi phiên bản mới chạy thành công.
- Kiến trúc hiện tại chưa phải independent updater service và chưa có package checksum/signature, known-good rollback, manifest compatibility hoặc valid multi-step upgrade path.
- Release mapping hiện bỏ qua draft nhưng vẫn đưa prerelease vào danh sách.

## Licensing

- Electron tích hợp SDK license máy chủ từ `external/license-key` và khóa theo machine ID.
- `LicenseGate` chặn UI khi license chưa active/invalid và kiểm tra lại định kỳ.
- License metadata được log phục vụ chẩn đoán; raw license material không nên được ghi log.

## Logging and Audit

- Backend dùng NestJS Logger; Electron gom stdout/stderr API/Web và ghi startup/runtime log.
- Database có `audit_logs`, `sync_request_logs`, connection/runtime events và notification events.
- Audit hiện thường được ghi sau business mutation, không phải luôn cùng DB transaction.
- Chưa có correlation ID xuyên frontend/backend/service, log rotation/retention 6 tháng hoặc DEV log viewer hoàn chỉnh.

## Build, Release and Deployment

- Lệnh chuẩn được định nghĩa ở root; xem bằng `npm run help`.
- `npm run check` hiện chỉ validate Prisma và build toàn bộ; repository chưa có script lint/test chung.
- GitHub Actions trên Windows build installer và publish GitHub Release khi push tag `v*` hoặc workflow dispatch.
- Runtime đóng gói gồm NestJS build, Next.js standalone, Prisma schema/client, setup scripts và update source metadata.
- Internet chỉ cần cho cài dependency/release/update; traffic máy local vận hành qua LAN.

## Conventions

- TypeScript strict cho mọi workspace.
- Backend validation là authoritative; DTO dùng class-validator và global whitelist/forbidNonWhitelisted.
- Không dùng browser `alert`, `confirm`, `prompt`; dùng dialog/toast của app.
- Không dùng gradient nếu không có yêu cầu rõ.
- Dữ liệu ngày/giờ hiển thị theo GMT+7, định dạng ưu tiên `DD/MM/YYYY HH:mm:ss`.
- Không tự động commit/push. Không sửa trực tiếp trên `main`/`master`.
- `.env`, build output và runtime/release artifacts bị gitignore; không ghi secret vào log/tài liệu.

## Current Constraints and Known Gaps

- API local bind mặc định `0.0.0.0`; machine endpoints và Socket.IO cần được bảo vệ bởi network boundary hiện tại.
- CORS backend rộng và WebSocket dùng `origin: "*"`.
- Chưa có rate limiting cho login/setup/machine endpoints.
- Health endpoint không trả schema/app compatibility metadata.
- Electron port reclaim hiện có thể terminate mọi process đang listen trên hai port cấu hình.
- Update chưa có integrity verification và automatic rollback.
- Tài liệu/version release có thể trễ hơn package manifests; package manifests và Git tag là nguồn version build.
- Một số service/component lớn cần được chia nhỏ khi có task liên quan, nhưng không refactor ngoài scope.

## Documentation Map

- `document/00-muc-luc.md`: mục lục tài liệu.
- `document/01-tong-quan-du-an.md`: mục tiêu và phạm vi.
- `document/02-kien-truc-va-cau-truc-thu-muc.md`: kiến trúc tổng thể.
- `document/03-luong-nghiep-vu-duplicate.md`: duplicate và REWORK.
- `document/04-thiet-ke-database-server.md`: database.
- `document/05-api-may-local-python.md` và `document/10-huong-dan-api-may-local-python.md`: contract local machine.
- `document/06-man-hinh-ui-va-i18n-theme.md`: UI/i18n/theme.
- `document/07-setup-cai-dat-van-hanh.md`: setup/operations.
- `document/09-quy-uoc-ui-ux-va-lenh-root.md`: UI rules và root commands.
- `document/12-he-thong-huong-dan-va-xuat-pdf.md`: guide/PDF system.
- `document/13-huong-dan-rework-cho-may-local.md`: REWORK integration.
