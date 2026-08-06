import type { MachineRuntimeSession } from "./types";

export type RuntimeResultCounts = {
  ok: number;
  ng: number;
  rework: number;
  total: number;
};

export type RuntimeSummaryRow = RuntimeResultCounts & {
  machine_id: number;
  machine_code: string;
};

export function indexRuntimeSummary(rows: RuntimeSummaryRow[]) {
  return rows.reduce<Record<number, RuntimeResultCounts>>((indexedRows, row) => {
    indexedRows[row.machine_id] = {
      ok: toSafeRuntimeCount(row.ok),
      ng: toSafeRuntimeCount(row.ng),
      rework: toSafeRuntimeCount(row.rework),
      total: toSafeRuntimeCount(row.total)
    };
    return indexedRows;
  }, {});
}

export function resolveSessionResultCounts(session?: MachineRuntimeSession): RuntimeResultCounts {
  const ok = toSafeRuntimeCount(session?.ok_count);
  const ng = toSafeRuntimeCount(session?.ng_count);
  const total = toSafeRuntimeCount(session?.total_count);
  const rework = Math.max(0, total - ok - ng);

  return { ok, ng, rework, total: ok + ng + rework };
}

function toSafeRuntimeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}
