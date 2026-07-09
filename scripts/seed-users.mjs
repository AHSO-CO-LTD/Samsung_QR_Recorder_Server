import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2$sha256$${iterations}$${salt}$${hash}`;
}

loadEnv();

const { PrismaClient, UserRole } = await import("@prisma/client");
const prisma = new PrismaClient();

const users = [
  {
    username: process.env.SEED_ADMIN_USERNAME || "admin",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin@123456",
    full_name: process.env.SEED_ADMIN_FULL_NAME || "System Administrator",
    role: UserRole.ADMIN
  },
  {
    username: process.env.SEED_DEV_USERNAME || "dev",
    password: process.env.SEED_DEV_PASSWORD || "Dev@123456",
    full_name: process.env.SEED_DEV_FULL_NAME || "Developer",
    role: UserRole.DEV
  }
];

try {
  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      create: {
        username: user.username,
        password_hash: hashPassword(user.password),
        full_name: user.full_name,
        role: user.role,
        is_active: true
      },
      update: {
        password_hash: hashPassword(user.password),
        full_name: user.full_name,
        role: user.role,
        is_active: true
      }
    });

    console.log(`Seeded ${user.role.toLowerCase()} account: ${user.username}`);
  }
} finally {
  await prisma.$disconnect();
}
