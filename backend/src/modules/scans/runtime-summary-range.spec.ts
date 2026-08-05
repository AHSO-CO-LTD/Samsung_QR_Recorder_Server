import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeSummaryRange } from "./runtime-summary-range";

const now = new Date("2026-07-28T03:30:00.000Z");

test("uses midnight in the app GMT+7 timezone for today's result range", () => {
  const range = resolveRuntimeSummaryRange("today", undefined, now);

  assert.equal(range.start?.toISOString(), "2026-07-27T17:00:00.000Z");
  assert.equal(range.end?.toISOString(), now.toISOString());
});

test("uses an exact rolling twelve-hour result range", () => {
  const range = resolveRuntimeSummaryRange("last_12_hours", undefined, now);

  assert.equal(range.start?.toISOString(), "2026-07-27T15:30:00.000Z");
  assert.equal(range.end?.toISOString(), now.toISOString());
});

test("converts a selected app date from GMT+7 midnight and rejects invalid dates", () => {
  const range = resolveRuntimeSummaryRange("since", "2026-07-20", now);

  assert.equal(range.start?.toISOString(), "2026-07-19T17:00:00.000Z");
  assert.throws(() => resolveRuntimeSummaryRange("since", "2026-02-30", now), /không hợp lệ/);
});

test("does not add a database time filter for all results", () => {
  assert.deepEqual(resolveRuntimeSummaryRange("all", undefined, now), {});
});
