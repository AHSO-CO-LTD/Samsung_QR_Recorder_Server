import assert from "node:assert/strict";
import test from "node:test";
import { toAppDateInput } from "./app-time";

test("uses the fixed app timezone for date input values", () => {
  assert.equal(toAppDateInput("2026-07-27T17:00:00.000Z"), "2026-07-28");
  assert.equal(toAppDateInput("2026-07-27T16:59:59.999Z"), "2026-07-27");
});
