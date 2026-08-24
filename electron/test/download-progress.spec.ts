import assert from "node:assert/strict";
import test from "node:test";
import { buildUpdateDownloadProgress } from "../src/updates/download-progress";

test("calculates update download percentage and average speed", () => {
  const progress = buildUpdateDownloadProgress({
    tagName: "v1.3.0",
    phase: "downloading",
    transferredBytes: 25 * 1024 * 1024,
    totalBytes: 100 * 1024 * 1024,
    startedAt: 1_000,
    now: 6_000
  });

  assert.equal(progress.percent, 25);
  assert.equal(progress.bytesPerSecond, 5 * 1024 * 1024);
});

test("keeps progress usable when the server omits content length", () => {
  const progress = buildUpdateDownloadProgress({
    tagName: "v1.3.0",
    phase: "downloading",
    transferredBytes: 1024,
    totalBytes: null,
    startedAt: 1_000,
    now: 2_000
  });

  assert.equal(progress.percent, null);
  assert.equal(progress.totalBytes, null);
  assert.equal(progress.bytesPerSecond, 1024);
});
