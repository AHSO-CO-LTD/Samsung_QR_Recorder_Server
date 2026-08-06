import assert from "node:assert/strict";
import test from "node:test";
import { getMissingMachineRequiredFields } from "./machine-form-validation";

test("requires machine code, name, and line when creating a machine", () => {
  assert.deepEqual(
    getMissingMachineRequiredFields({ machine_code: " ", machine_name: "", line_name: "LINE-A" }, false),
    ["machine_code", "machine_name"]
  );
});

test("does not require the locked machine code when editing a machine", () => {
  assert.deepEqual(
    getMissingMachineRequiredFields({ machine_code: "LOCAL01", machine_name: "MayQuet01", line_name: "  " }, true),
    ["line_name"]
  );
});
