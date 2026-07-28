"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_TIME_ZONE_LABEL } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

export const scanTrendScopes = ["today", "last_12_hours", "last_7_days", "last_30_days", "all", "since"] as const;

export type ScanTrendScope = (typeof scanTrendScopes)[number];

const scopeLabelKeys: Record<ScanTrendScope, MessageKey> = {
  today: "runtimeScopeToday",
  last_12_hours: "runtimeScopeLast12Hours",
  last_7_days: "scanTrendLast7Days",
  last_30_days: "scanTrendLast30Days",
  all: "runtimeScopeAll",
  since: "runtimeScopeSince"
};

export function ScanTrendRangeControl({
  scope,
  sinceDate,
  maxDate,
  disabled,
  onScopeChange,
  onSinceDateChange
}: {
  scope: ScanTrendScope;
  sinceDate: string;
  maxDate: string;
  disabled: boolean;
  onScopeChange: (scope: ScanTrendScope) => void;
  onSinceDateChange: (value: string) => void;
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
      {scope === "since" ? (
        <Input
          type="date"
          value={sinceDate}
          max={maxDate}
          className="h-8 w-40 text-xs"
          aria-label={t("runtimeSinceDate")}
          title={`${t("runtimeSinceDate")} (${APP_TIME_ZONE_LABEL})`}
          disabled={disabled}
          onChange={(event) => onSinceDateChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
