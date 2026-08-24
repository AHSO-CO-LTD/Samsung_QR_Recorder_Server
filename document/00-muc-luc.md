# Mục lục tài liệu dự án

Dự án này là ứng dụng desktop server dùng để quản lý và kiểm tra mã độc nhất của TV trong dây chuyền sản xuất. Ứng dụng server chạy bằng Electron, giao diện bằng Next.js, backend bằng NestJS, database bằng PostgreSQL và Prisma. Máy local là chương trình Python riêng, chỉ gọi API của backend server qua mạng LAN.

## Danh sách tài liệu

1. `01-tong-quan-du-an.md`
   - Mục tiêu dự án.
   - Vai trò của máy server và máy local.
   - Phạm vi hiện tại chỉ xây dựng máy server.

2. `02-kien-truc-va-cau-truc-thu-muc.md`
   - Kiến trúc Electron + Next.js + NestJS + PostgreSQL.
   - Lý do tách frontend/backend.
   - Cấu trúc thư mục ở root dự án.

3. `03-luong-nghiep-vu-duplicate.md`
   - Luồng local OK, server OK.
   - Luồng local OK, server duplicate.
   - Luồng local NG.
   - Nguyên tắc chỉ so sánh OK với OK.

4. `04-thiet-ke-database-server.md`
   - Nhóm bảng server chính.
   - Vai trò các bảng quan trọng.
   - Cách dùng `scan_records` cho cả OK và NG.
   - Cách dùng `recent_duplicate_keys`.

5. `05-api-may-local-python.md`
   - API contract cho máy local Python.
   - Endpoint heartbeat.
   - Endpoint submit scan.
   - Payload mẫu.
   - Response mẫu.

6. `06-man-hinh-ui-va-i18n-theme.md`
   - Danh sách màn hình trong app server.
   - Vai trò từng màn hình.
   - Quy ước song ngữ Việt/Anh.
   - Quy ước theme sáng/tối.

7. `07-setup-cai-dat-van-hanh.md`
   - Cách cài đặt khi phát triển.
   - Cách cấu hình database.
   - Cách chạy API, UI, Electron.
   - Định hướng đóng gói installer.

8. `08-checklist-phat-trien.md`
   - Checklist kỹ thuật.
   - Checklist nghiệp vụ.
   - Checklist UI/UX.
   - Checklist trước khi giao bản chạy thử.

9. `09-quy-uoc-ui-ux-va-lenh-root.md`
   - Quy ước bắt buộc về taste skill, TailwindCSS, shadcn/ui, Sonner, shadcn chart và Recharts.
   - Bộ lệnh root để setup, chạy dev, build, reset, thao tác database và cài thư viện.

10. `10-huong-dan-api-may-local-python.md`
   - Hướng dẫn tích hợp API dành cho đội viết máy local Python.
   - Giải thích endpoint local cần gọi, request body, response body, command polling, notification, error code và sync offline.
   - Có flow áp dụng trong app Python, checklist tích hợp và kịch bản test bắt buộc.

11. `11-sql-khoi-tao-db-may-local-python-postgres.md`
   - Script SQL PostgreSQL để tạo toàn bộ database local cho app Python một lần.
   - Gồm bảng cấu hình, profile cache, scan local, LED item, duplicate local, sync batch, command, notification và log.
   - Có query kiểm tra sau khi chạy và gợi ý tạo `local_scan_id`, `batch_code`.

12. `12-he-thong-huong-dan-va-xuat-pdf.md`
   - Kiến trúc catalog hướng dẫn trong app.
   - Quy ước folder, metadata và ảnh cho từng bước.
   - Luồng hiển thị nội dung trước ảnh.
   - Cách xuất PDF trong Electron và browser.
   - Checklist thêm guide và kiểm tra trước release.

13. `13-huong-dan-rework-cho-may-local.md`
   - Contract REWORK qua `POST /api/scans/submit`.
   - Quy tắc ID `RW-<local_scan_id_NG_gốc>`.
   - Payload, response, retry/offline sync và checklist cho máy local.
