import { formatAppTime } from "@/lib/app-time";
import type { Machine, MachineRuntimeSession, ScanRecord } from "@/features/shared/types";
import type { RuntimeResultCounts, ScanTrendPoint } from "@/features/shared/machine-runtime-card";

const virtualStatuses: MachineRuntimeSession["status"][] = [
  "RUNNING",
  "RUNNING",
  "RUNNING",
  "PAUSED",
  "STOPPED",
  "DISCONNECTED",
  "ERROR"
];
const ngReasons = ["LED_SUFFIX_NOT_MATCH", "LOCAL_NG", "PAYLOAD_INVALID"];
const productPrefixes = ["BN96", "BN94", "GH82", "AH59"];

export type VirtualMachineRuntime = {
  machine: Machine;
  session: MachineRuntimeSession;
  trendData: ScanTrendPoint[];
};

export function createVirtualMachineRuntime(sequence: number, nowMs = Date.now()): VirtualMachineRuntime {
  const safeSequence = Math.max(1, Math.floor(sequence));
  const machineId = -(nowMs * 100 + safeSequence);
  const status = pick(virtualStatuses);
  const total = randomRuntimeTotal();
  const ng = total === 0 ? 0 : randomInt(0, Math.max(1, Math.floor(total * randomBetween(0.01, 0.08))));
  const ok = total - ng;
  const startedAtMs = nowMs - randomInt(5 * 60_000, 72 * 60 * 60_000);
  const lastSeenAtMs = status === "DISCONNECTED" ? nowMs - randomInt(2 * 60_000, 20 * 60_000) : nowMs - randomInt(0, 30_000);
  const lastResultAtMs =
    status === "PAUSED"
      ? nowMs - randomInt(5 * 60_000, 45 * 60_000)
      : Math.min(lastSeenAtMs, nowMs - randomInt(1_000, 90_000));
  const endedAtMs = status === "STOPPED" ? lastSeenAtMs : null;
  const productCode = `${pick(productPrefixes)}-${randomInt(10000, 99999)}${randomLetter()}`;
  const lastResult = ng > 0 && Math.random() < 0.2 ? "NG" : "OK";
  const lastCode = randomQrCode();
  const machineCode = `VIRTUAL-${nowMs.toString(36).toUpperCase()}-${safeSequence.toString(36).toUpperCase()}`;
  const machineName = `Máyảo${String(safeSequence).padStart(2, "0")}`;
  const lineName = `LINE-${randomLetter()}`;
  const scanRecords = buildVirtualScanRecords({
    machineId,
    machineCode,
    productCode,
    startedAtMs,
    lastResultAtMs,
    lastCode,
    lastResult,
    ng
  });
  const latestScanRecord = scanRecords.at(-1) ?? null;
  const nowIso = new Date(nowMs).toISOString();
  const startedAt = new Date(startedAtMs).toISOString();
  const lastSeenAt = new Date(lastSeenAtMs).toISOString();
  const lastResultAt = new Date(lastResultAtMs).toISOString();
  const endedAt = endedAtMs ? new Date(endedAtMs).toISOString() : null;

  const machine: Machine = {
    id: machineId,
    machine_code: machineCode,
    machine_name: machineName,
    line_name: lineName,
    station_name: `ST-${randomInt(1, 12)}`,
    ip_address: `192.168.${randomInt(1, 20)}.${randomInt(2, 254)}`,
    is_active: true,
    is_virtual: true,
    created_at: startedAt,
    updated_at: nowIso,
    _count: {
      scan_records: total
    },
    sync_state: {
      connection_status: status === "DISCONNECTED" ? "OFFLINE" : "ONLINE",
      last_seen_at: lastSeenAt,
      last_ip_address: `192.168.${randomInt(1, 20)}.${randomInt(2, 254)}`,
      local_total_record: total,
      local_ok_record: ok,
      local_ng_record: ng,
      local_pending_sync: randomInt(0, 25),
      app_version: `1.${randomInt(0, 9)}.${randomInt(0, 20)}`,
      local_db_version: String(randomInt(1, 8))
    }
  };

  const currentProductId = machineId - 1;
  const session: MachineRuntimeSession = {
    id: machineId,
    session_code: `VSESSION-${nowMs.toString(36).toUpperCase()}-${safeSequence.toString(36).toUpperCase()}`,
    machine_id: machineId,
    machine_code: machineCode,
    status,
    source: "WEBSOCKET",
    current_product_id: currentProductId,
    total_count: total,
    ok_count: ok,
    ng_count: ng,
    last_result: lastResult,
    last_code: lastCode,
    last_local_scan_id: latestScanRecord?.local_scan_id ?? null,
    last_result_at: lastResultAt,
    reconnect_count: randomInt(0, 5),
    started_at: startedAt,
    ended_at: endedAt,
    disconnected_at: status === "DISCONNECTED" ? lastSeenAt : null,
    last_seen_at: lastSeenAt,
    created_at: startedAt,
    updated_at: nowIso,
    machine,
    current_product: {
      id: currentProductId,
      session_id: machineId,
      machine_id: machineId,
      machine_code: machineCode,
      product_code: productCode,
      total_count: total,
      ok_count: ok,
      ng_count: ng,
      last_result: lastResult,
      last_code: lastCode,
      last_local_scan_id: latestScanRecord?.local_scan_id ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      created_at: startedAt,
      updated_at: nowIso
    },
    scan_records: scanRecords,
    latest_scan_record: latestScanRecord
  };

  return {
    machine,
    session,
    trendData: buildVirtualTrendData(ok, ng, nowMs)
  };
}

export function getVirtualRuntimeCounts(session: MachineRuntimeSession): RuntimeResultCounts {
  return {
    ok: session.ok_count,
    ng: session.ng_count,
    rework: Math.max(0, session.total_count - session.ok_count - session.ng_count),
    total: session.total_count
  };
}

function buildVirtualTrendData(ok: number, ng: number, nowMs: number): ScanTrendPoint[] {
  const bucketCount = 25;
  const okBuckets = distributeCount(ok, bucketCount);
  const ngBuckets = distributeCount(ng, bucketCount);

  return Array.from({ length: bucketCount }, (_, index) => {
    const timestamp = nowMs - (bucketCount - index - 1) * 30 * 60_000;
    const bucketOk = okBuckets[index] ?? 0;
    const bucketNg = ngBuckets[index] ?? 0;
    return {
      date: formatAppTime(timestamp, "en"),
      ok: bucketOk,
      ng: bucketNg,
      rework: 0,
      pending: 0,
      total: bucketOk + bucketNg,
      timestamp
    };
  });
}

function buildVirtualScanRecords(input: {
  machineId: number;
  machineCode: string;
  productCode: string;
  startedAtMs: number;
  lastResultAtMs: number;
  lastCode: string;
  lastResult: string;
  ng: number;
}): ScanRecord[] {
  const recordCount = randomInt(8, 28);
  const durationMs = Math.max(1, input.lastResultAtMs - input.startedAtMs);

  return Array.from({ length: recordCount }, (_, index) => {
    const isLatest = index === recordCount - 1;
    const isNg = isLatest ? input.lastResult === "NG" : input.ng > 0 && Math.random() < 0.18;
    const scanAtMs = isLatest
      ? input.lastResultAtMs
      : input.startedAtMs + Math.floor((durationMs * (index + 1)) / recordCount);
    const code = isLatest ? input.lastCode : randomQrCode();

    return {
      id: input.machineId - index - 1,
      local_scan_id: `VSCAN-${Math.abs(input.machineId)}-${index + 1}`,
      full_code_raw: code,
      full_chassis_code: input.productCode,
      full_vendor_char: randomLetter(),
      duplicate_key: code.slice(0, 20),
      local_status: isNg ? "NG" : "OK",
      server_status: isNg ? "NG" : "OK",
      final_status: isNg ? "NG" : "OK",
      ng_reason: isNg ? pick(ngReasons) : null,
      scan_at: new Date(scanAtMs).toISOString()
    };
  });
}

function distributeCount(total: number, bucketCount: number) {
  if (total <= 0) {
    return Array.from({ length: bucketCount }, () => 0);
  }

  const weights = Array.from({ length: bucketCount }, () => randomBetween(0.25, 1.75));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const values = weights.map((weight) => Math.floor((total * weight) / weightTotal));
  const assigned = values.reduce((sum, value) => sum + value, 0);
  values[values.length - 1] += total - assigned;
  return values;
}

function randomRuntimeTotal() {
  const upperBound = pick([900, 12_000, 250_000, 2_500_000]);
  return randomInt(Math.min(25, upperBound), upperBound);
}

function randomQrCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  return Array.from({ length: 35 }, () => alphabet[randomInt(0, alphabet.length - 1)]).join("");
}

function randomLetter() {
  return String.fromCharCode(65 + randomInt(0, 25));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}

function pick<T>(values: readonly T[]) {
  return values[randomInt(0, values.length - 1)];
}
