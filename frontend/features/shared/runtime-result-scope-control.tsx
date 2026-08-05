"use client";

import type React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/features/shared/date-time-picker";
import { APP_TIME_ZONE_LABEL, toAppDateInput, toAppDatetimeLocal } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import type { MachineRuntimeSession } from "@/features/shared/types";
import type { RuntimeResultCounts } from "@/features/shared/machine-runtime-card";

export const RUNTIME_RESULT_SCOPE_STORAGE_KEY = "runtime-monitor-result-scope";
export const RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY = "runtime-monitor-result-since-date";

export const runtimeResultScopes = ["session", "today", "last_12_hours", "all", "since"] as const;

export type RuntimeResultScope = (typeof runtimeResultScopes)[number];

export type RuntimeSummaryRow = RuntimeResultCounts & {
  machine_id: number;
  machine_code: string;
};

const runtimeResultScopeLabelKeys: Record<RuntimeResultScope, MessageKey> = {
  session: "runtimeScopeSession",
  today: "runtimeScopeToday",
  last_12_hours: "runtimeScopeLast12Hours",
  all: "runtimeScopeAll",
  since: "runtimeScopeSince"
};

export function RuntimeResultScopeControl({
  scope,
  sinceDate,
  maxDate,
  isLoading,
  error,
  onScopeChange,
  onSinceDateChange,
  trailingContent
}: {
  scope: RuntimeResultScope;
  sinceDate: string;
  maxDate: string;
  isLoading: boolean;
  error: string | null;
  onScopeChange: (scope: RuntimeResultScope) => void;
  onSinceDateChange: (value: string) => void;
  trailingContent?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="border-b pb-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="mr-1 flex items-baseline gap-1.5">
          <span className="text-sm font-medium">{t("runtimeResultScope")}</span>
          <span className="text-[11px] text-muted-foreground">{APP_TIME_ZONE_LABEL}</span>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("runtimeResultScope")}>
          {runtimeResultScopes.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={scope === value ? "default" : "outline"}
              aria-pressed={scope === value}
              disabled={isLoading}
              onClick={() => onScopeChange(value)}
            >
              {t(runtimeResultScopeLabelKeys[value])}
            </Button>
          ))}
        </div>
        {scope === "since" ? (
          <DatePickerInput
            value={sinceDate}
            max={maxDate}
            className="h-8 w-40 text-xs"
            ariaLabel={t("runtimeSinceDate")}
            title={`${t("runtimeSinceDate")} (${APP_TIME_ZONE_LABEL})`}
            disabled={isLoading}
            onChange={onSinceDateChange}
          />
        ) : null}
        {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label={t("loading")} /> : null}
        {trailingContent ? <div className="ml-auto">{trailingContent}</div> : null}
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function isRuntimeResultScope(value: string): value is RuntimeResultScope {
  return runtimeResultScopes.includes(value as RuntimeResultScope);
}

export function indexRuntimeSummary(rows: RuntimeSummaryRow[]) {
  return rows.reduce<Record<number, RuntimeResultCounts>>((indexedRows, row) => {
    indexedRows[row.machine_id] = {
      ok: toSafeRuntimeCount(row.ok),
      ng: toSafeRuntimeCount(row.ng),
      total: toSafeRuntimeCount(row.total)
    };
    return indexedRows;
  }, {});
}

export function resolveRuntimeResultCounts(
  machineId: number,
  session: MachineRuntimeSession | undefined,
  scope: RuntimeResultScope,
  summaryByMachine: Record<number, RuntimeResultCounts>
): RuntimeResultCounts {
  if (scope !== "session") {
    return summaryByMachine[machineId] ?? { ok: 0, ng: 0, total: 0 };
  }

  const ok = toSafeRuntimeCount(session?.ok_count);
  const ng = toSafeRuntimeCount(session?.ng_count);
  return {
    ok,
    ng,
    total: ok + ng
  };
}

function toSafeRuntimeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}

export function buildScanTimeRangeFromScope(
  scope: RuntimeResultScope,
  sinceDate?: string,
  sessionStartedAt?: string | null
): { from: string; to: string } {
  const now = new Date();
  const to = toAppDatetimeLocal(now);

  if (scope === "session") {
    if (sessionStartedAt) {
      const sessionFrom = toAppDatetimeLocal(sessionStartedAt);
      if (sessionFrom) {
        return { from: sessionFrom, to };
      }
    }
    return { from: "", to: "" };
  }

  if (scope === "today") {
    const todayDateStr = toAppDateInput(now);
    return { from: `${todayDateStr}T00:00`, to };
  }

  if (scope === "last_12_hours") {
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    return { from: toAppDatetimeLocal(twelveHoursAgo), to };
  }

  if (scope === "since") {
    if (sinceDate) {
      return { from: `${sinceDate}T00:00`, to };
    }
    return { from: "", to: "" };
  }

  // "all"
  return { from: "", to: "" };
}
