# Project Agent Instructions

## Language

- Trả lời ngắn gọn bằng tiếng Việt trừ khi user yêu cầu ngôn ngữ khác.

## UI/UX

- Khi làm UI/UX, luôn dùng taste skill có chọn lọc.
- Đây là desktop factory dashboard, không phải landing page. Ưu tiên tính rõ ràng, thao tác nhanh, trạng thái đầy đủ và khả năng truy vết.
- UI phải bám TailwindCSS, shadcn/ui style components, Sonner cho notification, Recharts qua shadcn chart cho biểu đồ.
- Không dùng browser `alert`, `confirm`, `prompt` hoặc notification mặc định.
- Không dùng gradient trừ khi user yêu cầu rõ.
- Luôn có loading, error, empty state cho màn dữ liệu.

## Architecture

- Root project dùng npm workspaces.
- `frontend/` là Next.js UI.
- `backend/` là NestJS API và Swagger.
- `electron/` là desktop shell.
- `prisma/` là Prisma schema/migration.
- `shared/` là constants/types dùng chung.

## Commands

- Ưu tiên dùng lệnh root trong `package.json`.
- Xem toàn bộ lệnh bằng `npm run help`.
