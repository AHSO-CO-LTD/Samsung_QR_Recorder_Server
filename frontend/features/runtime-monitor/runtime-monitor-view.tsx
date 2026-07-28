"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiGet } from "@/lib/api";
import { toAppDateInput } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";
import {
  MachineRuntimeCard,
  buildMachineRows,
  buildRuntimeSocketUrl,
  buildSessionServerTrendData,
  type MachineRuntimeCardDisplayOptions,
  type RuntimeResultCounts,
  type RuntimeChartTimeAxis
} from "@/features/shared/machine-runtime-card";
import {
  RUNTIME_RESULT_SCOPE_STORAGE_KEY,
  RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY,
  RuntimeResultScopeControl,
  indexRuntimeSummary,
  isRuntimeResultScope,
  resolveRuntimeResultCounts,
  type RuntimeResultScope,
  type RuntimeSummaryRow
} from "@/features/shared/runtime-result-scope-control";
import type { Machine, MachineRuntimeSession } from "@/features/shared/types";

const RUNTIME_REFRESH_MS = 5000;
const TIME_AXIS_REFRESH_MS = 30000;
const COLUMN_STORAGE_KEY = "runtime-monitor-columns-per-row";
const DISPLAY_STORAGE_KEY = "runtime-monitor-display-options";

const defaultDisplayOptions: MachineRuntimeCardDisplayOptions = {
  machineInfo: true,
  currentProduct: true,
  duration: true,
  commonIssue: true,
  serverChart: true
};

const displayOptionKeys = Object.keys(defaultDisplayOptions) as Array<keyof MachineRuntimeCardDisplayOptions>;
const displayOptionLabelKeys: Record<keyof MachineRuntimeCardDisplayOptions, MessageKey> = {
  machineInfo: "showMachineInfo",
  currentProduct: "showCurrentProduct",
  duration: "showRuntimeDuration",
  commonIssue: "showCommonIssue",
  serverChart: "showServerChart"
};

export function RuntimeMonitorView() {
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
  const [columnsPerRow, setColumnsPerRow] = useState(1);
  const [displayOptions, setDisplayOptions] = useState<MachineRuntimeCardDisplayOptions>(defaultDisplayOptions);
  const [resultScope, setResultScope] = useState<RuntimeResultScope>("session");
  const [sinceDate, setSinceDate] = useState("");
  const [resultCountsByMachine, setResultCountsByMachine] = useState<Record<number, RuntimeResultCounts>>({});
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [timeAxisNowMs, setTimeAxisNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(
    async (showToast = false, background = false) => {
      const requestId = ++loadSequence.current;
      if (!background) {
        setIsLoading(true);
        setError(null);
      }
      if (resultScope !== "session") {
        setScopeError(null);
      }

      try {
        const summaryPath =
          resultScope === "session"
            ? null
            : `/scans/runtime-summary?scope=${resultScope}${
                resultScope === "since" ? `&from=${encodeURIComponent(sinceDate)}` : ""
              }`;
        const [machineResult, sessionResult, summaryResult] = await Promise.allSettled([
          apiGet<Machine[]>("/machines"),
          apiGet<MachineRuntimeSession[]>("/runtime/sessions?take=200&include_scans=true"),
          summaryPath ? apiGet<RuntimeSummaryRow[]>(summaryPath) : Promise.resolve(null)
        ]);

        if (requestId !== loadSequence.current) {
          return;
        }
        if (machineResult.status === "rejected") {
          throw machineResult.reason;
        }

        const nextMachines = (machineResult.value.data ?? []).filter((machine) => machine.is_active);
        const nextSessions = sessionResult.status === "fulfilled" ? sessionResult.value.data ?? [] : [];
        setMachines(nextMachines);
        setSessions(nextSessions);
        setTimeAxisNowMs(Date.now());
        setError(null);

        if (resultScope === "session") {
          setResultCountsByMachine({});
          setScopeError(null);
        } else if (summaryResult.status === "fulfilled" && summaryResult.value) {
          setResultCountsByMachine(indexRuntimeSummary(summaryResult.value.data ?? []));
          setScopeError(null);
        } else if (summaryResult.status === "rejected") {
          const message = summaryResult.reason instanceof Error ? summaryResult.reason.message : t("runtimeSummaryLoadFailed");
          setResultCountsByMachine({});
          setScopeError(message);
          if (showToast) {
            toast.error(message);
          }
        }

        if (sessionResult.status === "rejected" && showToast) {
          toast.error(sessionResult.reason instanceof Error ? sessionResult.reason.message : t("error"));
        }
      } catch (currentError) {
        const message = currentError instanceof Error ? currentError.message : t("error");
        if (!background) {
          setError(message);
        }
        if (showToast) {
          toast.error(message);
        }
      } finally {
        if (!background && requestId === loadSequence.current) {
          setIsLoading(false);
        }
      }
    },
    [resultScope, sinceDate, t]
  );

  useEffect(() => {
    const savedValue = Number(window.localStorage.getItem(COLUMN_STORAGE_KEY));
    if (Number.isFinite(savedValue)) {
      setColumnsPerRow(clampColumnsPerRow(savedValue));
    }

    setDisplayOptions(readSavedDisplayOptions());
    const savedScope = window.localStorage.getItem(RUNTIME_RESULT_SCOPE_STORAGE_KEY);
    if (savedScope && isRuntimeResultScope(savedScope)) {
      setResultScope(savedScope);
    }
    setSinceDate(window.localStorage.getItem(RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY) || toAppDateInput(Date.now()));
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("runtime-monitor:navigation-visibility", { detail: { hidden: isNavbarHidden } }));

    return () => {
      window.dispatchEvent(new CustomEvent("runtime-monitor:navigation-visibility", { detail: { hidden: false } }));
    };
  }, [isNavbarHidden]);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    void load();
    const interval = window.setInterval(() => {
      void load(false, true);
    }, RUNTIME_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [load, preferencesReady]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeAxisNowMs(Date.now());
    }, TIME_AXIS_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const socket = io(buildRuntimeSocketUrl(), {
      transports: ["websocket", "polling"]
    });
    let scanRefreshTimer: number | null = null;

    const refreshRuntime = () => {
      void load(false, true);
    };
    const refreshLatestScan = () => {
      if (scanRefreshTimer) {
        window.clearTimeout(scanRefreshTimer);
      }
      scanRefreshTimer = window.setTimeout(refreshRuntime, 150);
    };

    socket.on("server:runtime-updated", refreshRuntime);
    socket.on("server:scan-updated", refreshLatestScan);

    return () => {
      socket.off("server:runtime-updated", refreshRuntime);
      socket.off("server:scan-updated", refreshLatestScan);
      if (scanRefreshTimer) {
        window.clearTimeout(scanRefreshTimer);
      }
      socket.disconnect();
    };
  }, [load]);

  const rows = useMemo(() => {
    return buildMachineRows(machines, sessions);
  }, [machines, sessions]);

  const gridStyle = { "--machine-columns": columnsPerRow } as CSSProperties;

  const updateColumnsPerRow = (value: number) => {
    const nextValue = clampColumnsPerRow(value);
    setColumnsPerRow(nextValue);
    window.localStorage.setItem(COLUMN_STORAGE_KEY, String(nextValue));
  };

  const updateDisplayOption = (key: keyof MachineRuntimeCardDisplayOptions, checked: boolean) => {
    const nextOptions = {
      ...displayOptions,
      [key]: checked
    };
    setDisplayOptions(nextOptions);
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(nextOptions));
  };

  const resetDisplayOptions = () => {
    setDisplayOptions(defaultDisplayOptions);
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(defaultDisplayOptions));
  };

  const updateResultScope = (scope: RuntimeResultScope) => {
    if (scope === "since" && !sinceDate) {
      const appToday = toAppDateInput(Date.now());
      setSinceDate(appToday);
      window.localStorage.setItem(RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY, appToday);
    }
    setResultScope(scope);
    window.localStorage.setItem(RUNTIME_RESULT_SCOPE_STORAGE_KEY, scope);
  };

  const updateSinceDate = (value: string) => {
    setSinceDate(value);
    window.localStorage.setItem(RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY, value);
  };

  return (
    <section className="min-w-0 space-y-1" aria-label={t("runtimeMonitor")}>
      <RuntimeDisplaySettingsMenu
        columnsPerRow={columnsPerRow}
        isLoading={isLoading}
        isNavbarHidden={isNavbarHidden}
        options={displayOptions}
        onColumnsPerRowChange={updateColumnsPerRow}
        onOptionChange={updateDisplayOption}
        onReload={() => void load(true)}
        onReset={resetDisplayOptions}
        onToggleNavbar={() => setIsNavbarHidden((current) => !current)}
      />

      <RuntimeResultScopeControl
        scope={resultScope}
        sinceDate={sinceDate}
        maxDate={toAppDateInput(Date.now())}
        isLoading={isLoading}
        error={scopeError}
        onScopeChange={updateResultScope}
        onSinceDateChange={updateSinceDate}
      />

      {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:[grid-template-columns:repeat(var(--machine-columns),minmax(0,1fr))]" style={gridStyle}>
          {rows.map((row) => (
            <MachineRuntimeCard
              key={row.machine.id}
              row={row}
              trendData={buildSessionServerTrendData(row.session)}
              resultCounts={resolveRuntimeResultCounts(row.machine.id, row.session, resultScope, resultCountsByMachine)}
              timeAxis={buildRuntimeChartTimeAxis(columnsPerRow, timeAxisNowMs)}
              displayOptions={displayOptions}
              showCommonLocalNgReason
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RuntimeDisplaySettingsMenu({
  columnsPerRow,
  isLoading,
  isNavbarHidden,
  options,
  onColumnsPerRowChange,
  onOptionChange,
  onReload,
  onReset,
  onToggleNavbar
}: {
  columnsPerRow: number;
  isLoading: boolean;
  isNavbarHidden: boolean;
  options: MachineRuntimeCardDisplayOptions;
  onColumnsPerRowChange: (value: number) => void;
  onOptionChange: (key: keyof MachineRuntimeCardDisplayOptions, checked: boolean) => void;
  onReload: () => void;
  onReset: () => void;
  onToggleNavbar: () => void;
}) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed right-2 z-[70] h-10 w-10 border bg-background/95 p-0 shadow-md backdrop-blur"
          style={{ top: "calc(var(--app-header-height, 0px) + 0.5rem)" }}
          aria-label={t("runtimeDisplaySettings")}
          title={t("runtimeDisplaySettings")}
        >
          <AppLogo className="h-8 w-8" imageClassName="h-6 w-6" />
          <span className="sr-only">{t("runtimeDisplaySettings")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("runtimeDisplaySettings")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="mb-2 text-xs text-muted-foreground">{t("machinesPerRow")}</div>
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={columnsPerRow === value ? "default" : "outline"}
                className="h-7 px-2"
                aria-pressed={columnsPerRow === value}
                onClick={(event) => {
                  event.preventDefault();
                  onColumnsPerRowChange(value);
                }}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        {displayOptionKeys.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={options[key]}
            onCheckedChange={(checked) => onOptionChange(key, Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
          >
            {t(displayOptionLabelKeys[key])}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          onReload();
        }}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
          {t("retry")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          onToggleNavbar();
        }}>
          {isNavbarHidden ? t("showNavbar") : t("hideNavbar")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onReset}>{t("showAllRuntimeInfo")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function readSavedDisplayOptions() {
  const rawValue = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
  if (!rawValue) {
    return defaultDisplayOptions;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return defaultDisplayOptions;
    }

    return displayOptionKeys.reduce<MachineRuntimeCardDisplayOptions>(
      (currentOptions, key) => ({
        ...currentOptions,
        [key]: typeof parsedValue[key] === "boolean" ? parsedValue[key] : defaultDisplayOptions[key]
      }),
      defaultDisplayOptions
    );
  } catch {
    return defaultDisplayOptions;
  }
}

function clampColumnsPerRow(value: number) {
  return Math.min(3, Math.max(1, Math.round(value)));
}

function buildRuntimeChartTimeAxis(columnsPerRow: number, nowMs: number): RuntimeChartTimeAxis {
  const columns = clampColumnsPerRow(columnsPerRow);

  if (columns === 1) {
    return {
      bucketMinutes: 30,
      maxBuckets: 25,
      maxTicks: 9,
      nowMs
    };
  }

  if (columns === 2) {
    return {
      bucketMinutes: 30,
      maxBuckets: 25,
      maxTicks: 7,
      nowMs
    };
  }

  return {
    bucketMinutes: 60,
    maxBuckets: 13,
    maxTicks: 5,
    nowMs
  };
}
