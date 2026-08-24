export type LogicalResultCounts = {
  ok: number;
  ng: number;
  rework: number;
  total: number;
};

/**
 * Keeps NG visible as the complete NG history while excluding REWORK from the
 * all-results total. REWORK is a tracked subset of NG, not another outcome.
 */
export function resolveLogicalResultCounts(input: {
  ok?: number | null;
  ng?: number | null;
  rework?: number | null;
}): LogicalResultCounts {
  const ok = toSafeCount(input.ok);
  const rawNg = toSafeCount(input.ng);
  const rework = toSafeCount(input.rework);
  const ng = rawNg;

  return {
    ok,
    ng,
    rework,
    total: ok + ng
  };
}

function toSafeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}
