import assert from "node:assert/strict";
import test from "node:test";
import { formatRuntimeCount, formatRuntimeCountFull } from "./runtime-count";

test("cuts thousands down to one decimal instead of rounding them up", () => {
  assert.equal(formatRuntimeCount(140_124, "vi"), "140.1K");
  assert.equal(formatRuntimeCount(290_357, "vi"), "290.3K");
  assert.equal(formatRuntimeCountFull(140_124, "vi"), "140.124");
});

test("keeps small counts exact and never rounds compact values up", () => {
  assert.equal(formatRuntimeCount(999, "vi"), "999");
  assert.equal(formatRuntimeCount(1_500, "vi"), "1.5K");
  assert.equal(formatRuntimeCount(7_886, "vi"), "7.8K");
  assert.equal(formatRuntimeCount(1_999, "vi"), "1.9K");
});

test("uses the selected locale for the exact value", () => {
  assert.equal(formatRuntimeCountFull(140_124, "en"), "140,124");
});

test("keeps three decimals for millions and billions without rounding up", () => {
  assert.equal(formatRuntimeCount(1_500_000, "vi"), "1.5M");
  assert.equal(formatRuntimeCount(1_075_044, "vi"), "1.075M");
  assert.equal(formatRuntimeCount(140_124_000, "vi"), "140.124M");
  assert.equal(formatRuntimeCount(1_500_000_000, "vi"), "1.5B");
});
