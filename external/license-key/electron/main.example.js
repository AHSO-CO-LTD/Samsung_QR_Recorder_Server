// main.example.js — Ví dụ khung main process tích hợp license vào vòng đời app.
// Copy các đoạn đánh dấu vào main.js thật của bạn.

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const lm = require("./licenseManager");

let mainWin = null;
let activationWin = null;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1100, height: 720,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
  });
  mainWin.loadFile("index.html"); // app thật của bạn
}

function createActivationWindow() {
  activationWin = new BrowserWindow({
    width: 560, height: 520, resizable: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
  });
  activationWin.loadFile(path.join(__dirname, "activation.html"));
}

// ===== IPC cho màn hình kích hoạt =====
ipcMain.handle("license:getMachineId", () => lm.getMachineId());
ipcMain.handle("license:activate", (_e, licStr) => lm.activate(licStr));
ipcMain.on("license:activated", () => {
  if (activationWin) { activationWin.close(); activationWin = null; }
  createMainWindow();
});

// ===== Kiểm tra license lúc khởi động =====
app.whenReady().then(async () => {
  const s = await lm.evaluate();
  if (s.state === "active") {
    createMainWindow(); // đã kích hoạt -> vào thẳng app
  } else {
    createActivationWindow(); // chưa kích hoạt / license lỗi -> màn kích hoạt
  }
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ===== Ví dụ cổng tính năng ở nghiệp vụ (rải nhiều nơi, không dồn 1 chỗ) =====
ipcMain.handle("do-export-pdf", async () => {
  if (!(await lm.hasFeature("export_pdf")))
    return { ok: false, why: "Tính năng này cần license phù hợp." };
  // ... chạy xuất PDF ...
  return { ok: true };
});
