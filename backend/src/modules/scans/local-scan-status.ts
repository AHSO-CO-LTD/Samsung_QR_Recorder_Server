export const LOCAL_SCAN_STATUSES = ["OK", "NG", "REWORK"] as const;

export type LocalSubmitScanStatus = (typeof LOCAL_SCAN_STATUSES)[number];

export function requiresCompleteScanPayload(status: LocalSubmitScanStatus) {
  return status === "OK" || status === "REWORK";
}
