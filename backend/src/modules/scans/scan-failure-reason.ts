const GENERIC_SCAN_FAILURE_REASONS = new Set(["SCAN_FAIL", "SCAN_FAILED"]);
const MISSING_SCAN_VALUES = new Set(["", "ERROR", "FAILED", "SCAN_FAIL", "SCAN_FAILED", "UNKNOWN", "NULL", "NONE", "N/A"]);

type ScanValue = string | null | undefined;

type LocalScanFailurePayload = {
  local_ng_reason?: ScanValue;
  full_code?: {
    raw?: ScanValue;
  };
  led_scans?: Array<{
    raw?: ScanValue;
  }>;
};

type StoredScanFailureRecord = {
  ng_reason?: ScanValue;
  full_code_raw?: ScanValue;
  led_items?: Array<{
    led_scan_raw?: ScanValue;
  }>;
};

export function resolveLocalNgReason(payload: LocalScanFailurePayload) {
  return resolveGenericScanFailureReason(payload.local_ng_reason, payload.full_code?.raw, payload.led_scans?.map((item) => item.raw));
}

export function resolveStoredScanNgReason(record: StoredScanFailureRecord) {
  return resolveGenericScanFailureReason(record.ng_reason, record.full_code_raw, record.led_items?.map((item) => item.led_scan_raw));
}

function resolveGenericScanFailureReason(reason: ScanValue, fullCodeRaw: ScanValue, ledScanValues: ScanValue[] | undefined) {
  const normalizedReason = normalizeReason(reason) ?? "LOCAL_NG";
  if (!GENERIC_SCAN_FAILURE_REASONS.has(normalizedReason)) {
    return normalizedReason;
  }

  const hasQrScan = hasUsableScanValue(fullCodeRaw);
  const hasLedScan = ledScanValues?.some(hasUsableScanValue) ?? false;

  if (!hasQrScan && hasLedScan) {
    return "QR_SCAN_FAILED";
  }
  if (hasQrScan && !hasLedScan) {
    return "LED_SCAN_FAILED";
  }
  if (!hasQrScan && !hasLedScan) {
    return "QR_LED_SCAN_FAILED";
  }

  return normalizedReason;
}

function hasUsableScanValue(value: ScanValue) {
  if (typeof value !== "string") {
    return false;
  }

  return !MISSING_SCAN_VALUES.has(value.trim().toUpperCase());
}

function normalizeReason(value: ScanValue) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}
