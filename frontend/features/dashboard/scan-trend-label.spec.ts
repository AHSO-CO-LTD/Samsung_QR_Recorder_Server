import assert from "node:assert/strict";
import test from "node:test";
import { formatTrendDateLabel } from "./scan-trend-label";

test("formats monthly trend labels by interface language", () => {
  assert.equal(formatTrendDateLabel("2026-01", "vi"), "T1");
  assert.equal(formatTrendDateLabel("2026-12", "vi"), "T12");
  assert.equal(formatTrendDateLabel("2026-08", "en"), "Aug");
  assert.equal(formatTrendDateLabel("2026-10", "en"), "Oct");
});

test("keeps day and intraday labels unchanged from the current behavior", () => {
  assert.equal(formatTrendDateLabel("2026-08-03", "vi"), "03/08/2026");
  assert.equal(formatTrendDateLabel("14:30", "en"), "14:30");
});
