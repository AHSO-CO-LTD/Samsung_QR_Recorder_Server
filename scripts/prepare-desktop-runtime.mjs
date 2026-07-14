import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(root, "release-runtime");
const backendRuntime = path.join(runtimeRoot, "backend");
const frontendRuntime = path.join(runtimeRoot, "frontend");

function copyRequired(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Required build artifact is missing: ${path.relative(root, source)}`);
  }
  fs.cpSync(source, target, { recursive: true });
}

function copyOptional(source, target) {
  if (fs.existsSync(source)) {
    fs.cpSync(source, target, { recursive: true });
  }
}

function run(command, args, options = {}) {
  console.log(`[runtime] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: {
      ...process.env,
      ...options.env
    },
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getBinCommand(packageRoot, name) {
  return path.join(packageRoot, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
}

function getFrontendServerRoot() {
  const monorepoServer = path.join(frontendRuntime, "frontend", "server.js");
  if (fs.existsSync(monorepoServer)) {
    return path.join(frontendRuntime, "frontend");
  }
  return frontendRuntime;
}

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.mkdirSync(runtimeRoot, { recursive: true });

copyRequired(path.join(root, "backend", "dist"), path.join(backendRuntime, "dist"));
copyRequired(path.join(root, "backend", "package.json"), path.join(backendRuntime, "package.json"));
copyRequired(path.join(root, "prisma"), path.join(runtimeRoot, "prisma"));
copyRequired(path.join(root, "prisma"), path.join(backendRuntime, "prisma"));

fs.mkdirSync(path.join(backendRuntime, "scripts"), { recursive: true });
copyRequired(path.join(root, "scripts", "seed-users.mjs"), path.join(backendRuntime, "scripts", "seed-users.mjs"));

copyRequired(path.join(root, "frontend", ".next", "standalone"), frontendRuntime);
const frontendServerRoot = getFrontendServerRoot();
copyRequired(path.join(root, "frontend", ".next", "static"), path.join(frontendServerRoot, ".next", "static"));
copyOptional(path.join(root, "frontend", "public"), path.join(frontendServerRoot, "public"));

const updateRepository = process.env.GITHUB_REPOSITORY || process.env.UPDATE_REPOSITORY || "";
fs.writeFileSync(
  path.join(runtimeRoot, "update-source.json"),
  `${JSON.stringify({ repository: updateRepository }, null, 2)}\n`,
  "utf8"
);

run(getNpmCommand(), ["install", "--omit=dev", "--no-audit", "--no-fund", "--package-lock=false"], {
  cwd: backendRuntime
});

run(getBinCommand(backendRuntime, "prisma"), ["generate", "--schema", path.join(backendRuntime, "prisma", "schema.prisma")], {
  cwd: backendRuntime,
  env: {
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ahso_qr_recorder"
  }
});

console.log(`[runtime] Prepared ${path.relative(root, runtimeRoot)}`);
