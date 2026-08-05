# In-app guide assets

Mỗi hướng dẫn nằm trong một folder bắt đầu bằng số thứ tự:

```text
01-dang-nhap/
  guide.json
  01.webp
  01.json
  02.webp
  02.json
```

- `guide.json`: chứa `title` và `description` của hướng dẫn.
- Ảnh hỗ trợ: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`.
- Tên ảnh phải bắt đầu bằng số thứ tự tăng dần: `01`, `02`, `03`...
- File JSON cùng tên ảnh chứa `title` và `content` của bước đó.
- Có thể viết trước `01.json`, `02.json`... rồi bổ sung ảnh cùng tên sau.
- Tên metadata phải chỉ dùng số thứ tự (`01.json`, `02.json`...), không thêm hậu tố mô tả.
- UI và PDF luôn hiển thị theo thứ tự: số bước, tiêu đề, nội dung, ảnh.
- Chạy `npm run guides:manifest` sau khi thêm hoặc thay đổi ảnh.
- Lệnh dev/build frontend sẽ tự tạo lại `manifest.json`.
- Nếu thêm guide có order mới, cập nhật group tương ứng trong `frontend/features/guides/guides-view.tsx` để guide xuất hiện cả trên catalog và PDF.
