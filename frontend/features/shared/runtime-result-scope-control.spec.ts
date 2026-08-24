import assert from "node:assert/strict";
import test from "node:test";
import type { MachineRuntimeSession } from "./types";
import { indexRuntimeSummary, resolveSessionResultCounts } from "./runtime-result-counts";

test("excludes REWORK from indexed server result totals", () => {
  assert.deepEqual(
    indexRuntimeSummary([
      { machine_id: 7, machine_code: "M07", ok: 12, ng: 3, rework: 2, total: 17 }
    ]),
    { 7: { ok: 12, ng: 3, rework: 2, total: 15 } }
  );
});

test("keeps session NG visible while excluding REWORK from the total", () => {
  const session = { ok_count: 12, ng_count: 3, total_count: 17 } as MachineRuntimeSession;

  assert.deepEqual(resolveSessionResultCounts(session), {
    ok: 12,
    ng: 3,
    rework: 2,
    total: 15
  });
});
