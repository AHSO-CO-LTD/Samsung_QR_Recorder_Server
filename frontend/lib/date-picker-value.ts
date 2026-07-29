export type DatePickerMode = "date" | "datetime";

export type ParsedPickerValue = {
  date: Date;
  time: string;
};

export function parsePickerValue(value: string, mode: DatePickerMode): ParsedPickerValue | null {
  const match =
    mode === "datetime"
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
      : /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = mode === "datetime" ? Number(match[4]) : 0;
  const minute = mode === "datetime" ? Number(match[5]) : 0;
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    date,
    time: `${padNumber(hour)}:${padNumber(minute)}`
  };
}

export function serializePickerValue(date: Date, mode: DatePickerMode, time = "00:00") {
  const datePart = `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
  return mode === "datetime" ? `${datePart}T${time}` : datePart;
}

export function formatPickerDisplay(value: ParsedPickerValue, mode: DatePickerMode) {
  const datePart = `${padNumber(value.date.getDate())}/${padNumber(value.date.getMonth() + 1)}/${value.date.getFullYear()}`;
  return mode === "datetime" ? `${datePart} ${value.time}` : datePart;
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}
