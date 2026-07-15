# License-Key — Client SDK (verify)

Module **client** để tích hợp cơ chế kích hoạt license vào app: sinh **Machine ID** và
**verify** license bằng chữ ký số **Ed25519**. Dùng cho app **Electron/JS** và **Python**,
hoạt động **offline**.

> Repo này **chỉ** chứa phần dành cho dev (verify + public key). Phần **ký license**
> (private key, tool phát hành) do bộ phận vận hành giữ riêng, **không** nằm ở đây.
> Đây là thiết kế có chủ đích: có toàn bộ code này cũng **không thể tạo license giả** —
> muốn ký cần private key mà repo không bao giờ chứa.

📖 **Tích hợp vào dự án:** đọc [INTEGRATION.md](INTEGRATION.md) — hướng dẫn từng bước cho
Electron và Python, kèm màn hình kích hoạt mẫu, cổng tính năng, và checklist phát hành.

## Cấu trúc

```
INTEGRATION.md          # hướng dẫn tích hợp chi tiết ← đọc file này
python/
  license_client.py     # get_machine_id() + verify_license()  (lõi)
  license_manager.py    # lưu/đọc/kích hoạt/cổng tính năng     (wrapper)
electron/
  machineId.js          # getMachineId()
  verifyLicense.js      # verifyLicense()
  licenseManager.js     # wrapper vòng đời license
  activation.html       # màn hình kích hoạt mẫu
  preload.example.js    # cầu nối renderer ⇄ main
  main.example.js       # khung main process mẫu
```

## Cài đặt

```bash
# App Python
pip install pynacl

# App Electron
npm i tweetnacl systeminformation
```

## Machine ID

Định danh máy = **SMBIOS System UUID** (mainboard), fallback **MachineGuid** khi UUID rác.
Ổn định qua thay ổ cứng và cài lại Windows; chỉ đổi khi thay mainboard.

```python
from license_client import get_machine_id
print(get_machine_id())        # 'A1B2-C3D4-E5F6-7890'
```
```js
const { getMachineId } = require("./machineId");
getMachineId().then(console.log);
```

> Machine ID hoạt động trên cả Windows/macOS/Linux (mỗi OS đọc UUID phần cứng theo cách riêng),
> nhưng Python và Electron dò UUID bằng code độc lập nhau — khi thêm/sửa nguồn fallback ở một
> bên (`machineId.js`/`license_client.py`), nhớ đối chiếu và cập nhật bên còn lại.

## Verify license

Python:
```python
from license_client import get_machine_id, verify_license

r = verify_license(lic_str, get_machine_id(),
                   app_version="2.0",
                   app_release_date="2026-08-01",  # ngày phát hành build, KHÔNG phải hôm nay
                   app_product="myapp-pro")        # PHẢI truyền — thiếu thì bỏ qua check product
if r["ok"]:
    activate(r["lic"])          # lic chứa product, edition, max_major...
else:
    show_error(r["why"])
```

Electron:
```js
const { getMachineId } = require("./machineId");
const { verifyLicense } = require("./verifyLicense");

// appProduct PHẢI truyền — thiếu thì bỏ qua check product
const r = verifyLicense(licStr, await getMachineId(), "2.0", "2026-08-01", "myapp-pro");
if (r.ok) activate(r.lic);
else showError(r.why);
```

App verify OK thì lưu `licStr` vào `%APPDATA%` (hoặc nơi cấu hình), lần chạy sau đọc lại —
không cần mạng.

## Mã lỗi (`why`)

| Mã | Ý nghĩa |
|---|---|
| `chu_ky_sai` | License giả hoặc bị chỉnh sửa |
| `sai_may` | License thuộc máy khác |
| `sai_san_pham` | License không dùng cho sản phẩm này |
| `het_han` | Trial hết hạn |
| `can_nang_cap_license` | App major vượt quyền license (`max_major`) |
| `can_gia_han_de_dung_ban_moi` | Bản build ra sau `update_until` |
| `license_qua_ngan` | Chuỗi license quá ngắn (bị cắt khi dán/copy) |
| `license_hong_dinh_dang` | Chuỗi license sai định dạng base64url/ngày tháng |
| `payload_hong` | Payload JSON trong license bị hỏng |
| `public_key_chua_cau_hinh` | Chưa nhúng public key, hoặc 2 dạng key trong file không khớp nhau |

## Public key

Public key được nhúng sẵn trong `license_client.py` (`PUBLIC_KEY_HEX`) và
`verifyLicense.js` (`PUBLIC_KEY`). Public key **an toàn để công khai** — nó chỉ dùng để
verify, không ký được gì. Khi vận hành đổi cặp khóa, cập nhật lại hai giá trị này.

## Nguyên tắc bảo mật cho dev

- **Không** commit private key, tool ký, hay license thật vào repo (đã chặn trong `.gitignore`).
- Đừng dồn toàn bộ kiểm tra vào một hàm `isActivated()` — rải nhiều điểm verify, gắn tính năng
  vào dữ liệu trong `lic` để việc gỡ check làm app mất chức năng thay vì mở khóa.
- Bảo mật nằm ở **chữ ký**, không ở việc giấu code — code verify công khai là bình thường.

---
© AHSO CO., LTD. All rights reserved.
