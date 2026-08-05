import assert from "node:assert/strict";
import test from "node:test";
import { formatRuntimeCount, formatRuntimeCountFull } from "./runtime-count";

test("compacts six-digit runtime totals without losing the exact tooltip value", () => {
  assert.equal(formatRuntimeCount(140_124, "vi"), "140K");
  assert.equal(formatRuntimeCountFull(140_124, "vi"), "140.124");
});

test("keeps small counts exact and preserves one decimal for compact low thousands", () => {
  assert.equal(formatRuntimeCount(999, "vi"), "999");
  assert.equal(formatRuntimeCount(1_500, "vi"), "1.5K");
});

test("uses the selected locale for the exact value", () => {
  assert.equal(formatRuntimeCountFull(140_124, "en"), "140,124");
});

test("uses million and billion units for compact chart totals", () => {
  assert.equal(formatRuntimeCount(1_500_000, "vi"), "1.5M");
  assert.equal(formatRuntimeCount(140_124_000, "vi"), "140.1M");
  assert.equal(formatRuntimeCount(1_500_000_000, "vi"), "1.5B");
});
