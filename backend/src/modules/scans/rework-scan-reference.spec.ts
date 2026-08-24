import assert from "node:assert/strict";
import test from "node:test";
import { canReworkNgSource, getReworkSourceLocalScanId, isNgFinalStatus } from "./rework-scan-reference";

test("extracts the original local scan id from an RW- rework id", () => {
  assert.equal(getReworkSourceLocalScanId("RW-LOCAL-20260720161113-a3fdee48"), "LOCAL-20260720161113-a3fdee48");
});

test("rejects an invalid or nested RW- rework id", () => {
  assert.equal(getReworkSourceLocalScanId("LOCAL-20260720161113-a3fdee48"), null);
  assert.equal(getReworkSourceLocalScanId("RW-RW-LOCAL-20260720161113-a3fdee48"), null);
});

test("keeps NG_REWORK in the NG result group", () => {
  assert.equal(isNgFinalStatus("NG"), true);
  assert.equal(isNgFinalStatus("NG_REWORK"), true);
  assert.equal(isNgFinalStatus("REWORK"), false);
});

test("allows a source NG to be reworked only once", () => {
  assert.equal(canReworkNgSource("NG"), true);
  assert.equal(canReworkNgSource("NG_REWORK"), false);
});
