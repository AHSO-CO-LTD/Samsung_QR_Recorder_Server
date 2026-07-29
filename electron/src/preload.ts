import { contextBridge, ipcRenderer } from "electron";

const restoreSessionArg = process.argv.find((arg) => arg.startsWith("--restore-session-token="));
const restoreSessionToken = restoreSessionArg ? restoreSessionArg.slice("--restore-session-token=".length) : "";

if (restoreSessionToken) {
  try {
    window.sessionStorage.setItem("server-session-token", decodeURIComponent(restoreSessionToken));
  } catch {
    // Session restore is best effort; auth flow will fail closed if it cannot be restored.
  }
}

contextBridge.exposeInMainWorld("serverApp", {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  quit: () => ipcRenderer.invoke("app:quit"),
  restart: () => ipcRenderer.invoke("app:restart"),
  onCloseRequest: (handler: () => void) => {
    const listener = () => handler();
    ipcRenderer.on("app:close-requested", listener);
    return () => ipcRenderer.removeListener("app:close-requested", listener);
  },
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  getDisplaySettings: () => ipcRenderer.invoke("window:get-display-settings"),
  saveDisplaySettings: (settings: unknown) => ipcRenderer.invoke("window:save-display-settings", settings),
  getDisplaySettingsState: () => ipcRenderer.invoke("window:get-display-settings-state"),
  previewDisplaySettings: (settings: unknown) => ipcRenderer.invoke("window:preview-display-settings", settings),
  confirmDisplaySettings: () => ipcRenderer.invoke("window:confirm-display-settings"),
  rollbackDisplaySettings: () => ipcRenderer.invoke("window:rollback-display-settings"),
  guides: {
    exportPdf: (options: { defaultFileName: string }) => ipcRenderer.invoke("guides:export-pdf", options)
  },
  updates: {
    check: () => ipcRenderer.invoke("updates:check"),
    install: (tagName: string) => ipcRenderer.invoke("updates:install", tagName)
  },
  license: {
    getStatus: () => ipcRenderer.invoke("license:get-status"),
    getRequestInfo: () => ipcRenderer.invoke("license:get-request-info"),
    activate: (licenseString: string) => ipcRenderer.invoke("license:activate", licenseString),
    clear: () => ipcRenderer.invoke("license:clear")
  }
});
