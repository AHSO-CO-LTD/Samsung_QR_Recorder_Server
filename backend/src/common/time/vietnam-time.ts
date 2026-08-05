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

export function parseVietnamDateStart(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(calendarDate.getTime() - VIETNAM_UTC_OFFSET_MS);
}
