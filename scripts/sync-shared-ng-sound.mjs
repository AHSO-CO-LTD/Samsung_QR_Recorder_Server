import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const sourceFile = resolve(projectRoot, "shared", "NG Sound", "NG.wav");
const destinationFile = resolve(projectRoot, "frontend", "public", "sounds", "ng-default.wav");

await mkdir(dirname(destinationFile), { recursive: true });
await copyFile(sourceFile, destinationFile);

console.log("Synced shared NG sound to the frontend public assets.");
