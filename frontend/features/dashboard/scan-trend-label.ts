import type { Locale } from "@/lib/i18n";

const englishMonthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTrendDateLabel(value: string, locale: Locale) {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(value);
  if (monthMatch) {
    const monthIndex = Number(monthMatch[2]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return locale === "vi" ? `T${monthIndex + 1}` : englishMonthLabels[monthIndex];
    }
  }

  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return dayMatch ? `${dayMatch[3]}/${dayMatch[2]}/${dayMatch[1]}` : value;
}
