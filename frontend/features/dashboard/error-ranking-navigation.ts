import { toAppDateInput, toAppDatetimeLocal } from "@/lib/app-time";
import type { ScanTrendScope } from "./scan-trend-range-control";

const DAY_MS = 24 * 60 * 60 * 1000;

const scopeDayOffsets: Partial<Record<ScanTrendScope, number>> = {
  today: 0,
  last_7_days: 6,
  last_30_days: 29,
  last_1_year: 364
};

export function buildErrorRankingScanHistoryHref(errorCode: string, scope: ScanTrendScope, now = new Date()) {
  const params = new URLSearchParams({
    final_status: "NG",
    ng_reason: errorCode,
    to: toAppDatetimeLocal(now)
  });
  const dayOffset = scopeDayOffsets[scope];

  if (dayOffset !== undefined) {
    params.set("from", `${toAppDateInput(new Date(now.getTime() - dayOffset * DAY_MS))}T00:00`);
  }

  return `/scans?${params.toString()}`;
}
