import { getVietnamDayRange, parseVietnamDateStart } from "../../common/time/vietnam-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SCAN_TREND_SCOPES = [
  "today",
  "last_12_hours",
  "last_7_days",
  "last_30_days",
  "last_1_year",
  "all",
  "since"
] as const;

export const ERROR_RANKING_SCOPES = ["today", "last_7_days", "last_30_days", "last_1_year", "all"] as const;

export type ScanTrendScope = (typeof SCAN_TREND_SCOPES)[number];
export type ErrorRankingScope = (typeof ERROR_RANKING_SCOPES)[number];

export type ScanTrendRange = {
  start?: Date;
  end: Date;
  bucket: "30_minutes" | "day" | "month";
};

export function isScanTrendScope(value: string): value is ScanTrendScope {
  return SCAN_TREND_SCOPES.includes(value as ScanTrendScope);
}

export function isErrorRankingScope(value: string): value is ErrorRankingScope {
  return ERROR_RANKING_SCOPES.includes(value as ErrorRankingScope);
}

export function resolveScanTrendRange(scope: ScanTrendScope, from: string | undefined, now: Date = new Date()): ScanTrendRange {
  if (scope === "last_12_hours") {
    return {
      start: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      end: now,
      bucket: "30_minutes"
    };
  }

  const todayStart = getVietnamDayRange(now).start;
  if (scope === "today") {
    return {
      start: todayStart,
      end: now,
      bucket: "30_minutes"
    };
  }
  if (scope === "last_7_days") {
    return {
      start: new Date(todayStart.getTime() - 6 * DAY_MS),
      end: now,
      bucket: "day"
    };
  }
  if (scope === "last_30_days") {
    return {
      start: new Date(todayStart.getTime() - 29 * DAY_MS),
      end: now,
      bucket: "day"
    };
  }
  if (scope === "last_1_year") {
    return {
      start: new Date(todayStart.getTime() - 364 * DAY_MS),
      end: now,
      bucket: "month"
    };
  }
  if (scope === "all") {
    return {
      end: now,
      bucket: "day"
    };
  }

  const start = from ? parseVietnamDateStart(from) : null;
  if (!start) {
    throw new Error("Ngày bắt đầu không hợp lệ. Vui lòng dùng định dạng YYYY-MM-DD.");
  }
  if (start.getTime() > now.getTime()) {
    throw new Error("Ngày bắt đầu không được lớn hơn thời điểm hiện tại.");
  }

  return {
    start,
    end: now,
    bucket: "day"
  };
}
