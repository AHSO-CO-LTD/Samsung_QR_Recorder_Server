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

const { PrismaClient, Severity, UserRole } = await import("@prisma/client");
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

const errorCodes = [
  ["SERVER_DUPLICATE", "duplicate", Severity.ERROR, "Server detected duplicate key in duplicate window."],
  ["LED_SUFFIX_NOT_MATCH", "local-parse", Severity.ERROR, "LED suffix does not match profile rule."],
  ["MACHINE_NOT_FOUND", "machine", Severity.ERROR, "Machine code does not exist or is inactive."],
  ["PROFILE_NOT_FOUND", "profile", Severity.ERROR, "Profile does not exist or is inactive."],
  ["LOCAL_DUPLICATE", "local-duplicate", Severity.WARNING, "Local app detected duplicate in local scope."],
  ["PAYLOAD_INVALID", "api", Severity.ERROR, "Payload is invalid."]
];

const notificationTemplates = [
  [
    "SERVER_DUPLICATE",
    "Server duplicate detected",
    "Machine {{machine_code}} sent duplicate key {{duplicate_key}}.",
    Severity.ERROR,
    "SERVER_UI"
  ],
  [
    "MACHINE_OFFLINE",
    "Machine offline",
    "Machine {{machine_code}} has not sent heartbeat in time.",
    Severity.WARNING,
    "SERVER_UI"
  ],
  [
    "OFFLINE_SYNC_HAS_NG",
    "Offline sync has NG",
    "Batch {{batch_code}} contains NG or failed records.",
    Severity.WARNING,
    "BOTH"
  ]
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

  const settings = await prisma.serverSetting.findFirst({ orderBy: { id: "asc" } });
  const settingsData = {
    factory_code_default: process.env.SEED_FACTORY_CODE || "DYS3",
    full_code_length_default: 35,
    full_vendor_position_default: 18,
    led_scan_length_default: 22,
    led_vendor_position_default: 16,
    duplicate_days: Number(process.env.SEED_DUPLICATE_DAYS || 31),
    heartbeat_timeout_seconds: Number(process.env.SEED_HEARTBEAT_TIMEOUT_SECONDS || 60)
  };
  if (settings) {
    await prisma.serverSetting.update({ where: { id: settings.id }, data: settingsData });
  } else {
    await prisma.serverSetting.create({ data: settingsData });
  }
  console.log("Seeded server settings");

  const machine = await prisma.machine.upsert({
    where: { machine_code: "LOCAL01" },
    create: {
      machine_code: "LOCAL01",
      machine_name: "Local scanner 01",
      line_name: "LINE-A",
      station_name: "ST-01",
      is_active: true
    },
    update: {
      machine_name: "Local scanner 01",
      line_name: "LINE-A",
      station_name: "ST-01",
      is_active: true
    }
  });
  console.log(`Seeded machine: ${machine.machine_code}`);

  const vendor = await prisma.vendor.upsert({
    where: { vendor_char: "L" },
    create: {
      vendor_name: "Default LED Vendor",
      vendor_char: "L",
      status: "ACTIVE"
    },
    update: {
      vendor_name: "Default LED Vendor",
      status: "ACTIVE"
    }
  });

  const chassis = await prisma.chassisCode.upsert({
    where: { code_full: "BN96-60877C" },
    create: {
      code_full: "BN96-60877C",
      code_input: "60877C",
      is_active: true
    },
    update: {
      code_input: "60877C",
      is_active: true
    }
  });

  const led = await prisma.ledCode.upsert({
    where: { code_full: "BN96-60376A" },
    create: {
      code_full: "BN96-60376A",
      code_input: "60376A",
      suffix_check: "0376A",
      is_active: true
    },
    update: {
      code_input: "60376A",
      suffix_check: "0376A",
      is_active: true
    }
  });

  const profile = await prisma.productProfile.upsert({
    where: { chassis_code_id: chassis.id },
    create: {
      chassis_code_id: chassis.id,
      vendor_id: vendor.id,
      factory_code: settingsData.factory_code_default,
      full_code_length: 35,
      full_vendor_position: 18,
      led_scan_length: 22,
      led_vendor_position: 16,
      version: 1,
      is_active: true
    },
    update: {
      vendor_id: vendor.id,
      factory_code: settingsData.factory_code_default,
      full_code_length: 35,
      full_vendor_position: 18,
      led_scan_length: 22,
      led_vendor_position: 16,
      is_active: true
    },
    include: {
      chassis_code: true,
      vendor: true,
      profile_led_codes: {
        include: { led_code: true },
        orderBy: { led_slot: "asc" }
      }
    }
  });

  await prisma.profileLedCode.deleteMany({ where: { profile_id: profile.id } });
  await prisma.profileLedCode.create({
    data: {
      profile_id: profile.id,
      led_code_id: led.id,
      led_slot: 1,
      is_required: true
    }
  });

  const loadedProfile = await prisma.productProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      chassis_code: true,
      vendor: true,
      profile_led_codes: {
        include: { led_code: true },
        orderBy: { led_slot: "asc" }
      }
    }
  });

  const snapshot = await prisma.profileSnapshot.findFirst({
    where: {
      profile_id: loadedProfile.id,
      version: loadedProfile.version
    }
  });
  if (!snapshot) {
    await prisma.profileSnapshot.create({
      data: {
        profile_id: loadedProfile.id,
        version: loadedProfile.version,
        snapshot_json: JSON.parse(JSON.stringify(loadedProfile))
      }
    });
  }
  console.log(`Seeded profile: ${loadedProfile.chassis_code.code_full}`);

  for (const [code, groupName, severity, defaultMessage] of errorCodes) {
    await prisma.errorCode.upsert({
      where: { code },
      create: {
        code,
        group_name: groupName,
        severity,
        default_message: defaultMessage,
        is_active: true
      },
      update: {
        group_name: groupName,
        severity,
        default_message: defaultMessage,
        is_active: true
      }
    });
  }
  console.log(`Seeded ${errorCodes.length} error codes`);

  for (const [notiCode, titleTemplate, messageTemplate, severity, target] of notificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { noti_code: notiCode },
      create: {
        noti_code: notiCode,
        title_template: titleTemplate,
        message_template: messageTemplate,
        severity,
        target,
        is_active: true
      },
      update: {
        title_template: titleTemplate,
        message_template: messageTemplate,
        severity,
        target,
        is_active: true
      }
    });
  }
  console.log(`Seeded ${notificationTemplates.length} notification templates`);
} finally {
  await prisma.$disconnect();
}
