import assert from "node:assert/strict";
import test from "node:test";
import { advanceDevRecoveryShortcut, type DevRecoveryShortcutProgress } from "./dev-recovery-shortcut-state";

test("activates only after ten shortcut presses", () => {
  let progress: DevRecoveryShortcutProgress = { count: 0, startedAt: null };

  for (let index = 0; index < 9; index += 1) {
    const result = advanceDevRecoveryShortcut(progress, index * 400);
    assert.equal(result.activated, false);
    progress = result.progress;
  }

  const result = advanceDevRecoveryShortcut(progress, 4_999);
  assert.equal(result.activated, true);
  assert.deepEqual(result.progress, { count: 0, startedAt: null });
});

test("starts a new sequence after activation", () => {
  const activated = advanceDevRecoveryShortcut({ count: 9, startedAt: 1_000 }, 5_000);
  const nextResult = advanceDevRecoveryShortcut(activated.progress, 5_100);

  assert.equal(activated.activated, true);
  assert.equal(nextResult.activated, false);
  assert.deepEqual(nextResult.progress, { count: 1, startedAt: 5_100 });
});

test("resets the sequence when the tenth press is later than five seconds", () => {
  const progress: DevRecoveryShortcutProgress = { count: 9, startedAt: 1_000 };
  const result = advanceDevRecoveryShortcut(progress, 6_001);

  assert.equal(result.activated, false);
  assert.deepEqual(result.progress, { count: 1, startedAt: 6_001 });
});

test("accepts the tenth press at exactly five seconds", () => {
  const progress: DevRecoveryShortcutProgress = { count: 9, startedAt: 1_000 };
  const result = advanceDevRecoveryShortcut(progress, 6_000);

  assert.equal(result.activated, true);
  assert.deepEqual(result.progress, { count: 0, startedAt: null });
});
