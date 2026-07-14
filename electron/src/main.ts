import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { execFile, spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";

const APP_NAME = "Samsung QR Recorder Server";
const DEFAULT_FRONTEND_PORT = 3969;
const DEFAULT_API_PORT = 3979;
const SESSION_STORAGE_KEY = "server-session-token";
const SHOULD_START_SERVICES = process.env.ELECTRON_START_SERVICES === "1" || process.argv.includes("--start-services");
const STARTUP_LOG_PATH = readArgValue("--startup-log");

app.setName(APP_NAME);

const DISPLAY_MODES = ["windowed", "fullscreen", "borderless"] as const;
type DisplayMode = (typeof DISPLAY_MODES)[number];

const WINDOW_RESOLUTION_PRESETS = {
  "1280x720": [1280, 720],
  "1280x1080": [1280, 1080],
  "1366x768": [1366, 768],
  "1440x900": [1440, 900],
  "1600x900": [1600, 900],
  "1680x1050": [1680, 1050],
  "1920x1080": [1920, 1080]
} as const;

type WindowResolutionPreset = keyof typeof WINDOW_RESOLUTION_PRESETS;

type DesktopDisplaySettings = {
  mode: DisplayMode;
  resolution: WindowResolutionPreset;
  alwaysOnTop: boolean;
};

type MainWindowRestoreState = {
  url?: string;
  sessionToken?: string;
};

type PendingDisplaySettingsConfirmation = {
  previousSettings: DesktopDisplaySettings;
  previewSettings: DesktopDisplaySettings;
  confirmationDeadline: number;
  timer: NodeJS.Timeout;
};

const DEFAULT_DISPLAY_SETTINGS: DesktopDisplaySettings = {
  mode: "windowed",
  resolution: "1440x900",
  alwaysOnTop: false
};

type ManagedService = {
  name: "API" | "WEB";
  command: string;
  args: string[];
  readyUrl: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  process?: ChildProcessWithoutNullStreams;
};

type UpdateAsset = {
  name: string;
  size: number;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  name: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: UpdateAsset[];
};

type AppUpdateRelease = {
  version: string;
  tagName: string;
  name: string;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
  assetName: string;
  assetSize: number;
};

const serviceLogs: string[] = [];
const managedServices: ManagedService[] = [];
let mainWindow: BrowserWindow | null = null;
let startupWindow: BrowserWindow | null = null;
let terminalWindow: BrowserWindow | null = null;
let desktopDisplaySettings: DesktopDisplaySettings = DEFAULT_DISPLAY_SETTINGS;
let pendingMainWindowRestoreState: MainWindowRestoreState | null = null;
let pendingDisplaySettingsConfirmation: PendingDisplaySettingsConfirmation | null = null;
let mainWindowHasFrame = true;
let isQuitting = false;
let canCloseStartupWindow = false;
let f12PressCount = 0;
let f12ResetTimer: NodeJS.Timeout | null = null;

process.on("uncaughtException", (error) => {
  appendServiceLog("SYSTEM", `Uncaught exception: ${formatUnknownError(error)}`);
});

process.on("unhandledRejection", (reason) => {
  appendServiceLog("SYSTEM", `Unhandled rejection: ${formatUnknownError(reason)}`);
});

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

function getProjectRoot() {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : path.resolve(__dirname, "../..");
}

function getRuntimeRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "runtime") : path.join(getProjectRoot(), "release-runtime");
}

function getRuntimeBackendRoot() {
  return path.join(getRuntimeRoot(), "backend");
}

function getRuntimeFrontendRoot() {
  const monorepoServer = path.join(getRuntimeRoot(), "frontend", "frontend", "server.js");
  if (fs.existsSync(monorepoServer)) {
    return path.join(getRuntimeRoot(), "frontend", "frontend");
  }

  return path.join(getRuntimeRoot(), "frontend");
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getManagedNpmCommand(scriptName: string) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm run ${scriptName}`]
    };
  }

  return {
    command: getNpmCommand(),
    args: ["run", scriptName]
  };
}

function getNodeCommand() {
  return process.platform === "win32" ? "node.exe" : "node";
}

function loadRootEnv() {
  const envPaths = app.isPackaged
    ? [path.join(getRuntimeRoot(), ".env"), path.join(getRuntimeBackendRoot(), ".env"), path.join(getProjectRoot(), ".env")]
    : [path.join(getProjectRoot(), ".env")];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

function readPort(name: string, fallback: number) {
  const value = Number(process.env[name]);
  if (Number.isInteger(value) && value > 0 && value < 65536) {
    return value;
  }

  return fallback;
}

function getApiPort() {
  return readPort("API_PORT", DEFAULT_API_PORT);
}

function getFrontendPort() {
  return readPort("FRONTEND_PORT", DEFAULT_FRONTEND_PORT);
}

function getApiHealthUrl() {
  return process.env.API_HEALTH_URL || `http://127.0.0.1:${getApiPort()}/api/health`;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || `http://127.0.0.1:${getFrontendPort()}`;
}

function isDisplayMode(value: unknown): value is DisplayMode {
  return typeof value === "string" && DISPLAY_MODES.includes(value as DisplayMode);
}

function isWindowResolutionPreset(value: unknown): value is WindowResolutionPreset {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(WINDOW_RESOLUTION_PRESETS, value);
}

function getDisplaySettingsPath() {
  return path.join(app.getPath("userData"), "desktop-display-settings.json");
}

function normalizeDesktopDisplaySettings(value: unknown): DesktopDisplaySettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_DISPLAY_SETTINGS;
  }

  const rawSettings = value as Partial<Record<keyof DesktopDisplaySettings, unknown>>;

  return {
    mode: isDisplayMode(rawSettings.mode) ? rawSettings.mode : DEFAULT_DISPLAY_SETTINGS.mode,
    resolution: isWindowResolutionPreset(rawSettings.resolution)
      ? rawSettings.resolution
      : DEFAULT_DISPLAY_SETTINGS.resolution,
    alwaysOnTop:
      typeof rawSettings.alwaysOnTop === "boolean"
        ? rawSettings.alwaysOnTop
        : DEFAULT_DISPLAY_SETTINGS.alwaysOnTop
  };
}

function loadDesktopDisplaySettings() {
  const settingsPath = getDisplaySettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return DEFAULT_DISPLAY_SETTINGS;
  }

  try {
    return normalizeDesktopDisplaySettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")));
  } catch (error) {
    appendServiceLog("SYSTEM", `Unable to read desktop display settings: ${formatUnknownError(error)}`);
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

function saveDesktopDisplaySettings(settings: DesktopDisplaySettings) {
  const settingsPath = getDisplaySettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function getResolutionSize(resolution: WindowResolutionPreset) {
  return WINDOW_RESOLUTION_PRESETS[resolution];
}

function appendServiceLog(source: string, value: Buffer | string) {
  const chunks = String(value)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  for (const line of chunks) {
    const entry = `[${new Date().toLocaleTimeString()}] [${source}] ${line}`;
    serviceLogs.push(entry);
    if (serviceLogs.length > 2000) {
      serviceLogs.shift();
    }

    writeStartupLogFile(entry);
    pushStartupWindowLog(entry);

    if (terminalWindow && !terminalWindow.isDestroyed()) {
      terminalWindow.webContents
        .executeJavaScript(`window.appendLog?.(${JSON.stringify(entry)})`)
        .catch(() => undefined);
    }
  }
}

function writeStartupLogFile(entry: string) {
  if (!STARTUP_LOG_PATH) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(STARTUP_LOG_PATH), { recursive: true });
    fs.appendFileSync(STARTUP_LOG_PATH, `${entry}\n`, "utf8");
  } catch {
    // Startup logging must never block the desktop app.
  }
}

function pushStartupWindowLog(entry: string) {
  if (!startupWindow || startupWindow.isDestroyed()) {
    return;
  }

  startupWindow.webContents
    .executeJavaScript(`window.appendStartupLog?.(${JSON.stringify(entry)})`)
    .catch(() => undefined);
}

function runPowerShell(script: string) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = typeof (error as NodeJS.ErrnoException | null)?.code === "number"
          ? Number((error as NodeJS.ErrnoException).code)
          : 0;
        resolve({ stdout, stderr, code });
      }
    );
  });
}

async function isRunningAsAdmin() {
  if (process.platform !== "win32") {
    return true;
  }

  const result = await runPowerShell(
    "([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"
  );
  return result.stdout.trim().toLowerCase() === "true";
}

async function ensureAdminRuntime() {
  if (process.platform !== "win32") {
    return true;
  }

  if (await isRunningAsAdmin()) {
    appendServiceLog("SYSTEM", "Running with administrator permission.");
    return true;
  }

  appendServiceLog("SYSTEM", "Administrator permission is required. App will stop.");
  return false;
}

async function reclaimManagedPorts() {
  if (process.platform !== "win32") {
    return;
  }

  const ports = [getApiPort(), getFrontendPort()];
  appendServiceLog("SYSTEM", `Reclaiming managed ports: ${ports.join(", ")}`);

  const script = `
$ports = @(${ports.join(", ")})
$listeners = Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
if (-not $listeners) {
  Write-Output "No listeners found on managed ports."
  exit 0
}
foreach ($owner in $listeners) {
  if ($owner -and $owner -gt 0) {
    Write-Output "Killing PID $owner to reclaim managed app port."
    taskkill.exe /PID $owner /T /F
  }
}
`;

  const result = await runPowerShell(script);
  if (result.stdout.trim()) {
    appendServiceLog("SYSTEM", result.stdout);
  }
  if (result.stderr.trim()) {
    appendServiceLog("SYSTEM", result.stderr);
  }
  if (result.code !== 0) {
    appendServiceLog("SYSTEM", `Port reclaim finished with code ${result.code}.`);
  }
}

function isUrlReady(url: string) {
  return new Promise<boolean>((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 500));
    });

    request.on("error", () => resolve(false));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url: string, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isUrlReady(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return false;
}

async function startManagedService(service: ManagedService) {
  if (await isUrlReady(service.readyUrl)) {
    appendServiceLog(service.name, `${service.readyUrl} is already running.`);
    return true;
  }

  appendServiceLog(service.name, `Starting ${service.command} ${service.args.join(" ")}`);
  try {
    service.process = spawn(service.command, service.args, {
      cwd: service.cwd ?? getProjectRoot(),
      env: {
        ...process.env,
        ...service.env,
        FORCE_COLOR: "0"
      },
      windowsHide: true
    });
  } catch (error) {
    appendServiceLog(service.name, `Failed to start service: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }

  service.process.on("error", (error) => {
    appendServiceLog(service.name, `Service process error: ${error.message}`);
  });

  service.process.stdout.on("data", (chunk) => appendServiceLog(service.name, chunk));
  service.process.stderr.on("data", (chunk) => appendServiceLog(service.name, chunk));
  service.process.on("exit", (code, signal) => {
    if (!isQuitting) {
      appendServiceLog(service.name, `Service exited. code=${code ?? "null"} signal=${signal ?? "null"}`);
    }
  });

  const ready = await waitForUrl(service.readyUrl);
  appendServiceLog(service.name, ready ? `${service.readyUrl} is ready.` : `${service.readyUrl} did not become ready in time.`);
  return ready;
}

async function startManagedServices() {
  if (!SHOULD_START_SERVICES) {
    return true;
  }

  if (app.isPackaged) {
    const frontendRoot = getRuntimeFrontendRoot();
    managedServices.push(
      {
        name: "API",
        command: getNodeCommand(),
        args: [path.join(getRuntimeBackendRoot(), "dist", "main.js")],
        cwd: getRuntimeBackendRoot(),
        readyUrl: getApiHealthUrl(),
        env: {
          AHSO_RUNTIME_ROOT: getRuntimeRoot()
        }
      },
      {
        name: "WEB",
        command: getNodeCommand(),
        args: [path.join(frontendRoot, "server.js")],
        cwd: frontendRoot,
        readyUrl: getFrontendUrl(),
        env: {
          HOSTNAME: "127.0.0.1",
          PORT: String(getFrontendPort()),
          NEXT_TELEMETRY_DISABLED: "1"
        }
      }
    );
  } else {
    const apiCommand = getManagedNpmCommand("dev:api");
    const webCommand = getManagedNpmCommand("dev:web");
    managedServices.push(
      {
        name: "API",
        command: apiCommand.command,
        args: apiCommand.args,
        readyUrl: getApiHealthUrl()
      },
      {
        name: "WEB",
        command: webCommand.command,
        args: webCommand.args,
        readyUrl: getFrontendUrl()
      }
    );
  }

  const results = await Promise.all(managedServices.map((service) => startManagedService(service)));
  if (!results.every(Boolean)) {
    appendServiceLog("SYSTEM", "One or more services failed to start. Login screen will not open until services are ready.");
    return false;
  }

  return true;
}

function stopProcessTree(pid: number) {
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true }, () => undefined);
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already stopped.
    }
  }
}

function stopManagedServices() {
  isQuitting = true;
  for (const service of managedServices) {
    if (service.process?.pid) {
      appendServiceLog("SYSTEM", `Stopping ${service.name} pid=${service.process.pid}`);
      stopProcessTree(service.process.pid);
    }
  }
}

function getStartupHtml() {
  const initialLogs = JSON.stringify(serviceLogs);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Starting Samsung QR Recorder Server</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f8fafc;
        --panel: #ffffff;
        --border: #cbd5e1;
        --text: #0f172a;
        --muted: #475569;
        --accent: #0f766e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--bg);
        color: var(--text);
        font-family: Segoe UI, Arial, sans-serif;
      }
      main {
        width: min(560px, calc(100vw - 32px));
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        overflow: hidden;
      }
      header {
        padding: 18px 20px 14px;
        border-bottom: 1px solid var(--border);
      }
      h1 {
        margin: 0 0 6px;
        font-size: 18px;
        line-height: 1.3;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }
      #log {
        height: 240px;
        overflow: auto;
        padding: 12px 20px 18px;
        background: #f1f5f9;
        font-family: Consolas, ui-monospace, monospace;
        font-size: 12px;
        line-height: 1.55;
      }
      .line { color: var(--muted); }
      .line.system, .line.startup { color: var(--accent); }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Samsung QR Recorder Server</h1>
        <p>Đang chuẩn bị quyền, port và dịch vụ nền. Cửa sổ chính sẽ mở khi UI sẵn sàng.</p>
      </header>
      <section id="log"></section>
    </main>
    <script>
      const log = document.getElementById("log");
      const initialLogs = ${initialLogs};
      window.appendStartupLog = function appendStartupLog(line) {
        const div = document.createElement("div");
        const lower = line.toLowerCase();
        div.className = lower.includes("[system]") || lower.includes("[startup]") ? "line system" : "line";
        div.textContent = line;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
      };
      initialLogs.forEach(window.appendStartupLog);
    </script>
  </body>
</html>`;
}

function createStartupWindow() {
  startupWindow = new BrowserWindow({
    width: 620,
    height: 420,
    minWidth: 560,
    minHeight: 360,
    title: "Starting Samsung QR Recorder Server",
    show: true,
    resizable: false,
    maximizable: false,
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  void startupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getStartupHtml())}`);
  startupWindow.on("close", (event) => {
    if (!canCloseStartupWindow && !isQuitting) {
      event.preventDefault();
      app.quit();
    }
  });
  startupWindow.on("closed", () => {
    startupWindow = null;
  });
}

function closeStartupWindow() {
  if (!startupWindow || startupWindow.isDestroyed()) {
    return;
  }

  canCloseStartupWindow = true;
  startupWindow.close();
}

function getTerminalHtml() {
  const initialLogs = JSON.stringify(serviceLogs);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Samsung QR Recorder Terminal</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #111827;
        --panel: #0b1220;
        --border: #263244;
        --text: #e5e7eb;
        --muted: #94a3b8;
        --accent: #38bdf8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      header {
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        border-bottom: 1px solid var(--border);
        background: var(--panel);
      }
      strong { font-size: 13px; }
      span { color: var(--muted); font-size: 12px; }
      #log {
        height: calc(100vh - 48px);
        overflow: auto;
        white-space: pre-wrap;
        padding: 12px 14px 24px;
        font-size: 12px;
        line-height: 1.55;
      }
      .line { color: var(--text); }
      .line.system { color: var(--accent); }
    </style>
  </head>
  <body>
    <header>
      <strong>Service terminal</strong>
      <span>F12 x5 opens this window. Close hides it.</span>
    </header>
    <main id="log"></main>
    <script>
      const log = document.getElementById("log");
      const initialLogs = ${initialLogs};
      window.appendLog = function appendLog(line) {
        const div = document.createElement("div");
        div.className = line.includes("[SYSTEM]") ? "line system" : "line";
        div.textContent = line;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
      };
      initialLogs.forEach(window.appendLog);
    </script>
  </body>
</html>`;
}

function createTerminalWindow() {
  terminalWindow = new BrowserWindow({
    width: 1080,
    height: 640,
    minWidth: 780,
    minHeight: 420,
    title: "Samsung QR Recorder Terminal",
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  void terminalWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getTerminalHtml())}`);
  terminalWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      terminalWindow?.hide();
    }
  });
}

function showTerminalWindow() {
  if (!terminalWindow || terminalWindow.isDestroyed()) {
    createTerminalWindow();
  }

  terminalWindow?.show();
  terminalWindow?.focus();
}

function bringMainWindowToFront(targetWindow: BrowserWindow, keepOnTop: boolean) {
  if (targetWindow.isDestroyed()) {
    return;
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }

  targetWindow.show();
  targetWindow.moveTop();
  targetWindow.focus();

  if (keepOnTop) {
    targetWindow.setAlwaysOnTop(false);
    targetWindow.setAlwaysOnTop(true);
    targetWindow.moveTop();
    targetWindow.focus();
  }
}

function applyDisplaySettingsToWindow(
  targetWindow: BrowserWindow,
  settings: DesktopDisplaySettings,
  previousSettings?: DesktopDisplaySettings,
  shouldFocusAfterApply = false
) {
  targetWindow.setAlwaysOnTop(settings.alwaysOnTop);

  const shouldApplyGeometry =
    !previousSettings || previousSettings.mode !== settings.mode || previousSettings.resolution !== settings.resolution;

  if (shouldApplyGeometry) {
    if (settings.mode === "fullscreen") {
      targetWindow.setFullScreen(true);
    } else {
      if (targetWindow.isFullScreen()) {
        targetWindow.setFullScreen(false);
      }

      if (targetWindow.isMaximized()) {
        targetWindow.unmaximize();
      }

      const [width, height] = getResolutionSize(settings.resolution);
      const [currentWidth, currentHeight] = targetWindow.getSize();
      if (currentWidth !== width || currentHeight !== height) {
        targetWindow.setSize(width, height);
        targetWindow.center();
      }
    }
  }

  if (shouldFocusAfterApply) {
    setTimeout(() => bringMainWindowToFront(targetWindow, settings.alwaysOnTop), 80);
  }
}

async function captureMainWindowRestoreState(targetWindow: BrowserWindow) {
  const frontendUrl = getFrontendUrl();
  const currentUrl = targetWindow.webContents.getURL();
  const restoreState: MainWindowRestoreState = {
    url: currentUrl.startsWith(frontendUrl) ? currentUrl : frontendUrl
  };

  try {
    const sessionToken = await targetWindow.webContents.executeJavaScript(
      `window.sessionStorage.getItem(${JSON.stringify(SESSION_STORAGE_KEY)})`,
      true
    );
    if (typeof sessionToken === "string" && sessionToken.length > 0) {
      restoreState.sessionToken = sessionToken;
    }
  } catch (error) {
    appendServiceLog("SYSTEM", `Unable to preserve session before window recreation: ${formatUnknownError(error)}`);
  }

  return restoreState;
}

async function recreateMainWindow() {
  const previousWindow = mainWindow;
  pendingMainWindowRestoreState = previousWindow && !previousWindow.isDestroyed() ? await captureMainWindowRestoreState(previousWindow) : null;

  if (previousWindow && !previousWindow.isDestroyed()) {
    previousWindow.removeAllListeners("closed");
    previousWindow.destroy();
  }

  mainWindow = null;
  createMainWindow();
}

async function applyDesktopDisplaySettings(settings: DesktopDisplaySettings) {
  clearPendingDisplaySettingsConfirmation();
  await setDesktopDisplaySettings(settings, { persist: true, focusAfterApply: true });
}

async function setDesktopDisplaySettings(
  settings: DesktopDisplaySettings,
  options: { persist: boolean; focusAfterApply: boolean }
) {
  const previousDisplaySettings = desktopDisplaySettings;
  desktopDisplaySettings = normalizeDesktopDisplaySettings(settings);
  if (options.persist) {
    saveDesktopDisplaySettings(desktopDisplaySettings);
  }
  appendServiceLog(
    "SYSTEM",
    `Display settings ${options.persist ? "saved" : "previewed"}: mode=${desktopDisplaySettings.mode} resolution=${desktopDisplaySettings.resolution} alwaysOnTop=${desktopDisplaySettings.alwaysOnTop}.`
  );

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const nextHasFrame = desktopDisplaySettings.mode !== "borderless";
  if (mainWindowHasFrame !== nextHasFrame) {
    await recreateMainWindow();
    return;
  }

  applyDisplaySettingsToWindow(mainWindow, desktopDisplaySettings, previousDisplaySettings, options.focusAfterApply);
}

function getDisplaySettingsState() {
  return {
    settings: desktopDisplaySettings,
    previousSettings: pendingDisplaySettingsConfirmation?.previousSettings ?? null,
    confirmationDeadline: pendingDisplaySettingsConfirmation?.confirmationDeadline ?? null
  };
}

function clearPendingDisplaySettingsConfirmation() {
  if (!pendingDisplaySettingsConfirmation) {
    return;
  }

  clearTimeout(pendingDisplaySettingsConfirmation.timer);
  pendingDisplaySettingsConfirmation = null;
}

async function rollbackPendingDisplaySettings() {
  const previousSettings = pendingDisplaySettingsConfirmation?.previousSettings;
  clearPendingDisplaySettingsConfirmation();

  if (!previousSettings) {
    return getDisplaySettingsState();
  }

  await setDesktopDisplaySettings(previousSettings, { persist: true, focusAfterApply: true });
  appendServiceLog("SYSTEM", "Display settings rolled back.");
  return getDisplaySettingsState();
}

async function previewDesktopDisplaySettings(settings: DesktopDisplaySettings) {
  const previousSettings = pendingDisplaySettingsConfirmation?.previousSettings ?? desktopDisplaySettings;
  clearPendingDisplaySettingsConfirmation();

  const previewSettings = normalizeDesktopDisplaySettings(settings);
  const confirmationDeadline = Date.now() + 5000;
  const timer = setTimeout(() => {
    rollbackPendingDisplaySettings().catch((error) => {
      appendServiceLog("SYSTEM", `Unable to auto rollback display settings: ${formatUnknownError(error)}`);
    });
  }, 5000);

  pendingDisplaySettingsConfirmation = {
    previousSettings,
    previewSettings,
    confirmationDeadline,
    timer
  };

  await setDesktopDisplaySettings(previewSettings, { persist: false, focusAfterApply: true });
  return getDisplaySettingsState();
}

async function confirmDesktopDisplaySettings() {
  const previewSettings = pendingDisplaySettingsConfirmation?.previewSettings ?? desktopDisplaySettings;
  clearPendingDisplaySettingsConfirmation();
  await setDesktopDisplaySettings(previewSettings, { persist: true, focusAfterApply: true });
  appendServiceLog("SYSTEM", "Display settings confirmed.");
  return getDisplaySettingsState();
}

function getDesktopWindowState() {
  const [width, height] = mainWindow?.getSize() ?? [0, 0];

  return {
    width,
    height,
    displaySettings: desktopDisplaySettings
  };
}

function normalizeVersion(value: string) {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function getUpdateRepository() {
  if (process.env.UPDATE_REPOSITORY?.trim()) {
    return process.env.UPDATE_REPOSITORY.trim();
  }

  const updateSourcePath = path.join(getRuntimeRoot(), "update-source.json");
  if (!fs.existsSync(updateSourcePath)) {
    return "";
  }

  try {
    const value = JSON.parse(fs.readFileSync(updateSourcePath, "utf8")) as { repository?: string };
    return value.repository?.trim() ?? "";
  } catch (error) {
    appendServiceLog("SYSTEM", `Unable to read update source: ${formatUnknownError(error)}`);
    return "";
  }
}

function requestJson<T>(url: string) {
  return new Promise<T>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": APP_NAME
        }
      },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          requestJson<T>(response.headers.location).then(resolve, reject);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub returned ${response.statusCode}: ${body.slice(0, 200)}`));
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("GitHub update check timed out."));
    });
  });
}

function mapRelease(release: GithubRelease, currentVersion: string): AppUpdateRelease | null {
  if (release.draft) {
    return null;
  }

  const version = normalizeVersion(release.tag_name);
  if (!version || compareVersions(version, currentVersion) <= 0) {
    return null;
  }

  const asset = release.assets.find((item) => item.name.toLowerCase().endsWith(".exe") && !item.name.toLowerCase().endsWith(".blockmap.exe"));
  if (!asset) {
    return null;
  }

  return {
    version,
    tagName: release.tag_name,
    name: release.name || release.tag_name,
    url: release.html_url,
    publishedAt: release.published_at,
    prerelease: release.prerelease,
    assetName: asset.name,
    assetSize: asset.size
  };
}

async function getAvailableUpdateReleases() {
  const repository = getUpdateRepository();
  const currentVersion = normalizeVersion(app.getVersion()) ?? "0.0.0";
  if (!repository) {
    return {
      currentVersion,
      repository,
      packaged: app.isPackaged,
      releases: [] as AppUpdateRelease[],
      message: "UPDATE_REPOSITORY is not configured."
    };
  }

  const releases = await requestJson<GithubRelease[]>(`https://api.github.com/repos/${repository}/releases`);
  const mappedReleases = releases
    .map((release) => mapRelease(release, currentVersion))
    .filter((release): release is AppUpdateRelease => Boolean(release))
    .sort((first, second) => compareVersions(second.version, first.version));

  return {
    currentVersion,
    repository,
    packaged: app.isPackaged,
    releases: mappedReleases,
    message: mappedReleases.length ? "Updates are available." : "App is up to date."
  };
}

async function checkForUpdates() {
  try {
    return {
      success: true,
      ...(await getAvailableUpdateReleases())
    };
  } catch (error) {
    appendServiceLog("SYSTEM", `Update check failed: ${formatUnknownError(error)}`);
    return {
      success: false,
      currentVersion: normalizeVersion(app.getVersion()) ?? app.getVersion(),
      repository: getUpdateRepository(),
      packaged: app.isPackaged,
      releases: [] as AppUpdateRelease[],
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function downloadFile(url: string, targetPath: string) {
  return new Promise<void>((resolve, reject) => {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const file = fs.createWriteStream(targetPath);

    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/octet-stream",
          "User-Agent": APP_NAME
        }
      },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.rmSync(targetPath, { force: true });
          downloadFile(response.headers.location, targetPath).then(resolve, reject);
          return;
        }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          file.close();
          fs.rmSync(targetPath, { force: true });
          reject(new Error(`Download failed with status ${response.statusCode ?? "unknown"}.`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      }
    );

    request.on("error", (error) => {
      file.close();
      fs.rmSync(targetPath, { force: true });
      reject(error);
    });
    request.setTimeout(120000, () => {
      request.destroy(new Error("Update download timed out."));
    });
  });
}

async function installUpdate(tagName: string) {
  if (!app.isPackaged) {
    throw new Error("Update install is only available in packaged desktop builds.");
  }

  const state = await getAvailableUpdateReleases();
  const release = state.releases.find((item) => item.tagName === tagName);
  if (!release) {
    throw new Error("Selected release is not a valid upgrade target.");
  }

  const githubRelease = await requestJson<GithubRelease>(`https://api.github.com/repos/${state.repository}/releases/tags/${encodeURIComponent(tagName)}`);
  const asset = githubRelease.assets.find((item) => item.name === release.assetName);
  if (!asset) {
    throw new Error("Installer asset was not found on the selected release.");
  }

  const targetPath = path.join(app.getPath("userData"), "updates", asset.name);
  appendServiceLog("SYSTEM", `Downloading update ${tagName} to ${targetPath}`);
  await downloadFile(asset.browser_download_url, targetPath);

  appendServiceLog("SYSTEM", `Launching update installer ${targetPath}`);
  const installer = spawn(targetPath, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  installer.unref();

  setTimeout(() => app.quit(), 500);
  return {
    success: true,
    message: "Update installer started."
  };
}

function registerAppIpc() {
  ipcMain.handle("app:quit", () => {
    appendServiceLog("SYSTEM", "Quit requested from desktop UI.");
    setTimeout(() => app.quit(), 0);
  });

  ipcMain.handle("app:restart", () => {
    appendServiceLog("SYSTEM", "Restart requested from desktop UI.");
    app.relaunch();
    setTimeout(() => app.quit(), 0);
  });

  ipcMain.handle("window:get-state", () => getDesktopWindowState());
  ipcMain.handle("window:get-display-settings", () => desktopDisplaySettings);
  ipcMain.handle("window:get-display-settings-state", () => getDisplaySettingsState());
  ipcMain.handle("window:save-display-settings", async (_event, settings: unknown) => {
    await applyDesktopDisplaySettings(normalizeDesktopDisplaySettings(settings));
    return desktopDisplaySettings;
  });
  ipcMain.handle("window:preview-display-settings", async (_event, settings: unknown) =>
    previewDesktopDisplaySettings(normalizeDesktopDisplaySettings(settings))
  );
  ipcMain.handle("window:confirm-display-settings", () => confirmDesktopDisplaySettings());
  ipcMain.handle("window:rollback-display-settings", () => rollbackPendingDisplaySettings());
  ipcMain.handle("updates:check", () => checkForUpdates());
  ipcMain.handle("updates:install", (_event, tagName: unknown) => installUpdate(String(tagName ?? "")));
}

function registerHiddenTerminalShortcut(targetWindow: BrowserWindow) {
  targetWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.key !== "F12") {
      return;
    }

    event.preventDefault();
    f12PressCount += 1;

    if (f12ResetTimer) {
      clearTimeout(f12ResetTimer);
    }

    f12ResetTimer = setTimeout(() => {
      f12PressCount = 0;
    }, 2500);

    if (f12PressCount >= 5) {
      f12PressCount = 0;
      showTerminalWindow();
    }
  });
}

function createMainWindow() {
  const [width, height] = getResolutionSize(desktopDisplaySettings.resolution);
  const restoreState = pendingMainWindowRestoreState;
  const restoreArguments = restoreState?.sessionToken
    ? [`--restore-session-token=${encodeURIComponent(restoreState.sessionToken)}`]
    : [];
  pendingMainWindowRestoreState = null;
  mainWindowHasFrame = desktopDisplaySettings.mode !== "borderless";

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1180,
    minHeight: 720,
    title: APP_NAME,
    show: false,
    frame: mainWindowHasFrame,
    alwaysOnTop: desktopDisplaySettings.alwaysOnTop,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: restoreArguments,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  applyDisplaySettingsToWindow(mainWindow, desktopDisplaySettings);

  const frontendUrl = getFrontendUrl();
  const initialUrl = restoreState?.url?.startsWith(frontendUrl) ? restoreState.url : frontendUrl;
  void mainWindow.loadURL(initialUrl);

  mainWindow.once("ready-to-show", () => {
    appendServiceLog("SYSTEM", "Desktop UI is ready.");
    closeStartupWindow();
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    appendServiceLog("SYSTEM", `Desktop UI failed to load. code=${errorCode} message=${errorDescription}`);
    closeStartupWindow();
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(frontendUrl)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  registerHiddenTerminalShortcut(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

app.whenReady().then(async () => {
  registerAppIpc();
  loadRootEnv();
  desktopDisplaySettings = loadDesktopDisplaySettings();
  createTerminalWindow();
  if (SHOULD_START_SERVICES) {
    createStartupWindow();
  }
  appendServiceLog("SYSTEM", SHOULD_START_SERVICES ? "Desktop app is starting managed API and WEB services." : "Desktop app is using existing services.");
  if (SHOULD_START_SERVICES && !(await ensureAdminRuntime())) {
    appendServiceLog("SYSTEM", "Startup stopped because administrator permission is missing.");
    setTimeout(() => app.quit(), 2500);
    return;
  }
  if (SHOULD_START_SERVICES) {
    appendServiceLog("STARTUP", "Reclaiming managed ports before starting services.");
    await reclaimManagedPorts();
  }
  appendServiceLog("STARTUP", "Starting managed services.");
  const servicesReady = await startManagedServices();
  if (!servicesReady) {
    appendServiceLog("SYSTEM", "Startup stopped on service readiness check. Close this window to stop the app.");
    return;
  }
  appendServiceLog("STARTUP", "Opening desktop UI.");
  createMainWindow();

  app.on("activate", () => {
    if (!mainWindow) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopManagedServices();
});
