import assert from "node:assert/strict";
import test from "node:test";
import { resolveLogicalResultCounts } from "./logical-result-counts";

test("keeps total NG visible while excluding REWORK from the overall total", () => {
  assert.deepEqual(resolveLogicalResultCounts({ ok: 12, ng: 3, rework: 2 }), {
    ok: 12,
    ng: 3,
    rework: 2,
    total: 15
  });
});

test("does not change visible NG when rework exceeds the NG count", () => {
  assert.deepEqual(resolveLogicalResultCounts({ ok: 4, ng: 1, rework: 3 }), {
    ok: 4,
    ng: 1,
    rework: 3,
    total: 5
  });
});
