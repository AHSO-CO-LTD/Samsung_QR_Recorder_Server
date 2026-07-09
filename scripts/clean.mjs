import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  "backend/dist",
  "shared/dist",
  "electron/dist",
  "frontend/.next",
  "frontend/out",
  "release",
  ".next",
  ".turbo"
];

function resolveInsideRoot(relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) {
    throw new Error(`Refusing to remove outside project root: ${resolved}`);
  }
  return resolved;
}

for (const target of targets) {
  const resolved = resolveInsideRoot(target);
  await rm(resolved, { recursive: true, force: true });
  console.log(`cleaned ${target}`);
}
