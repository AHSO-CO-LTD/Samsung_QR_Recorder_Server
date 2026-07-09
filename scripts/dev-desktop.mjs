import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronMainScript = path.join(root, "electron", "dist", "main.js");
const startupLogPath = path.join(root, "logs", "desktop-runtime.log");
const requireFromDesktop = createRequire(path.join(root, "electron", "package.json"));

function getElectronExecutable() {
  const executable = requireFromDesktop("electron");
  if (typeof executable !== "string") {
    throw new Error("Cannot resolve Electron executable from desktop workspace.");
  }

  return executable;
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function psArray(values) {
  return `@(${values.map(psQuote).join(", ")})`;
}

function isWindowsAdmin() {
  if (process.platform !== "win32") {
    return true;
  }

  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"
    ],
    { encoding: "utf8" }
  );

  return result.status === 0 && result.stdout.trim().toLowerCase() === "true";
}

function run(command, args) {
  console.log(`[desktop] Running: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    console.error(`[desktop] Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(getNpmCommand(), ["run", "build", "-w", "desktop"]);

const electronExecutable = getElectronExecutable();
const electronArgs = [electronMainScript, "--start-services", "--startup-log", startupLogPath];

if (process.platform === "win32" && !isWindowsAdmin()) {
  console.log("[desktop] Administrator permission is required.");
  console.log("[desktop] Requesting Windows UAC permission now...");

  const launch = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `$ErrorActionPreference = 'Stop'; $process = Start-Process -FilePath ${psQuote(electronExecutable)} -ArgumentList ${psArray(electronArgs)} -WorkingDirectory ${psQuote(root)} -Verb RunAs -PassThru; Write-Output "[desktop] Started elevated Electron process PID=$($process.Id)"`
    ],
    { stdio: "inherit" }
  );

  if (launch.error) {
    console.error(`[desktop] Failed to request administrator permission: ${launch.error.message}`);
    process.exit(1);
  }

  if (launch.status !== 0) {
    console.error("[desktop] Admin permission was rejected. Desktop app was not started.");
    process.exit(launch.status ?? 1);
  }

  console.log(`[desktop] Startup log: ${startupLogPath}`);
  process.exit(0);
}

const child = spawn(electronExecutable, electronArgs, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_START_SERVICES: "1"
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
