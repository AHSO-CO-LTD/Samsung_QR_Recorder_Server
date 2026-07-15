// verifyLicense.js — Verify license Ed25519 cho app Electron (offline).
// Cần: npm i tweetnacl
// Nhúng PUBLIC_KEY (lấy từ public key do vận hành cấp). KHÔNG bao giờ nhúng private key.

const nacl = require("tweetnacl");

// <<< Dán mảng public key của bạn vào đây — lấy từ public key do vận hành cấp >>>
// Hex tương ứng (PHẢI khớp PUBLIC_KEY_HEX trong python/license_client.py — khi xoay
// key, cập nhật CẢ HAI file và đối chiếu hex này bằng mắt hoặc bằng self-check dưới).
const PUBLIC_KEY = Uint8Array.from([203, 208, 105, 253, 225, 57, 73, 77, 157, 214, 91, 145, 93, 183, 8, 64, 34, 18, 10, 180, 207, 244, 21, 26, 178, 19, 114, 22, 86, 181, 209, 211]);
const PUBLIC_KEY_HEX = "cbd069fde139494d9dd65b915db7084022120ab4cff4151ab213721656b5d1d3";

function major(version) {
  const n = parseInt(String(version).split(".")[0], 10);
  return Number.isNaN(n) ? 0 : n;
}

function b64urlToBuf(s) {
  // base64url strict: chỉ nhận A-Z a-z 0-9 - _ (và '=' đệm nếu có).
  // Buffer.from(..., "base64url") tự bỏ qua ký tự lạ thay vì báo lỗi, nên phải
  // tự kiểm tra bảng chữ cái trước khi decode để tránh chuỗi hỏng lọt qua.
  const str = String(s).trim();
  if (!/^[A-Za-z0-9_-]+=*$/.test(str)) {
    throw new Error("invalid base64url characters");
  }
  return Buffer.from(str, "base64url");
}

// Parse 'YYYY-MM-DD' thành số nguyên có thể so sánh trực tiếp (yyyy*10000+mm*100+dd)
// — khớp ngữ nghĩa date.fromisoformat(...) của Python (so theo ngày lịch, không
// giờ/múi giờ). Trả về null nếu sai định dạng/không hợp lệ.
// KHÔNG dùng `new Date(y, mo-1, d)` để validate: JS Date map năm 0-99 thành
// 1900-1999 (quirk lịch sử), khiến năm hợp lệ dạng "00YY-MM-DD" bị từ chối sai.
function parseDateOnly(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d < 1 || d > daysInMonth[mo - 1]) return null;
  return y * 10000 + mo * 100 + d;
}

function todayDateOnly() {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

/**
 * @returns {{ok:boolean, why:string|null, lic:object|null}}
 * @param appReleaseDate 'YYYY-MM-DD' ngày phát hành bản build (check cửa sổ update)
 * @param appProduct mã sản phẩm hiện tại — đối chiếu với lic.product nếu license có gắn product
 */
function verifyLicense(licStr, machineId, appVersion = "1.0", appReleaseDate = null, appProduct = null) {
  if (!PUBLIC_KEY || PUBLIC_KEY.length !== 32 || Buffer.from(PUBLIC_KEY).toString("hex") !== PUBLIC_KEY_HEX) {
    return { ok: false, why: "public_key_chua_cau_hinh", lic: null };
  }

  let buf;
  try {
    buf = b64urlToBuf(licStr);
  } catch {
    return { ok: false, why: "license_hong_dinh_dang", lic: null };
  }
  if (buf.length < 65) return { ok: false, why: "license_qua_ngan", lic: null };

  const raw = buf.subarray(0, buf.length - 64); // payload nguyên văn
  const sig = buf.subarray(buf.length - 64); // chữ ký 64 byte cuối

  // 1) Chữ ký — verify trên khối byte gốc, KHÔNG dựng lại JSON
  const ok = nacl.sign.detached.verify(
    new Uint8Array(raw),
    new Uint8Array(sig),
    PUBLIC_KEY
  );
  if (!ok) return { ok: false, why: "chu_ky_sai", lic: null };

  // 2) Parse payload
  let lic;
  try {
    lic = JSON.parse(raw.toString("utf-8"));
  } catch {
    return { ok: false, why: "payload_hong", lic: null };
  }

  // 3) Đúng máy
  if (lic.machine_id !== machineId) return { ok: false, why: "sai_may", lic };

  // 3b) Đúng sản phẩm — fail-closed: nếu app có cấu hình appProduct thì license
  // PHẢI có product trùng khớp; thiếu field product không được coi là "bỏ qua check".
  if (appProduct && lic.product !== appProduct) {
    return { ok: false, why: "sai_san_pham", lic };
  }

  // 4) Hết hạn (trial) — so theo NGÀY (không giờ/múi giờ), khớp ngữ nghĩa bản Python
  if (lic.expires_at) {
    const exp = parseDateOnly(lic.expires_at);
    if (!exp) return { ok: false, why: "license_hong_dinh_dang", lic };
    if (exp < todayDateOnly()) {
      return { ok: false, why: "het_han", lic };
    }
  }

  // 5) Quyền version — so theo NGÀY PHÁT HÀNH build, không theo hôm nay
  if (lic.max_major != null && major(appVersion) > lic.max_major) {
    return { ok: false, why: "can_nang_cap_license", lic };
  }
  if (lic.update_until && appReleaseDate) {
    const upd = parseDateOnly(lic.update_until);
    const rel = parseDateOnly(appReleaseDate);
    if (!upd || !rel) return { ok: false, why: "license_hong_dinh_dang", lic };
    if (rel > upd) {
      return { ok: false, why: "can_gia_han_de_dung_ban_moi", lic };
    }
  }

  return { ok: true, why: null, lic };
}

module.exports = { verifyLicense };
