import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocalNgReason, resolveStoredScanNgReason } from "./scan-failure-reason";

test("classifies SCAN_FAILED as QR failure when LED data exists but the full QR is missing", () => {
  assert.equal(
    resolveLocalNgReason({
      local_ng_reason: "SCAN_FAILED",
      full_code: { raw: "ERROR" },
      led_scans: [{ raw: "ERROR" }, { raw: "ZB36L582465U528LD0376A" }]
    }),
    "QR_SCAN_FAILED"
  );
});

test("classifies SCAN_FAIL as LED failure when the full QR exists but LED data is missing", () => {
  assert.equal(
    resolveLocalNgReason({
      local_ng_reason: "SCAN_FAIL",
      full_code: { raw: "VN39BN9612345A1A1L60376ADZLVY420601" },
      led_scans: [{ raw: "ERROR" }]
    }),
    "LED_SCAN_FAILED"
  );
});

test("classifies a generic scan failure as both QR and LED when neither scan exists", () => {
  assert.equal(
    resolveLocalNgReason({
      local_ng_reason: "SCAN_FAILED",
      full_code: { raw: "ERROR" },
      led_scans: []
    }),
    "QR_LED_SCAN_FAILED"
  );
});

test("keeps the generic reason when both QR and LED data exist", () => {
  assert.equal(
    resolveLocalNgReason({
      local_ng_reason: "SCAN_FAILED",
      full_code: { raw: "VN39BN9612345A1A1L60376ADZLVY420601" },
      led_scans: [{ raw: "ZB36L582465U528LD0376A" }]
    }),
    "SCAN_FAILED"
  );
});

test("does not rewrite a specific local NG reason", () => {
  assert.equal(
    resolveLocalNgReason({
      local_ng_reason: "LED_SUFFIX_NOT_MATCH",
      full_code: { raw: "ERROR" },
      led_scans: []
    }),
    "LED_SUFFIX_NOT_MATCH"
  );
});

test("classifies legacy stored records with the same rules", () => {
  assert.equal(
    resolveStoredScanNgReason({
      ng_reason: "SCAN_FAILED",
      full_code_raw: "ERROR",
      led_items: [{ led_scan_raw: "ERROR" }, { led_scan_raw: "ZB36L582465U528LD0376A" }]
    }),
    "QR_SCAN_FAILED"
  );
});
