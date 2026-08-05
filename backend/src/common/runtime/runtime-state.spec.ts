import assert from "node:assert/strict";
import test from "node:test";
import { hasNewRuntimeResult, isRuntimePauseDue, RUNTIME_PAUSE_TIMEOUT_MS } from "./runtime-state";

test("marks a connected running session paused after five minutes without results", () => {
  const startedAt = new Date("2026-07-28T00:00:00.000Z");

  assert.equal(
    isRuntimePauseDue({
      status: "RUNNING",
      startedAt,
      connectionAlive: true,
      now: new Date(startedAt.getTime() + RUNTIME_PAUSE_TIMEOUT_MS)
    }),
    true
  );
});

test("does not pause before five minutes or while the connection is unavailable", () => {
  const startedAt = new Date("2026-07-28T00:00:00.000Z");

  assert.equal(
    isRuntimePauseDue({
      status: "RUNNING",
      startedAt,
      connectionAlive: true,
      now: new Date(startedAt.getTime() + RUNTIME_PAUSE_TIMEOUT_MS - 1)
    }),
    false
  );
  assert.equal(
    isRuntimePauseDue({
      status: "RUNNING",
      startedAt,
      connectionAlive: false,
      now: new Date(startedAt.getTime() + RUNTIME_PAUSE_TIMEOUT_MS)
    }),
    false
  );
});

test("uses the latest result time instead of the session start time", () => {
  const startedAt = new Date("2026-07-28T00:00:00.000Z");
  const lastResultAt = new Date("2026-07-28T00:04:00.000Z");

  assert.equal(
    isRuntimePauseDue({
      status: "RUNNING",
      startedAt,
      lastResultAt,
      connectionAlive: true,
      now: new Date("2026-07-28T00:08:59.999Z")
    }),
    false
  );
});

test("detects new runtime results from counters or scan identity", () => {
  const previous = {
    total_count: 10,
    ok_count: 8,
    ng_count: 2,
    last_code: "CODE-10",
    last_local_scan_id: "SCAN-10"
  };

  assert.equal(hasNewRuntimeResult(previous, { total_count: 10, ok_count: 8, ng_count: 2 }), false);
  assert.equal(hasNewRuntimeResult(previous, { total_count: 11, ok_count: 9, ng_count: 2 }), true);
  assert.equal(hasNewRuntimeResult(previous, { local_scan_id: "SCAN-11" }), true);
});
