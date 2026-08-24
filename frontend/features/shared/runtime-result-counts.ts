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
    indexedRows[row.machine_id] = createDisplayedRuntimeCounts({ ok: row.ok, ng: row.ng, rework: row.rework });
    return indexedRows;
  }, {});
}

export function resolveSessionResultCounts(session?: MachineRuntimeSession): RuntimeResultCounts {
  const ok = toSafeRuntimeCount(session?.ok_count);
  const ng = toSafeRuntimeCount(session?.ng_count);
  const total = toSafeRuntimeCount(session?.total_count);
  const rework = Math.max(0, total - ok - ng);

  return createDisplayedRuntimeCounts({ ok, ng, rework });
}

function createDisplayedRuntimeCounts(input: Pick<RuntimeResultCounts, "ok" | "ng" | "rework">): RuntimeResultCounts {
  const ok = toSafeRuntimeCount(input.ok);
  const ng = toSafeRuntimeCount(input.ng);
  const rework = toSafeRuntimeCount(input.rework);
  return { ok, ng, rework, total: ok + ng };
}

function toSafeRuntimeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}
