import assert from "node:assert/strict";
import test from "node:test";
import { resolveScanTrendRange } from "./scan-trend-range";

const now = new Date("2026-07-28T03:30:00.000Z");

test("uses app midnight and thirty-minute buckets for today's trend", () => {
  const range = resolveScanTrendRange("today", undefined, now);

  assert.equal(range.start?.toISOString(), "2026-07-27T17:00:00.000Z");
  assert.equal(range.end.toISOString(), now.toISOString());
  assert.equal(range.bucket, "30_minutes");
});

test("uses rolling twelve-hour and app-calendar day ranges", () => {
  assert.equal(resolveScanTrendRange("last_12_hours", undefined, now).start?.toISOString(), "2026-07-27T15:30:00.000Z");
  assert.equal(resolveScanTrendRange("last_7_days", undefined, now).start?.toISOString(), "2026-07-21T17:00:00.000Z");
  assert.equal(resolveScanTrendRange("last_30_days", undefined, now).start?.toISOString(), "2026-06-28T17:00:00.000Z");
  const yearRange = resolveScanTrendRange("last_1_year", undefined, now);
  assert.equal(yearRange.start?.toISOString(), "2025-07-28T17:00:00.000Z");
  assert.equal(yearRange.end.toISOString(), now.toISOString());
  assert.equal(yearRange.bucket, "month");
});

test("converts a selected date from app GMT+7 midnight", () => {
  const range = resolveScanTrendRange("since", "2026-07-20", now);

  assert.equal(range.start?.toISOString(), "2026-07-19T17:00:00.000Z");
  assert.equal(range.bucket, "day");
});

test("leaves the all-time start open for the database minimum", () => {
  assert.equal(resolveScanTrendRange("all", undefined, now).start, undefined);
});
