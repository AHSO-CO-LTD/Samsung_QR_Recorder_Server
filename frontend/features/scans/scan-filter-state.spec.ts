import assert from "node:assert/strict";
import test from "node:test";
import { emptyScanFilters, getScanErrorOptionLabel, getScanLineOptions, selectScanErrorFilter, selectScanResultFilter } from "./scan-filter-state";

test("selecting an error type forces the result filter to NG", () => {
  const filters = selectScanErrorFilter({ ...emptyScanFilters, final_status: "OK" }, "LED_SUFFIX_NOT_MATCH");

  assert.equal(filters.final_status, "NG");
  assert.equal(filters.ng_reason, "LED_SUFFIX_NOT_MATCH");
});

test("changing the result from NG to OK clears the error type", () => {
  const filters = selectScanResultFilter(
    { ...emptyScanFilters, final_status: "NG", ng_reason: "LED_SUFFIX_NOT_MATCH" },
    "OK"
  );

  assert.equal(filters.final_status, "OK");
  assert.equal(filters.ng_reason, "");
});

test("keeping the NG result preserves the selected error type", () => {
  const filters = selectScanResultFilter(
    { ...emptyScanFilters, final_status: "NG", ng_reason: "LED_SUFFIX_NOT_MATCH" },
    "NG"
  );

  assert.equal(filters.ng_reason, "LED_SUFFIX_NOT_MATCH");
});

test("changing the result from NG to REWORK preserves the error type", () => {
  const filters = selectScanResultFilter(
    { ...emptyScanFilters, final_status: "NG", ng_reason: "LED_SUFFIX_NOT_MATCH" },
    "REWORK"
  );

  assert.equal(filters.final_status, "REWORK");
  assert.equal(filters.ng_reason, "LED_SUFFIX_NOT_MATCH");
});

test("changing the result from NG to reworked preserves the error type", () => {
  const filters = selectScanResultFilter(
    { ...emptyScanFilters, final_status: "NG", ng_reason: "LED_SUFFIX_NOT_MATCH" },
    "NG_REWORK"
  );

  assert.equal(filters.final_status, "NG_REWORK");
  assert.equal(filters.ng_reason, "LED_SUFFIX_NOT_MATCH");
});

test("selecting an error type keeps the reworked result filter", () => {
  const filters = selectScanErrorFilter({ ...emptyScanFilters, final_status: "NG_REWORK" }, "LED_SUFFIX_NOT_MATCH");

  assert.equal(filters.final_status, "NG_REWORK");
  assert.equal(filters.ng_reason, "LED_SUFFIX_NOT_MATCH");
});

test("selecting an error type keeps the REWORK result filter", () => {
  const filters = selectScanErrorFilter({ ...emptyScanFilters, final_status: "REWORK" }, "LED_SUFFIX_NOT_MATCH");

  assert.equal(filters.final_status, "REWORK");
  assert.equal(filters.ng_reason, "LED_SUFFIX_NOT_MATCH");
});

test("shows only the localized error name without the code", () => {
  const option = {
    code: "LED_SUFFIX_NOT_MATCH",
    definition: { name_vi: "Hậu tố LED không khớp", name_en: "LED suffix mismatch" }
  };

  assert.equal(getScanErrorOptionLabel(option, "vi"), "Hậu tố LED không khớp");
  assert.equal(getScanErrorOptionLabel(option, "en"), "LED suffix mismatch");
});

test("falls back to the code when the current language has no name", () => {
  const option = {
    code: "LED_SUFFIX_NOT_MATCH",
    definition: { name_vi: "Hậu tố LED không khớp", name_en: null }
  };

  assert.equal(getScanErrorOptionLabel(option, "en"), "LED_SUFFIX_NOT_MATCH");
});

test("builds a unique sorted list of non-empty scan lines", () => {
  assert.deepEqual(
    getScanLineOptions([
      { line_name: "Line 10" },
      { line_name: " Line 2 " },
      { line_name: "Line 2" },
      { line_name: null },
      { line_name: "" }
    ]),
    ["Line 2", "Line 10"]
  );
});
