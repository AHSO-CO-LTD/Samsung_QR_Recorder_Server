import type { Locale } from "@/lib/i18n";

export function formatRuntimeCount(value: number, locale: Locale) {
  const safeValue = normalizeRuntimeCount(value);
  if (safeValue < 1000) {
    return formatRuntimeCountFull(safeValue, locale);
  }

  if (safeValue < 1_000_000) {
    return formatCompactCount(safeValue, 1_000, 1, "K");
  }

  if (safeValue < 1_000_000_000) {
    return formatCompactCount(safeValue, 1_000_000, 3, "M");
  }

  return formatCompactCount(safeValue, 1_000_000_000, 3, "B");
}

export function formatRuntimeCountFull(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(normalizeRuntimeCount(value));
}

function normalizeRuntimeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function formatCompactCount(value: number, unit: number, fractionDigits: number, suffix: "K" | "M" | "B") {
  const factor = 10 ** fractionDigits;
  const truncated = Math.floor((value / unit) * factor) / factor;
  const displayValue = truncated.toFixed(fractionDigits).replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
  return `${displayValue}${suffix}`;
}
