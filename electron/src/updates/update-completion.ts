export type PendingUpdateState = {
  targetVersion: string;
  targetTag: string;
  previousVersion: string;
  requestedAt: string;
};

export function normalizeUpdateVersion(value: string) {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
}

export function resolveCompletedUpdateVersion(state: PendingUpdateState, currentVersion: string) {
  const targetVersion = normalizeUpdateVersion(state.targetVersion);
  const normalizedCurrentVersion = normalizeUpdateVersion(currentVersion);
  return targetVersion && normalizedCurrentVersion === targetVersion ? targetVersion : null;
}
