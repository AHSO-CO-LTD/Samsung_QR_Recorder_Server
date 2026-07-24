import type { Locale } from "@/lib/i18n";

export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const APP_TIME_ZONE_LABEL = "GMT+7";

const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;

export function formatAppDateTime(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {}
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const resolvedOptions: Intl.DateTimeFormatOptions =
    Object.keys(options).length > 0
      ? options
      : {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        };

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    timeZone: APP_TIME_ZONE,
    ...resolvedOptions
  }).format(date);
}

export function formatAppTime(value: string | number | Date, locale: Locale, includeSeconds = false) {
  return formatAppDateTime(value, locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" as const } : {}),
    hourCycle: "h23"
  });
}

export function toAppDatetimeLocal(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function appDatetimeLocalToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return new Date(value).toISOString();
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const utcMs =
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) -
    VIETNAM_UTC_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMs).toISOString();
}
