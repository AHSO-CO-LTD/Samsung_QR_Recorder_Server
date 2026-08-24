import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const REWORK_REASONS = ["LED_SUFFIX_NOT_MATCH", "FULL_CODE_NOT_MATCH", "SCAN_LED_FAILED"];
const RECORDS_PER_REASON = 3;
const SOURCE_LOCAL_ID_PREFIX = "DEMO-NG";
const LEGACY_REWORK_LOCAL_ID_PREFIX = "DEMO-REWORK";

function createScanData({ machine, profile, token, localScanId, localStatus, serverStatus, finalStatus, reason, scanAt }) {
  return {
    local_scan_id: localScanId,
    machine_id: machine.id,
    profile_id: profile.id,
    profile_snapshot_id: profile.profile_snapshots[0]?.id ?? null,
    full_code_raw: `DEMO-${localStatus}-${token}`,
    full_prefix: "DEMO",
    full_chassis_segment: profile.chassis_code.code_input,
    full_chassis_code: profile.chassis_code.code_full,
    full_before_vendor: `${localStatus === "REWORK" ? "RW" : "NG"}${token}`,
    full_vendor_char: "D",
    full_led_code: "DEMO-LED",
    full_factory_code: profile.factory_code,
    full_after_factory: `${localStatus}${token}`,
    duplicate_key: `DEMO-${localStatus === "REWORK" ? "RW" : "NG"}-${token}`,
    chassis_scan_raw: profile.chassis_code.code_full,
    local_status: localStatus,
    server_status: serverStatus,
    final_status: finalStatus,
    ng_stage: "LOCAL",
    ng_reason: reason,
    scan_at: scanAt
  };
}

function createLedItem(token, localStatus, reason) {
  return {
    led_slot: 1,
    led_index: 1,
    led_scan_raw: `DEMO-LED-${token}`,
    led_lot_no: `DEMO${token}`,
    vendor_char: "D",
    led_suffix: "DEMO",
    local_status: localStatus,
    ng_reason: reason
  };
}

async function upsertSeedScan(tx, data, ledItem) {
  return tx.scanRecord.upsert({
    where: {
      machine_id_local_scan_id: {
        machine_id: data.machine_id,
        local_scan_id: data.local_scan_id
      }
    },
    create: {
      ...data,
      led_items: { create: ledItem }
    },
    update: {
      ...data,
      led_items: {
        deleteMany: {},
        create: ledItem
      }
    }
  });
}

try {
  const [machines, profiles, legacyReworkRecords] = await Promise.all([
    prisma.machine.findMany({ where: { is_active: true }, orderBy: { machine_code: "asc" } }),
    prisma.productProfile.findMany({
      where: { is_active: true },
      include: { chassis_code: true, profile_snapshots: { orderBy: { id: "desc" }, take: 1 } },
      orderBy: { id: "asc" }
    }),
    prisma.scanRecord.findMany({
      where: { local_scan_id: { startsWith: `${LEGACY_REWORK_LOCAL_ID_PREFIX}-` } },
      select: { id: true }
    })
  ]);

  if (machines.length === 0 || profiles.length === 0) {
    throw new Error("Can phai co it nhat mot may va mot ho so active truoc khi tao du lieu REWORK mau.");
  }

  if (legacyReworkRecords.length > 0) {
    const legacyIds = legacyReworkRecords.map((record) => record.id);
    await prisma.$transaction(async (tx) => {
      await tx.recentDuplicateKey.deleteMany({ where: { first_scan_record_id: { in: legacyIds } } });
      await tx.scanRecord.deleteMany({ where: { id: { in: legacyIds } } });
    });
  }

  let sourceCreated = 0;
  let reworkCreated = 0;
  let sequence = 0;
  for (const [reasonIndex, reason] of REWORK_REASONS.entries()) {
    for (let itemIndex = 0; itemIndex < RECORDS_PER_REASON; itemIndex += 1) {
      sequence += 1;
      const machine = machines[(reasonIndex + itemIndex) % machines.length];
      const profile = profiles[(reasonIndex + itemIndex) % profiles.length];
      const token = String(sequence).padStart(3, "0");
      const sourceLocalScanId = `${SOURCE_LOCAL_ID_PREFIX}-${token}`;
      const reworkLocalScanId = `RW-${sourceLocalScanId}`;
      const reworkScanAt = new Date(Date.now() - sequence * 60_000);
      const sourceScanAt = new Date(reworkScanAt.getTime() - 30_000);

      const result = await prisma.$transaction(async (tx) => {
        const sourceBefore = await tx.scanRecord.findUnique({
          where: { machine_id_local_scan_id: { machine_id: machine.id, local_scan_id: sourceLocalScanId } },
          select: { id: true }
        });
        const reworkBefore = await tx.scanRecord.findUnique({
          where: { machine_id_local_scan_id: { machine_id: machine.id, local_scan_id: reworkLocalScanId } },
          select: { id: true }
        });

        await upsertSeedScan(
          tx,
          createScanData({
            machine,
            profile,
            token,
            localScanId: sourceLocalScanId,
            localStatus: "NG",
            serverStatus: "SKIPPED",
            finalStatus: "NG_REWORK",
            reason,
            scanAt: sourceScanAt
          }),
          createLedItem(token, "NG", reason)
        );
        await upsertSeedScan(
          tx,
          createScanData({
            machine,
            profile,
            token,
            localScanId: reworkLocalScanId,
            localStatus: "REWORK",
            serverStatus: "OK",
            finalStatus: "REWORK",
            reason,
            scanAt: reworkScanAt
          }),
          createLedItem(token, "REWORK", reason)
        );

        return { sourceCreated: !sourceBefore, reworkCreated: !reworkBefore };
      });

      sourceCreated += Number(result.sourceCreated);
      reworkCreated += Number(result.reworkCreated);
    }
  }

  console.log(`REWORK demo data: NG sources created ${sourceCreated}, REWORK scans created ${reworkCreated}.`);
  console.log(`Removed legacy standalone REWORK scans: ${legacyReworkRecords.length}.`);
  console.log(`Reasons: ${REWORK_REASONS.join(", ")}.`);
} finally {
  await prisma.$disconnect();
}
