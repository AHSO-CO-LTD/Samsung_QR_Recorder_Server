import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_SCAN_STATUSES, requiresCompleteScanPayload } from "./local-scan-status";

test("supports REWORK as a local scan result", () => {
  assert.deepEqual(LOCAL_SCAN_STATUSES, ["OK", "NG", "REWORK"]);
});

test("requires complete code data for OK and REWORK", () => {
  assert.equal(requiresCompleteScanPayload("OK"), true);
  assert.equal(requiresCompleteScanPayload("NG"), false);
  assert.equal(requiresCompleteScanPayload("REWORK"), true);
});
