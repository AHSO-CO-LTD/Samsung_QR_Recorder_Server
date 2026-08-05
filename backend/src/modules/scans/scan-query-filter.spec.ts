import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildNgReasonWhere } from "./scan-query-filter";

test("returns no NG reason condition for an empty code", () => {
  assert.equal(buildNgReasonWhere("  "), undefined);
});

test("matches an NG reason on either the scan record or an LED item", () => {
  const reasonFilter = {
    equals: "LED_SUFFIX_NOT_MATCH",
    mode: Prisma.QueryMode.insensitive
  };

  assert.deepEqual(buildNgReasonWhere(" LED_SUFFIX_NOT_MATCH "), {
    OR: [
      { ng_reason: reasonFilter },
      { led_items: { some: { ng_reason: reasonFilter } } }
    ]
  });
});
