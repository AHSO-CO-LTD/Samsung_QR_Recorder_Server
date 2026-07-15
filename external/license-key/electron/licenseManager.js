// licenseManager.js — Lớp quản lý license cho app Electron (chạy trong MAIN process).
// Gói gọn: đọc/lưu license, kiểm tra lúc khởi động, kích hoạt, cổng tính năng.
//
// Phụ thuộc: ./machineId.js, ./verifyLicense.js  (npm i tweetnacl systeminformation)

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { getMachineId } = require("./machineId");
const { verifyLicense } = require("./verifyLicense");

// ==== CẤU HÌNH APP — dev chỉnh theo sản phẩm/bản build ====
const APP = {
  version: "2.0", // phiên bản app hiện tại (major dùng để so max_major)
  releaseDate: "2026-08-01", // NGÀY PHÁT HÀNH bản build này (KHÔNG phải ngày hôm nay)
  product: "myapp-pro", // mã sản phẩm mong đợi (tùy chọn kiểm tra thêm)
};

// Nơi lưu license: %APPDATA%/<AppName>/license.dat (Windows), tương đương trên OS khác
function licensePath() {
  return path.join(app.getPath("userData"), "license.dat");
}

function saveLicense(licStr) {
  fs.writeFileSync(licensePath(), licStr, "utf8");
}

function loadLicense() {
  try {
    return fs.readFileSync(licensePath(), "utf8").trim();
  } catch {
    return null;
  }
}

function clearLicense() {
  try {
    fs.unlinkSync(licensePath());
  } catch {}
}

// Kết quả kiểm tra dùng chung
async function evaluate() {
  const machineId = await getMachineId();
  const licStr = loadLicense();
  if (!licStr) {
    return { state: "unactivated", machineId, lic: null, why: "chua_kich_hoat" };
  }
  const r = verifyLicense(licStr, machineId, APP.version, APP.releaseDate, APP.product);
  if (r.ok) {
    return { state: "active", machineId, lic: r.lic, why: null };
  }
  return { state: "invalid", machineId, lic: r.lic, why: r.why };
}

// Gọi khi khách bấm "Kích hoạt": nhận chuỗi license, verify, nếu OK thì lưu.
async function activate(licStr) {
  const machineId = await getMachineId();
  const r = verifyLicense(licStr, machineId, APP.version, APP.releaseDate, APP.product);
  if (r.ok) {
    saveLicense(licStr.trim());
    return { ok: true, lic: r.lic };
  }
  return { ok: false, why: r.why };
}

// Cổng tính năng: kiểm tra 1 feature flag trong license (rải nhiều nơi trong app).
// Fail-closed: license active nhưng thiếu/hỏng field "features" thì KHÔNG cấp
// quyền (trước đây mặc định cấp full quyền, để lộ mọi feature nếu issuer quên field).
async function hasFeature(featureName) {
  const s = await evaluate();
  if (s.state !== "active") return false;
  return Array.isArray(s.lic.features) && s.lic.features.includes(featureName);
}

module.exports = {
  APP,
  getMachineId,
  evaluate,
  activate,
  loadLicense,
  saveLicense,
  clearLicense,
  hasFeature,
};
