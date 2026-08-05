"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toAppDateInput } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import {
  MachineRuntimeCard,
  buildMachineRows,
  buildRuntimeSocketUrl,
  buildSessionServerTrendData,
  type RuntimeResultCounts
} from "@/features/shared/machine-runtime-card";
import { RuntimeDisplaySettingsMenu } from "@/features/shared/runtime-display-settings-menu";
import {
  buildRuntimeChartTimeAxis,
  useRuntimeDisplayPreferences
} from "@/features/shared/runtime-display-preferences";
import {
  RUNTIME_RESULT_SCOPE_STORAGE_KEY,
  RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY,
  RuntimeResultScopeControl,
  buildScanTimeRangeFromScope,
  indexRuntimeSummary,
  isRuntimeResultScope,
  resolveRuntimeResultCounts,
  type RuntimeResultScope,
  type RuntimeSummaryRow
} from "@/features/shared/runtime-result-scope-control";
import type { Machine, MachineRuntimeSession } from "@/features/shared/types";
import { DevVirtualMachineButton } from "@/features/shared/dev-virtual-machine-button";
import { useVirtualMachineRuntimes } from "@/features/shared/use-virtual-machine-runtimes";
import { getVirtualRuntimeCounts } from "@/features/shared/virtual-machine-runtime";
import { NgSoundControls } from "@/features/sound/ng-sound-controls";
import { handleNgSoundScanEvent } from "@/features/sound/ng-sound-player";

const RUNTIME_REFRESH_MS = 5000;
const TIME_AXIS_REFRESH_MS = 30000;

export function RuntimeMonitorView() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
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
  const { virtualMachines, createVirtualMachine } = useVirtualMachineRuntimes(user?.id);
  const {
    columnsPerRow,
    displayOptions,
    updateColumnsPerRow,
    updateDisplayOption,
    resetDisplayOptions
  } = useRuntimeDisplayPreferences();

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
    const refreshLatestScan = (payload: unknown) => {
      handleNgSoundScanEvent(payload, t("ngSoundPlaybackFailed"));
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
  }, [load, t]);

  const rows = useMemo(() => {
    return buildMachineRows(
      [...machines, ...virtualMachines.map((item) => item.machine)],
      [...sessions, ...virtualMachines.map((item) => item.session)]
    );
  }, [machines, sessions, virtualMachines]);

  const virtualRuntimeByMachineCode = useMemo(
    () => new Map(virtualMachines.map((item) => [item.machine.machine_code, item] as const)),
    [virtualMachines]
  );

  const gridStyle = { "--machine-columns": columnsPerRow } as CSSProperties;

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
      <DevVirtualMachineButton
        onCreate={createVirtualMachine}
        className="fixed right-14 z-[70] min-h-10 shadow-md"
        style={{ top: "calc(var(--app-header-height, 0px) + 0.5rem)" }}
      />

      <RuntimeDisplaySettingsMenu
        columnsPerRow={columnsPerRow}
        isLoading={isLoading}
        isNavbarHidden={isNavbarHidden}
        options={displayOptions}
        placement="floating"
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
        trailingContent={<NgSoundControls />}
      />

      {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {rows.length > 0 ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:[grid-template-columns:repeat(var(--machine-columns),minmax(0,1fr))]" style={gridStyle}>
          {rows.map((row) => {
            const virtualRuntime = virtualRuntimeByMachineCode.get(row.machine.machine_code);
            const timeRange = buildScanTimeRangeFromScope(resultScope, sinceDate, row.session?.started_at);
            const ngParams = new URLSearchParams();
            if (row.machine.line_name) {
              ngParams.set("line_name", row.machine.line_name);
            }
            ngParams.set("final_status", "NG");
            if (timeRange.from) ngParams.set("from", timeRange.from);
            if (timeRange.to) ngParams.set("to", timeRange.to);
            const ngHref = `/scans?${ngParams.toString()}`;

            return (
              <MachineRuntimeCard
                key={row.machine.id}
                row={row}
                trendData={virtualRuntime?.trendData ?? buildSessionServerTrendData(row.session)}
                resultCounts={
                  virtualRuntime
                    ? getVirtualRuntimeCounts(virtualRuntime.session)
                    : resolveRuntimeResultCounts(row.machine.id, row.session, resultScope, resultCountsByMachine)
                }
                timeAxis={buildRuntimeChartTimeAxis(columnsPerRow, timeAxisNowMs)}
                displayOptions={displayOptions}
                showCommonLocalNgReason
                ngHref={ngHref}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
