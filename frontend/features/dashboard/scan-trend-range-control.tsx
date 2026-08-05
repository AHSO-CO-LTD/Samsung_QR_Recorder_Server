"use client";

import { Button } from "@/components/ui/button";
import { APP_TIME_ZONE_LABEL } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

export const scanTrendScopes = ["today", "last_7_days", "last_30_days", "last_1_year", "all"] as const;

export type ScanTrendScope = (typeof scanTrendScopes)[number];

const scopeLabelKeys: Record<ScanTrendScope, MessageKey> = {
  today: "todayPeriod",
  last_7_days: "scanTrendLast7Days",
  last_30_days: "scanTrendLast30Days",
  last_1_year: "scanTrendLast1Year",
  all: "runtimeScopeAll"
};

export function ScanTrendRangeControl({
  scope,
  disabled,
  onScopeChange
}: {
  scope: ScanTrendScope;
  disabled: boolean;
  onScopeChange: (scope: ScanTrendScope) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {t("scanTrendRange")} ({APP_TIME_ZONE_LABEL})
      </span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("scanTrendRange")}>
        {scanTrendScopes.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={scope === value ? "default" : "outline"}
            className="whitespace-nowrap"
            aria-pressed={scope === value}
            disabled={disabled}
            onClick={() => onScopeChange(value)}
          >
            {t(scopeLabelKeys[value])}
          </Button>
        ))}
      </div>
    </div>
  );
}
