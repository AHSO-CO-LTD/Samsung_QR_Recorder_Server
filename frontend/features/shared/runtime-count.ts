import type { Locale } from "@/lib/i18n";

export function formatRuntimeCount(value: number, locale: Locale) {
  const safeValue = normalizeRuntimeCount(value);
  if (safeValue < 1000) {
    return formatRuntimeCountFull(safeValue, locale);
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: safeValue < 10_000 || safeValue >= 1_000_000 ? 1 : 0
  }).format(safeValue);
}

export function formatRuntimeCountFull(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(normalizeRuntimeCount(value));
}

function normalizeRuntimeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
