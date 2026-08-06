import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildNgReasonWhere } from "./scan-query-filter";

test("returns no NG reason condition for an empty code", () => {
  assert.equal(buildNgReasonWhere("  "), undefined);
});

test("matches an NG reason only on the scan record", () => {
  const reasonFilter = {
    equals: "LED_SUFFIX_NOT_MATCH",
    mode: Prisma.QueryMode.insensitive
  };

  assert.deepEqual(buildNgReasonWhere(" LED_SUFFIX_NOT_MATCH "), { ng_reason: reasonFilter });
});
