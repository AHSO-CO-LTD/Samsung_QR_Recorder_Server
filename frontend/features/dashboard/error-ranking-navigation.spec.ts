import assert from "node:assert/strict";
import test from "node:test";
import { buildErrorRankingScanHistoryHref } from "./error-ranking-navigation";

const now = new Date("2026-08-06T05:34:00.000Z");

test("builds scan history filters for the selected seven-day error ranking range", () => {
  const params = new URL(buildErrorRankingScanHistoryHref("LED_SUFFIX_NOT_MATCH", "last_7_days", now), "https://local.test").searchParams;

  assert.equal(params.get("final_status"), "NG");
  assert.equal(params.get("ng_reason"), "LED_SUFFIX_NOT_MATCH");
  assert.equal(params.get("from"), "2026-07-31T00:00");
  assert.equal(params.get("to"), "2026-08-06T12:34");
});

test("keeps the all-time ranking unbounded at the start", () => {
  const params = new URL(buildErrorRankingScanHistoryHref("SCAN_FAILED", "all", now), "https://local.test").searchParams;

  assert.equal(params.get("from"), null);
  assert.equal(params.get("to"), "2026-08-06T12:34");
});
