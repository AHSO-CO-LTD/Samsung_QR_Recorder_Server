# Hướng dẫn tích hợp License vào dự án

Tài liệu cho **dev** tích hợp cơ chế kích hoạt vào app Electron hoặc Python. Toàn bộ hoạt
động **offline**: license là chuỗi ký số Ed25519, app chỉ cần **public key** (đã nhúng sẵn)
để verify — không gọi mạng, không chứa private key.

---

## 1. Bức tranh tổng thể

```
┌─ Lần đầu chạy (chưa có license) ────────────────────────────┐
│ App sinh Machine ID  →  hiện cho khách  →  khách gửi cho     │
│ nhà cung cấp  →  nhận lại chuỗi license  →  dán vào app      │
│ →  app verify  →  lưu license.dat  →  vào app                │
└─────────────────────────────────────────────────────────────┘
┌─ Các lần sau ───────────────────────────────────────────────┐
│ App đọc license.dat  →  verify (offline)  →  vào thẳng app   │
└─────────────────────────────────────────────────────────────┘
```

Ba khái niệm:

| Khái niệm | Là gì | Ai tạo |
|---|---|---|
| **Machine ID** | Vân tay máy (mainboard UUID), dạng `A1B2-C3D4-E5F6-7890` | App tự sinh |
| **License string** | Chuỗi base64 = payload JSON + chữ ký Ed25519 | Nhà cung cấp ký |
| **license.dat** | File lưu license string trên máy khách | App lưu sau khi verify OK |

---

## 2. File trong SDK

| File | Vai trò | Dùng khi |
|---|---|---|
| `machineId.js` / trong `license_client.py` | Sinh Machine ID | Luôn cần |
| `verifyLicense.js` / `license_client.py` | Verify chữ ký + máy + version | Luôn cần |
| `licenseManager.js` / `license_manager.py` | Bọc: lưu/đọc/kích hoạt/cổng tính năng | Nên dùng |
| `activation.html`, `preload.example.js`, `main.example.js` | Màn kích hoạt + khung Electron | Tham khảo |

Chỉ hai file đầu là bắt buộc; phần còn lại là tiện ích + ví dụ, sửa theo dự án.

---

## 3. Cấu hình bắt buộc trước khi build

Trong `licenseManager.js` (Electron) hoặc đầu `license_manager.py` (Python), đặt đúng:

```js
const APP = {
  version: "2.0",            // phiên bản app — major dùng so với max_major của license
  releaseDate: "2026-08-01", // NGÀY PHÁT HÀNH bản build này
  product: "myapp-pro",
};
```

> ⚠️ **`releaseDate` là hằng số của bản build, KHÔNG phải ngày hôm nay.** Nó quyết định
> license "cửa sổ update" còn hiệu lực không: khách chạy được mọi bản phát hành trước
> `update_until`, và chạy **mãi mãi**. Nếu lấy nhầm ngày hệ thống, app sẽ tự khóa sai —
> hãy nhúng ngày này lúc CI build (ví dụ ghi vào file hoặc biến môi trường).

---

## 4. Tích hợp Electron

### 4.1 Cài đặt
```bash
npm i tweetnacl systeminformation
# copy thư mục electron/ của SDK vào dự án (hoặc để dạng package nội bộ)
```

### 4.2 Ba mảnh ghép

**a) Kiểm tra lúc khởi động** — trong `main.js`:
```js
const lm = require("./license/licenseManager");

app.whenReady().then(async () => {
  const s = await lm.evaluate();               // { state, machineId, lic, why }
  if (s.state === "active") createMainWindow(); // vào thẳng app
  else createActivationWindow();               // mở màn kích hoạt
});
```

**b) IPC cho màn kích hoạt** — trong `main.js`:
```js
ipcMain.handle("license:getMachineId", () => lm.getMachineId());
ipcMain.handle("license:activate", (_e, licStr) => lm.activate(licStr));
ipcMain.on("license:activated", () => { /* đóng màn kích hoạt, mở app */ });
```

**c) Cầu nối renderer** — trong `preload.js` (xem `preload.example.js`):
```js
contextBridge.exposeInMainWorld("licenseAPI", {
  getMachineId: () => ipcRenderer.invoke("license:getMachineId"),
  activate: (s) => ipcRenderer.invoke("license:activate", s),
  copyToClipboard: (t) => require("electron").clipboard.writeText(t),
  onActivated: () => ipcRenderer.send("license:activated"),
});
```

Màn kích hoạt sẵn dùng: `activation.html` (đã có nút Copy Machine ID + ô dán + thông báo lỗi
tiếng Việt). `main.example.js` là khung main hoàn chỉnh để đối chiếu.

> **Bảo mật Electron:** luôn bật `contextIsolation: true`, `nodeIntegration: false`, và đọc
> phần cứng ở **main process** (không phải renderer).

### 4.3 Cổng tính năng (feature gating)
Đừng dồn mọi thứ vào một biến `isActivated`. Kiểm tra rải rác, dựa vào dữ liệu license:
```js
ipcMain.handle("do-export-pdf", async () => {
  if (!(await lm.hasFeature("export_pdf")))
    return { ok: false, why: "Tính năng cần license phù hợp." };
  return runExportPdf();
});
```

---

## 5. Tích hợp Python

### 5.1 Cài đặt
```bash
pip install pynacl
# copy python/license_client.py + license_manager.py vào dự án
```

### 5.2 Kiểm tra lúc khởi động
```python
from license_manager import evaluate, activate, require_license_or_exit

# Cách nhanh (CLI/app đơn giản): chưa kích hoạt thì in mã máy rồi thoát
lic = require_license_or_exit()
print("Đã kích hoạt cho:", lic["customer_id"])

# Cách chi tiết (app có GUI): tự xử theo state
s = evaluate()
if s["state"] == "active":
    start_app(s["lic"])
elif s["state"] == "unactivated":
    show_activation_screen(s["machine_id"])   # hiện mã máy + ô dán license
else:  # invalid
    show_error(s["why"])
```

### 5.3 Kích hoạt
```python
r = activate(lic_str_khach_dan)
if r["ok"]:
    restart_into_app()
else:
    show_error(r["why"])
```

### 5.4 Cổng tính năng
```python
from license_manager import has_feature
if has_feature("multi_user"):
    enable_multi_user()
```

---

## 6. Các trạng thái & xử lý UX

| state | Nghĩa | Nên làm |
|---|---|---|
| `active` | License hợp lệ, đúng máy, đúng version | Vào app |
| `unactivated` | Chưa có license.dat | Mở màn kích hoạt (hiện Machine ID) |
| `invalid` | Có license nhưng verify fail | Hiện lý do `why`, cho nhập lại |

Bảng `why` (khi `invalid` hoặc activate thất bại):

| why | Thông báo gợi ý cho khách |
|---|---|
| `chu_ky_sai` | Mã kích hoạt không hợp lệ hoặc đã bị sửa |
| `sai_may` | Mã này thuộc máy khác — gửi lại đúng Mã máy hiện tại |
| `het_han` | Bản dùng thử đã hết hạn |
| `can_nang_cap_license` | License không hỗ trợ phiên bản này |
| `can_gia_han_de_dung_ban_moi` | Cần gia hạn để dùng bản mới hơn |
| `public_key_chua_cau_hinh` | Lỗi cấu hình app — liên hệ hỗ trợ |

---

## 7. Nội dung một license (đọc từ `lic`)

```json
{
  "lic_id": "L-2026-000123", "customer_id": "KH-00542",
  "project": "DA-Sunrise", "product": "myapp-pro",
  "purchased_version": "2.0", "max_major": 2,
  "update_until": "2027-07-15", "machine_id": "A1B2-C3D4-E5F6-7890",
  "type": "perpetual", "expires_at": null,
  "features": ["export_pdf", "multi_user"], "issued_at": "2026-07-15", "v": 1
}
```

Dev có thể dựa vào `edition`/`features`/`customer_id`… để bật tính năng, hiện tên khách,
watermark output. **Không cần** tự kiểm tra chữ ký — `verify_license`/`verifyLicense` đã lo.

---

## 8. Lưu license ở đâu

| OS | Đường dẫn `license.dat` |
|---|---|
| Windows | `%APPDATA%\<AppName>\license.dat` |
| macOS | `~/Library/Application Support/<AppName>/license.dat` |
| Linux | `~/.config/<AppName>/license.dat` |

`licenseManager` tự lo việc này. License string an toàn để lưu dạng text (không phải bí mật;
nó gắn máy nên copy sang máy khác vô dụng).

---

## 9. Checklist trước khi phát hành

- [ ] Đã thay **public key demo** bằng public key sản xuất (nếu vận hành đã đổi khóa).
- [ ] `APP.version` và `APP.releaseDate` đúng cho bản build (releaseDate nhúng lúc CI).
- [ ] Điện thoại/không mạng: có đường kích hoạt thủ công (khách đọc Machine ID, NCC ký hộ).
- [ ] Cổng tính năng rải ≥3 điểm, không dồn một hàm `isActivated`.
- [ ] Build có obfuscate/compile (bytenode cho Electron, Nuitka cho Python) — lớp phụ.
- [ ] Test 5 ca: hợp lệ / sai máy / license sửa / version quá cao / build sau update_until.

---

## 10. Câu hỏi thường gặp

**App có gọi mạng không?** Không. Toàn bộ verify offline bằng public key nhúng sẵn.

**Copy `license.dat` sang máy khác được không?** Không — license gắn `machine_id`, máy khác
sẽ ra `sai_may`.

**Khách thay ổ cứng / cài lại Windows có mất license?** Không, vì Machine ID theo mainboard.
Chỉ mất khi thay mainboard → khách kích hoạt lại (NCC cấp license mới cho Machine ID mới).

**Dev có thể tự tạo license để test?** Không từ repo này (không có private key). Xin NCC cấp
vài license test cho Machine ID máy dev.

**Nhỡ lộ public key thì sao?** Không sao — public key vốn để công khai, không ký được gì.
