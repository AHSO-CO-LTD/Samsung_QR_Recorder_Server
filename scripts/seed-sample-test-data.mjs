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

loadEnv();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const SETTINGS = {
  factory_code_default: process.env.SEED_FACTORY_CODE || "DZLV",
  full_code_length_default: 35,
  full_vendor_position_default: 18,
  led_scan_length_default: 22,
  led_vendor_position_default: 16,
  duplicate_days: Number(process.env.SEED_DUPLICATE_DAYS || 31),
  heartbeat_timeout_seconds: Number(process.env.SEED_HEARTBEAT_TIMEOUT_SECONDS || 60)
};

const SAMPLE_MACHINE = {
  machine_code: process.env.SEED_SAMPLE_MACHINE_CODE || "LOCAL01",
  machine_name: process.env.SEED_SAMPLE_MACHINE_NAME || "Local scanner 01",
  serial: process.env.SEED_MACHINE_SERIAL || "SN-LOCAL01-DEV",
  uid: process.env.SEED_MACHINE_UID || "UID-LOCAL01-DEV",
  line_name: process.env.SEED_SAMPLE_LINE_NAME || "LINE-A",
  station_name: process.env.SEED_SAMPLE_STATION_NAME || "ST-01"
};

const SAMPLE_VENDORS = [
  { vendor_name: "Samsung", vendor_char: "S" },
  { vendor_name: "Lumens", vendor_char: "L" },
  { vendor_name: "Apex", vendor_char: "A" },
  { vendor_name: "Bright", vendor_char: "B" },
  { vendor_name: "Core", vendor_char: "C" }
];

const SAMPLE_CHASSIS_CODES = [
  { code_full: "BN96-58567A", code_input: "58567A" },
  { code_full: "BN96-60877C", code_input: "60877C" },
  { code_full: "BN96-61234B", code_input: "61234B" }
];

const SAMPLE_LED_CODES = [
  { code_full: "BN96-58282A", code_input: "58282A" },
  { code_full: "BN96-60376A", code_input: "60376A" },
  { code_full: "BN96-60377B", code_input: "60377B" },
  { code_full: "BN96-60378C", code_input: "60378C" },
  { code_full: "BN96-60379D", code_input: "60379D" },
  { code_full: "BN96-60380E", code_input: "60380E" }
].map((item) => ({
  ...item,
  suffix_check: item.code_input.slice(-5)
}));

const PROFILE_LED_PLAN = [
  ["BN96-58567A", ["BN96-58282A", "BN96-60376A"]],
  ["BN96-60877C", ["BN96-60377B", "BN96-60378C"]],
  ["BN96-61234B", ["BN96-60379D", "BN96-60380E"]]
];

const DUPLICATE_RECORD_COUNT = Number(process.env.SEED_DUPLICATE_RECORD_COUNT || 1500);
const LOCAL_SCAN_ID_PREFIX = process.env.SEED_DUPLICATE_LOCAL_ID_PREFIX || "SEED-DUP";

function compactProfile(profile) {
  return {
    id: profile.id,
    chassis_code: profile.chassis_code,
    factory_code: profile.factory_code,
    full_code_length: profile.full_code_length,
    full_vendor_position: profile.full_vendor_position,
    led_scan_length: profile.led_scan_length,
    led_vendor_position: profile.led_vendor_position,
    version: profile.version,
    profile_led_codes: profile.profile_led_codes.map((item) => ({
      led_slot: item.led_slot,
      is_required: item.is_required,
      led_code: item.led_code
    }))
  };
}

function buildCheckHead(sequence) {
  if (sequence === 1) {
    return "1F1";
  }

  return sequence.toString(36).toUpperCase().padStart(3, "0").slice(-3);
}

function buildCheckTail(sequence) {
  if (sequence === 1) {
    return "X880447";
  }

  return `X${String(sequence).padStart(6, "0")}`;
}

function buildFullCode(profile, ledCode, vendor, sequence) {
  const productCode = profile.chassis_code.code_full.split("-")[0];
  const modelCode = profile.chassis_code.code_input;
  const beforeVendor = buildCheckHead(sequence);
  const afterFactory = buildCheckTail(sequence);
  const raw = `VN39${productCode}${modelCode}${beforeVendor}${vendor.vendor_char}${ledCode.code_input}${profile.factory_code}${afterFactory}`;
  const duplicateKey = `${beforeVendor}${vendor.vendor_char}${afterFactory}`;

  if (raw.length !== profile.full_code_length) {
    throw new Error(`Generated full code length ${raw.length} is not ${profile.full_code_length}: ${raw}`);
  }

  return {
    raw,
    prefix: "VN39",
    chassisSegment: `${productCode}${modelCode}`,
    beforeVendor,
    vendorChar: vendor.vendor_char,
    afterFactory,
    duplicateKey
  };
}

function buildLedScanRaw(vendor, ledCode, sequence, profile) {
  const lotNo = String(sequence).padStart(profile.led_vendor_position - 1, "0");
  const raw = `${lotNo}${vendor.vendor_char}${ledCode.suffix_check}X`;

  if (raw.length !== profile.led_scan_length) {
    throw new Error(`Generated LED scan length ${raw.length} is not ${profile.led_scan_length}: ${raw}`);
  }

  return {
    raw,
    lotNo
  };
}

async function seedSettings() {
  const settings = await prisma.serverSetting.findFirst({ orderBy: { id: "asc" } });
  if (settings) {
    await prisma.serverSetting.update({ where: { id: settings.id }, data: SETTINGS });
  } else {
    await prisma.serverSetting.create({ data: SETTINGS });
  }
}

async function seedMachine() {
  const licenseKey = process.env.SEED_MACHINE_LICENSE_KEY || `${SAMPLE_MACHINE.serial}|${SAMPLE_MACHINE.uid}`;

  return prisma.machine.upsert({
    where: { machine_code: SAMPLE_MACHINE.machine_code },
    create: {
      ...SAMPLE_MACHINE,
      license_key_raw: licenseKey,
      license_activated_at: new Date(),
      is_active: true
    },
    update: {
      machine_name: SAMPLE_MACHINE.machine_name,
      serial: SAMPLE_MACHINE.serial,
      uid: SAMPLE_MACHINE.uid,
      license_key_raw: licenseKey,
      license_activated_at: new Date(),
      line_name: SAMPLE_MACHINE.line_name,
      station_name: SAMPLE_MACHINE.station_name,
      is_active: true
    }
  });
}

async function seedReferenceData() {
  const vendors = [];
  for (const item of SAMPLE_VENDORS) {
    const vendor = await prisma.vendor.upsert({
      where: { vendor_char: item.vendor_char },
      create: {
        vendor_name: item.vendor_name,
        vendor_char: item.vendor_char,
        status: "ACTIVE"
      },
      update: {
        vendor_name: item.vendor_name,
        status: "ACTIVE"
      }
    });
    vendors.push(vendor);
  }

  const chassisByFullCode = new Map();
  for (const item of SAMPLE_CHASSIS_CODES) {
    const chassis = await prisma.chassisCode.upsert({
      where: { code_full: item.code_full },
      create: { ...item, is_active: true },
      update: { code_input: item.code_input, is_active: true }
    });
    chassisByFullCode.set(chassis.code_full, chassis);
  }

  const ledByFullCode = new Map();
  for (const item of SAMPLE_LED_CODES) {
    const led = await prisma.ledCode.upsert({
      where: { code_full: item.code_full },
      create: { ...item, is_active: true },
      update: {
        code_input: item.code_input,
        suffix_check: item.suffix_check,
        is_active: true
      }
    });
    ledByFullCode.set(led.code_full, led);
  }

  return { vendors, chassisByFullCode, ledByFullCode };
}

async function seedProfiles({ chassisByFullCode, ledByFullCode }) {
  const profiles = [];

  for (const [chassisFullCode, ledFullCodes] of PROFILE_LED_PLAN) {
    const chassis = chassisByFullCode.get(chassisFullCode);
    if (!chassis) {
      throw new Error(`Missing sample chassis ${chassisFullCode}`);
    }

    const profile = await prisma.productProfile.upsert({
      where: { chassis_code_id: chassis.id },
      create: {
        chassis_code_id: chassis.id,
        factory_code: SETTINGS.factory_code_default,
        full_code_length: SETTINGS.full_code_length_default,
        full_vendor_position: SETTINGS.full_vendor_position_default,
        led_scan_length: SETTINGS.led_scan_length_default,
        led_vendor_position: SETTINGS.led_vendor_position_default,
        version: 1,
        is_active: true
      },
      update: {
        factory_code: SETTINGS.factory_code_default,
        full_code_length: SETTINGS.full_code_length_default,
        full_vendor_position: SETTINGS.full_vendor_position_default,
        led_scan_length: SETTINGS.led_scan_length_default,
        led_vendor_position: SETTINGS.led_vendor_position_default,
        is_active: true
      }
    });

    await prisma.profileLedCode.deleteMany({ where: { profile_id: profile.id } });

    for (const [slotIndex, ledFullCode] of ledFullCodes.entries()) {
      const ledCode = ledByFullCode.get(ledFullCode);
      if (!ledCode) {
        throw new Error(`Missing sample LED ${ledFullCode}`);
      }

      await prisma.profileLedCode.create({
        data: {
          profile_id: profile.id,
          led_code_id: ledCode.id,
          led_slot: slotIndex + 1,
          is_required: true
        }
      });
    }

    const loadedProfile = await prisma.productProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: {
        chassis_code: true,
        profile_led_codes: {
          include: { led_code: true },
          orderBy: { led_slot: "asc" }
        }
      }
    });

    const snapshotJson = compactProfile(loadedProfile);
    const snapshot = await prisma.profileSnapshot.findFirst({
      where: {
        profile_id: loadedProfile.id,
        version: loadedProfile.version
      },
      orderBy: { id: "asc" }
    });

    const savedSnapshot = snapshot
      ? await prisma.profileSnapshot.update({
          where: { id: snapshot.id },
          data: { snapshot_json: snapshotJson }
        })
      : await prisma.profileSnapshot.create({
          data: {
            profile_id: loadedProfile.id,
            version: loadedProfile.version,
            snapshot_json: snapshotJson
          }
        });

    profiles.push({
      ...loadedProfile,
      profile_snapshot_id: savedSnapshot.id
    });
  }

  return profiles;
}

async function seedDuplicateRecords(machine, profiles, vendors) {
  const duplicateDays = SETTINGS.duplicate_days;
  const expiresAt = new Date(Date.now() + duplicateDays * 24 * 60 * 60 * 1000);
  const sampleFullCodes = [];

  for (let index = 1; index <= DUPLICATE_RECORD_COUNT; index += 1) {
    const profile = profiles[(index - 1) % profiles.length];
    const vendor = vendors[(index - 1) % vendors.length];
    const profileLedCodes = profile.profile_led_codes;
    const primaryLedCode = profileLedCodes[0].led_code;
    const fullCode = buildFullCode(profile, primaryLedCode, vendor, index);
    const localScanId = `${LOCAL_SCAN_ID_PREFIX}-${String(index).padStart(6, "0")}`;
    const scanAt = new Date(Date.now() - (DUPLICATE_RECORD_COUNT - index) * 1000);

    const existingScan = await prisma.scanRecord.findUnique({
      where: {
        machine_id_local_scan_id: {
          machine_id: machine.id,
          local_scan_id: localScanId
        }
      }
    });

    const scan =
      existingScan ||
      (await prisma.scanRecord.create({
        data: {
          local_scan_id: localScanId,
          machine_id: machine.id,
          profile_id: profile.id,
          profile_snapshot_id: profile.profile_snapshot_id,
          full_code_raw: fullCode.raw,
          full_prefix: fullCode.prefix,
          full_chassis_segment: fullCode.chassisSegment,
          full_chassis_code: profile.chassis_code.code_full,
          full_before_vendor: fullCode.beforeVendor,
          full_vendor_char: fullCode.vendorChar,
          full_led_code: primaryLedCode.code_full,
          full_factory_code: profile.factory_code,
          full_after_factory: fullCode.afterFactory,
          duplicate_key: fullCode.duplicateKey,
          chassis_scan_raw: profile.chassis_code.code_full,
          local_status: "OK",
          server_status: "OK",
          final_status: "OK",
          scan_at: scanAt,
          led_items: {
            create: profileLedCodes.map((profileLedCode, ledIndex) => {
              const ledScan = buildLedScanRaw(vendor, profileLedCode.led_code, index + ledIndex, profile);
              return {
                led_slot: profileLedCode.led_slot,
                led_index: ledIndex + 1,
                led_scan_raw: ledScan.raw,
                led_lot_no: ledScan.lotNo,
                vendor_char: vendor.vendor_char,
                led_suffix: profileLedCode.led_code.suffix_check,
                local_status: "OK"
              };
            })
          }
        }
      }));

    await prisma.recentDuplicateKey.upsert({
      where: {
        profile_id_duplicate_key: {
          profile_id: profile.id,
          duplicate_key: fullCode.duplicateKey
        }
      },
      create: {
        profile_id: profile.id,
        duplicate_key: fullCode.duplicateKey,
        first_scan_record_id: scan.id,
        first_machine_id: machine.id,
        first_scan_at: scan.scan_at,
        expires_at: expiresAt
      },
      update: {
        first_scan_record_id: scan.id,
        first_machine_id: machine.id,
        first_scan_at: scan.scan_at,
        expires_at: expiresAt
      }
    });

    if (sampleFullCodes.length < 5) {
      sampleFullCodes.push({ raw: fullCode.raw, duplicateKey: fullCode.duplicateKey });
    }

    if (index % 100 === 0) {
      console.log(`Seeded duplicate records: ${index}/${DUPLICATE_RECORD_COUNT}`);
    }
  }

  return sampleFullCodes;
}

try {
  console.log("Seeding sample test data...");

  await seedSettings();
  const machine = await seedMachine();
  const referenceData = await seedReferenceData();
  const profiles = await seedProfiles(referenceData);
  const sampleFullCodes = await seedDuplicateRecords(machine, profiles, referenceData.vendors);

  console.log("Sample seed completed.");
  console.log(`Machine: ${machine.machine_code}`);
  console.log(`Vendors: ${referenceData.vendors.map((vendor) => `${vendor.vendor_name}(${vendor.vendor_char})`).join(", ")}`);
  console.log(`Profiles: ${profiles.map((profile) => profile.chassis_code.code_full).join(", ")}`);
  console.log(`Chassis codes: ${SAMPLE_CHASSIS_CODES.length}`);
  console.log(`LED codes: ${SAMPLE_LED_CODES.length}`);
  console.log(`Duplicate-ready codes: ${DUPLICATE_RECORD_COUNT}`);
  console.log("Sample duplicate full codes:");
  for (const code of sampleFullCodes) {
    console.log(`- ${code.raw} => ${code.duplicateKey}`);
  }
} finally {
  await prisma.$disconnect();
}
