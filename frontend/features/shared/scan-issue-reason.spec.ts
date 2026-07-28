import assert from "node:assert/strict";
import test from "node:test";
import { formatIssueReason, formatLedIssueReason, resolveScanIssueReason } from "./scan-issue-reason";

test("shows a QR scan error for legacy SCAN_FAILED records that contain LED data", () => {
  const scan = {
    full_code_raw: "ERROR",
    led_items: [{ led_scan_raw: "ERROR" }, { led_scan_raw: "ZB36L582465U528LD0376A" }]
  };

  assert.equal(resolveScanIssueReason("SCAN_FAILED", scan), "QR_SCAN_FAILED");
  assert.equal(formatIssueReason("SCAN_FAILED", "vi", scan), "Lỗi scan QR");
});

test("shows an LED scan error when the QR exists and LED data is missing", () => {
  assert.equal(
    formatIssueReason("SCAN_FAIL", "vi", {
      full_code_raw: "VN39BN9612345A1A1L60376ADZLVY420601",
      led_items: [{ led_scan_raw: "ERROR" }]
    }),
    "Lỗi scan LED"
  );
});

test("shows a combined error when both QR and LED data are missing", () => {
  assert.equal(
    formatIssueReason("SCAN_FAILED", "vi", {
      full_code_raw: "ERROR",
      led_items: []
    }),
    "Lỗi scan QR và LED"
  );
});

test("treats a generic failure attached to an LED detail as an LED scan error", () => {
  assert.equal(formatLedIssueReason("SCAN_FAILED", "vi"), "Lỗi scan LED");
});

test("uses a short generic label when the failed scan cannot be identified", () => {
  assert.equal(formatIssueReason("SCAN_FAILED", "vi"), "Lỗi scan");
});

test("does not mistake the LED letters at the end of FAILED for an LED token", () => {
  assert.equal(formatIssueReason("BATCH_SCAN_FAILED", "vi"), "Lỗi scan");
});
