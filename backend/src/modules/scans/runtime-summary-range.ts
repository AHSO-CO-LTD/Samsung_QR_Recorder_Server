import { getVietnamDayRange, parseVietnamDateStart } from "../../common/time/vietnam-time";

export const RUNTIME_SUMMARY_SCOPES = ["today", "last_12_hours", "all", "since"] as const;

export type RuntimeSummaryScope = (typeof RUNTIME_SUMMARY_SCOPES)[number];

export type RuntimeSummaryRange = {
  start?: Date;
  end?: Date;
};

export function isRuntimeSummaryScope(value: string): value is RuntimeSummaryScope {
  return RUNTIME_SUMMARY_SCOPES.includes(value as RuntimeSummaryScope);
}

export function resolveRuntimeSummaryRange(
  scope: RuntimeSummaryScope,
  from: string | undefined,
  now: Date = new Date()
): RuntimeSummaryRange {
  if (scope === "all") {
    return {};
  }

  if (scope === "last_12_hours") {
    return {
      start: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      end: now
    };
  }

  if (scope === "today") {
    return {
      start: getVietnamDayRange(now).start,
      end: now
    };
  }

  const start = from ? parseVietnamDateStart(from) : null;
  if (!start) {
    throw new Error("Ngày bắt đầu không hợp lệ. Vui lòng dùng định dạng YYYY-MM-DD.");
  }
  if (start.getTime() > now.getTime()) {
    throw new Error("Ngày bắt đầu không được lớn hơn thời điểm hiện tại.");
  }

  return { start, end: now };
}
