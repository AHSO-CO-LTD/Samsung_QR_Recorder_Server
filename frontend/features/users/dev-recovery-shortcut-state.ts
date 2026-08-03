export type DevRecoveryShortcutProgress = {
  count: number;
  startedAt: number | null;
};

export const DEV_RECOVERY_SHORTCUT_WINDOW_MS = 5_000;

export function advanceDevRecoveryShortcut(
  progress: DevRecoveryShortcutProgress,
  pressedAt = Date.now(),
  requiredPressCount = 10,
  windowMs = DEV_RECOVERY_SHORTCUT_WINDOW_MS
) {
  const elapsedMs = progress.startedAt === null ? 0 : pressedAt - progress.startedAt;
  const startsNewSequence =
    progress.count === 0 ||
    progress.startedAt === null ||
    elapsedMs < 0 ||
    elapsedMs > windowMs;
  const nextProgress = {
    count: startsNewSequence ? 1 : progress.count + 1,
    startedAt: startsNewSequence ? pressedAt : progress.startedAt
  };

  if (nextProgress.count < requiredPressCount) {
    return { activated: false, progress: nextProgress };
  }

  return {
    activated: true,
    progress: { count: 0, startedAt: null }
  };
}
