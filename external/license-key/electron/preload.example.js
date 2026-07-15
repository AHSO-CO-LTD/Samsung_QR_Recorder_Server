// preload.example.js — Cầu nối an toàn giữa renderer (activation.html) và main process.
// Nạp qua BrowserWindow({ webPreferences: { preload: path.join(__dirname, "preload.js"),
//                                            contextIsolation: true, nodeIntegration: false }}).

const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("licenseAPI", {
  getMachineId: () => ipcRenderer.invoke("license:getMachineId"),
  activate: (licStr) => ipcRenderer.invoke("license:activate", licStr),
  copyToClipboard: (text) => clipboard.writeText(text),
  onActivated: () => ipcRenderer.send("license:activated"),
});
