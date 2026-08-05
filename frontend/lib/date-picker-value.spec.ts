import assert from "node:assert/strict";
import test from "node:test";
import { formatPickerDisplay, parsePickerValue, serializePickerValue } from "./date-picker-value";

test("hiển thị ngày theo thứ tự ngày/tháng/năm", () => {
  const parsed = parsePickerValue("2026-07-29", "date");
  assert.ok(parsed);
  assert.equal(formatPickerDisplay(parsed, "date"), "29/07/2026");
});

test("giữ nguyên giờ khi hiển thị và tuần tự hóa ngày giờ", () => {
  const parsed = parsePickerValue("2026-07-29T15:42", "datetime");
  assert.ok(parsed);
  assert.equal(formatPickerDisplay(parsed, "datetime"), "29/07/2026 15:42");
  assert.equal(serializePickerValue(parsed.date, "datetime", parsed.time), "2026-07-29T15:42");
});

test("từ chối ngày không tồn tại", () => {
  assert.equal(parsePickerValue("2026-02-30", "date"), null);
});
