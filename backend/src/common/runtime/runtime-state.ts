export const RUNTIME_PAUSE_TIMEOUT_MS = 5 * 60 * 1000;

export type RuntimeResultState = {
  total_count?: number | null;
  ok_count?: number | null;
  ng_count?: number | null;
  last_code?: string | null;
  last_local_scan_id?: string | null;
};

export type RuntimeResultUpdate = {
  total_count?: number;
  ok_count?: number;
  ng_count?: number;
  last_code?: string;
  local_scan_id?: string;
};

export function hasNewRuntimeResult(previous: RuntimeResultState, next: RuntimeResultUpdate) {
  return (
    changedNumber(previous.total_count, next.total_count) ||
    changedNumber(previous.ok_count, next.ok_count) ||
    changedNumber(previous.ng_count, next.ng_count) ||
    changedText(previous.last_code, next.last_code) ||
    changedText(previous.last_local_scan_id, next.local_scan_id)
  );
}

export function isRuntimePauseDue(input: {
  status: string;
  startedAt: Date;
  lastResultAt?: Date | null;
  connectionAlive: boolean;
  now: Date;
}) {
  if (input.status !== "RUNNING" || !input.connectionAlive) {
    return false;
  }

  const activityAt = input.lastResultAt ?? input.startedAt;
  return input.now.getTime() - activityAt.getTime() >= RUNTIME_PAUSE_TIMEOUT_MS;
}

function changedNumber(previous: number | null | undefined, next: number | undefined) {
  return typeof next === "number" && next !== previous;
}

function changedText(previous: string | null | undefined, next: string | undefined) {
  const normalizedNext = next?.trim();
  return Boolean(normalizedNext) && normalizedNext !== previous?.trim();
}
