import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUpdateVersion, resolveCompletedUpdateVersion } from "../src/updates/update-completion";

const pendingUpdate = {
  targetVersion: "1.2.0",
  targetTag: "v1.2.0",
  previousVersion: "1.1.2",
  requestedAt: "2026-07-28T00:00:00.000Z"
};

test("recognizes a completed update when the running version matches the target", () => {
  assert.equal(resolveCompletedUpdateVersion(pendingUpdate, "v1.2.0"), "1.2.0");
});

test("does not report success while the previous version is still running", () => {
  assert.equal(resolveCompletedUpdateVersion(pendingUpdate, "1.1.2"), null);
});

test("normalizes release tags and prerelease suffixes", () => {
  assert.equal(normalizeUpdateVersion("v01.02.003-beta.1"), "1.2.3");
  assert.equal(normalizeUpdateVersion("invalid"), null);
});
