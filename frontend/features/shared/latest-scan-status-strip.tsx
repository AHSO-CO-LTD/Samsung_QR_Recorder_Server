"use client";

import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

type LatestScanStatusStripProps = {
  code?: string | null;
  result?: string | null;
};

export function LatestScanStatusStrip({ code, result }: LatestScanStatusStripProps) {
  const { t } = useI18n();
  const normalizedCode = code?.trim() || null;
  const normalizedResult = result?.trim().toUpperCase() || null;
  const isOk = normalizedResult === "OK";
  const isNg = normalizedResult === "NG";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-2 border-t px-4 py-2 text-sm",
        isOk && "border-emerald-500/40 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100",
        isNg && "border-destructive/40 bg-destructive/20 text-destructive",
        !isOk && !isNg && "bg-muted/35 text-muted-foreground"
      )}
    >
      {normalizedCode ? (
        <>
          <span className="min-w-0 flex-1 break-all font-mono text-xs font-semibold" title={normalizedCode}>
            {normalizedCode}
          </span>
          <span className="shrink-0 opacity-60" aria-hidden="true">|</span>
          <strong className="shrink-0">{normalizedResult ?? t("pending")}</strong>
        </>
      ) : (
        <span className="min-w-0 flex-1">{t("noLatestQrScan")}</span>
      )}
    </div>
  );
}
