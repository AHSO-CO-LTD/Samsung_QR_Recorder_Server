import assert from "node:assert/strict";
import test from "node:test";
import { formatAppDateTime, toAppDateInput } from "./app-time";

test("uses the fixed app timezone for date input values", () => {
  assert.equal(toAppDateInput("2026-07-27T17:00:00.000Z"), "2026-07-28");
  assert.equal(toAppDateInput("2026-07-27T16:59:59.999Z"), "2026-07-27");
});

test("formats dates as day/month/year in both languages", () => {
  const options = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
  assert.equal(formatAppDateTime("2026-07-29T01:00:00.000Z", "vi", options), "29/07/2026");
  assert.equal(formatAppDateTime("2026-07-29T01:00:00.000Z", "en", options), "29/07/2026");
});
