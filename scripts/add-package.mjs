import { spawnSync } from "node:child_process";

const [, , workspace, ...packages] = process.argv;

const workspaceMap = {
  frontend: "frontend",
  backend: "backend",
  electron: "desktop",
  shared: "shared",
  root: null
};

if (!workspace || !(workspace in workspaceMap) || packages.length === 0) {
  console.log("Usage examples:");
  console.log("  npm run add:web -- recharts");
  console.log("  npm run add:api -- @nestjs/jwt");
  console.log("  npm run add:root -- -D eslint");
  process.exit(1);
}

const args = ["install", ...packages];
const mappedWorkspace = workspaceMap[workspace];

if (mappedWorkspace) {
  args.push("-w", mappedWorkspace);
}

const result = spawnSync("npm", args, {
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 0);
