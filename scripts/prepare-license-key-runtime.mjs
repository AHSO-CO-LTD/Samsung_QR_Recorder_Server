import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "external", "license-key");
const sourceElectron = path.join(sourceRoot, "electron");
const targetRoot = path.join(root, "electron", "dist", "license-key");
const targetElectron = path.join(targetRoot, "electron");
const staleIntegrityFiles = [
  path.join(root, "electron", "src", "license", "license-runtime-integrity.generated.ts"),
  path.join(root, "electron", "dist", "license", "license-runtime-integrity.generated.js")
];
const runtimeFiles = ["licenseManager.js", "machineId.js", "verifyLicense.js"];

if (!fs.existsSync(sourceElectron)) {
  throw new Error("License-Key submodule was not found. Run: git submodule update --init --recursive");
}

fs.rmSync(targetRoot, { recursive: true, force: true });
for (const staleFile of staleIntegrityFiles) {
  fs.rmSync(staleFile, { force: true });
}
fs.mkdirSync(targetElectron, { recursive: true });

for (const fileName of runtimeFiles) {
  const sourceFile = path.join(sourceElectron, fileName);
  const targetFile = path.join(targetElectron, fileName);
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
  } else {
    throw new Error(`License runtime file was not found: ${path.relative(root, sourceFile)}`);
  }
}

console.log(`[license] Prepared ${path.relative(root, targetRoot)} (${runtimeFiles.length} runtime files)`);
