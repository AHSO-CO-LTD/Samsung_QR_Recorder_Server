export const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function getVietnamDayRange(value: Date = new Date()) {
  const vietnamDate = new Date(value.getTime() + VIETNAM_UTC_OFFSET_MS);
  const startMs =
    Date.UTC(vietnamDate.getUTCFullYear(), vietnamDate.getUTCMonth(), vietnamDate.getUTCDate()) -
    VIETNAM_UTC_OFFSET_MS;

  return {
    start: new Date(startMs),
    end: new Date(startMs + DAY_MS)
  };
}
