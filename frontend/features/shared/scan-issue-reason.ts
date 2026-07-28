import type { Locale } from "@/lib/i18n";

const GENERIC_SCAN_FAILURE_REASONS = new Set(["SCAN_FAIL", "SCAN_FAILED"]);
const MISSING_SCAN_VALUES = new Set(["", "ERROR", "FAILED", "SCAN_FAIL", "SCAN_FAILED", "UNKNOWN", "NULL", "NONE", "N/A"]);

export type ScanIssueContext = {
  full_code_raw?: string | null;
  led_items?: Array<{
    led_scan_raw?: string | null;
  }>;
};

export function resolveScanIssueReason(reason: string, scan?: ScanIssueContext | null) {
  const normalizedReason = reason.trim().toUpperCase();
  if (!GENERIC_SCAN_FAILURE_REASONS.has(normalizedReason) || !scan) {
    return normalizedReason;
  }

  const hasQrScan = hasUsableScanValue(scan.full_code_raw);
  const hasLedScan = scan.led_items?.some((item) => hasUsableScanValue(item.led_scan_raw)) ?? false;

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

export function formatIssueReason(reason: string, locale: Locale, scan?: ScanIssueContext | null) {
  const resolvedReason = resolveScanIssueReason(reason, scan);
  const category = getIssueReasonCategory(resolvedReason);
  const labels: Record<IssueReasonCategory, Record<Locale, string>> = {
    duplicate: {
      vi: "Lỗi scan trùng lặp",
      en: "Duplicate scan error"
    },
    led: {
      vi: "Lỗi scan LED",
      en: "LED scan error"
    },
    qr: {
      vi: "Lỗi scan QR",
      en: "QR scan error"
    },
    qrLed: {
      vi: "Lỗi scan QR và LED",
      en: "QR and LED scan error"
    },
    config: {
      vi: "Lỗi scan cấu hình",
      en: "Scan configuration error"
    },
    machine: {
      vi: "Lỗi scan máy",
      en: "Machine scan error"
    },
    connection: {
      vi: "Lỗi scan kết nối",
      en: "Scan connection error"
    },
    sync: {
      vi: "Lỗi scan đồng bộ",
      en: "Scan sync error"
    },
    data: {
      vi: "Lỗi dữ liệu scan",
      en: "Scan data error"
    },
    local: {
      vi: "Lỗi scan local",
      en: "Local scan error"
    },
    server: {
      vi: "Lỗi scan server",
      en: "Server scan error"
    },
    unknown: {
      vi: "Lỗi scan",
      en: "Scan error"
    }
  };

  return labels[category][locale];
}

export function formatLedIssueReason(reason: string, locale: Locale) {
  const normalizedReason = reason.trim().toUpperCase();
  return formatIssueReason(GENERIC_SCAN_FAILURE_REASONS.has(normalizedReason) ? "LED_SCAN_FAILED" : normalizedReason, locale);
}

function getIssueReasonCategory(reason: string): IssueReasonCategory {
  const exactCategoryByReason: Record<string, IssueReasonCategory> = {
    SERVER_DUPLICATE: "duplicate",
    LOCAL_DUPLICATE: "duplicate",
    LED_SUFFIX_NOT_MATCH: "led",
    LED_VENDOR_NOT_MATCH: "led",
    LED_CODE_NOT_FOUND: "led",
    LED_SCAN_FAILED: "led",
    FULL_LED_CODE_INVALID: "led",
    QR_SCAN_FAILED: "qr",
    FULL_CODE_INVALID: "qr",
    FULL_CODE_INVALID_LENGTH: "qr",
    FULL_VENDOR_NOT_MATCH: "qr",
    FULL_FACTORY_NOT_MATCH: "qr",
    CHASSIS_NOT_MATCH: "qr",
    QR_LED_SCAN_FAILED: "qrLed",
    PROFILE_NOT_FOUND: "config",
    PROFILE_VERSION_OUTDATED: "config",
    CHASSIS_CODE_NOT_FOUND: "config",
    PROFILE_LED_CODES_REQUIRED: "config",
    PROFILE_LED_CODES_LIMIT_EXCEEDED: "config",
    PROFILE_LED_SLOT_INVALID: "config",
    PROFILE_LED_CODE_DUPLICATED: "config",
    PROFILE_LED_SLOT_DUPLICATED: "config",
    MACHINE_NOT_FOUND: "machine",
    SERVER_DISCONNECTED: "connection",
    SYNC_BATCH_HAS_NG: "sync",
    PAYLOAD_INVALID: "data",
    LOCAL_NG: "local",
    SCAN_FAIL: "unknown",
    SCAN_FAILED: "unknown"
  };

  if (exactCategoryByReason[reason]) {
    return exactCategoryByReason[reason];
  }
  if (reason.includes("DUPLICATE") || reason.includes("TRUNG")) {
    return "duplicate";
  }
  if (hasReasonToken(reason, "QR") && hasReasonToken(reason, "LED")) {
    return "qrLed";
  }
  if (hasReasonToken(reason, "LED")) {
    return "led";
  }
  if (hasReasonToken(reason, "QR") || hasReasonToken(reason, "FULL") || hasReasonToken(reason, "CHASSIS") || hasReasonToken(reason, "CODE")) {
    return "qr";
  }
  if (reason.includes("PROFILE") || reason.includes("CONFIG") || reason.includes("SETTING")) {
    return "config";
  }
  if (reason.includes("MACHINE")) {
    return "machine";
  }
  if (reason.includes("DISCONNECT") || reason.includes("OFFLINE") || reason.includes("TIMEOUT")) {
    return "connection";
  }
  if (reason.includes("SYNC")) {
    return "sync";
  }
  if (reason.includes("PAYLOAD") || reason.includes("DATA")) {
    return "data";
  }
  if (reason.includes("LOCAL")) {
    return "local";
  }
  if (reason.includes("SERVER")) {
    return "server";
  }
  return "unknown";
}

function hasUsableScanValue(value?: string | null) {
  return typeof value === "string" && !MISSING_SCAN_VALUES.has(value.trim().toUpperCase());
}

function hasReasonToken(reason: string, token: string) {
  return reason.split(/[^A-Z0-9]+/).includes(token);
}

type IssueReasonCategory = "duplicate" | "led" | "qr" | "qrLed" | "config" | "machine" | "connection" | "sync" | "data" | "local" | "server" | "unknown";
