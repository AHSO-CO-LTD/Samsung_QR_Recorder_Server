"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toAppDateInput } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import {
  MachineRuntimeCard,
  SERVER_TREND_BUCKET_MINUTES,
  SERVER_TREND_HOURS,
  buildMachineRows,
  buildRuntimeSocketUrl,
  emptyTrendData,
  type RuntimeResultCounts,
  type ScanTrendPoint,
  type TrendByMachine
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
import { DevVirtualMachineButton } from "@/features/shared/dev-virtual-machine-button";
import { useVirtualMachineRuntimes } from "@/features/shared/use-virtual-machine-runtimes";
import { getVirtualRuntimeCounts } from "@/features/shared/virtual-machine-runtime";
import { NgSoundControls } from "@/features/sound/ng-sound-controls";
import { handleNgSoundScanEvent } from "@/features/sound/ng-sound-player";

const RUNTIME_REFRESH_MS = 5000;
const TREND_REFRESH_MS = 30000;

export function LocalMachinesOverview() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
  const [trendByMachine, setTrendByMachine] = useState<TrendByMachine>({});
  const [resultScope, setResultScope] = useState<RuntimeResultScope>("session");
  const [sinceDate, setSinceDate] = useState("");
  const [resultCountsByMachine, setResultCountsByMachine] = useState<Record<number, RuntimeResultCounts>>({});
  const [isScopeLoading, setIsScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const summaryLoadSequence = useRef(0);
  const { virtualMachines, createVirtualMachine } = useVirtualMachineRuntimes(user?.id);

  useEffect(() => {
    const savedScope = window.localStorage.getItem(RUNTIME_RESULT_SCOPE_STORAGE_KEY);
    if (savedScope && isRuntimeResultScope(savedScope)) {
      setResultScope(savedScope);
    }
    setSinceDate(window.localStorage.getItem(RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY) || toAppDateInput(Date.now()));
    setPreferencesReady(true);
  }, []);

  const load = useCallback(
    async (showToast = false, background = false) => {
      if (!background) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const [machineResult, sessionResult] = await Promise.allSettled([
          apiGet<Machine[]>("/machines"),
          apiGet<MachineRuntimeSession[]>("/runtime/sessions?take=200")
        ]);

        if (machineResult.status === "rejected") {
          throw machineResult.reason;
        }

        const nextMachines = (machineResult.value.data ?? []).filter((machine) => machine.is_active);
        const nextSessions = sessionResult.status === "fulfilled" ? sessionResult.value.data ?? [] : [];
        setMachines(nextMachines);
        setSessions(nextSessions);
        setError(null);

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
        if (!background) {
          setIsLoading(false);
        }
      }
    },
    [t]
  );

  const machineCodesKey = useMemo(() => machines.map((machine) => machine.machine_code).sort().join("|"), [machines]);

  const loadResultSummary = useCallback(
    async (showToast = false, background = false) => {
      if (!preferencesReady) {
        return;
      }

      const requestId = ++summaryLoadSequence.current;
      if (resultScope === "session") {
        setResultCountsByMachine({});
        setScopeError(null);
        setIsScopeLoading(false);
        return;
      }

      if (!background) {
        setIsScopeLoading(true);
        setResultCountsByMachine({});
      }
      setScopeError(null);

      try {
        const path = `/scans/runtime-summary?scope=${resultScope}${
          resultScope === "since" ? `&from=${encodeURIComponent(sinceDate)}` : ""
        }`;
        const result = await apiGet<RuntimeSummaryRow[]>(path);
        if (requestId !== summaryLoadSequence.current) {
          return;
        }
        setResultCountsByMachine(indexRuntimeSummary(result.data ?? []));
      } catch (currentError) {
        if (requestId !== summaryLoadSequence.current) {
          return;
        }
        const message = currentError instanceof Error ? currentError.message : t("runtimeSummaryLoadFailed");
        setResultCountsByMachine({});
        setScopeError(message);
        if (showToast) {
          toast.error(message);
        }
      } finally {
        if (!background && requestId === summaryLoadSequence.current) {
          setIsScopeLoading(false);
        }
      }
    },
    [preferencesReady, resultScope, sinceDate, t]
  );

  const loadTrendData = useCallback(
    async (showToast = false) => {
      const machineCodes = machineCodesKey ? machineCodesKey.split("|") : [];
      if (machineCodes.length === 0) {
        setTrendByMachine({});
        return;
      }

      try {
        const entries = await Promise.all(
          machineCodes.map(async (machineCode) => {
            const result = await apiGet<ScanTrendPoint[]>(
              `/scans/trend?hours=${SERVER_TREND_HOURS}&bucket_minutes=${SERVER_TREND_BUCKET_MINUTES}&machine_code=${encodeURIComponent(machineCode)}`
            );
            return [machineCode, result.data ?? emptyTrendData] as const;
          })
        );
        setTrendByMachine(Object.fromEntries(entries));
      } catch (trendError) {
        if (showToast) {
          toast.error(trendError instanceof Error ? trendError.message : t("error"));
        }
      }
    },
    [machineCodesKey, t]
  );

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load(false, true);
    }, RUNTIME_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const socket = io(buildRuntimeSocketUrl(), {
      transports: ["websocket", "polling"]
    });
    let scanRefreshTimer: number | null = null;

    const refreshFromRuntime = () => {
      void load(false, true);
      void loadTrendData();
      void loadResultSummary(false, true);
    };
    const refreshFromScan = (payload: unknown) => {
      handleNgSoundScanEvent(payload, t("ngSoundPlaybackFailed"));
      if (scanRefreshTimer) {
        window.clearTimeout(scanRefreshTimer);
      }
      scanRefreshTimer = window.setTimeout(() => {
        void load(false, true);
        void loadTrendData();
        void loadResultSummary(false, true);
      }, 150);
    };

    socket.on("server:runtime-updated", refreshFromRuntime);
    socket.on("server:scan-updated", refreshFromScan);

    return () => {
      socket.off("server:runtime-updated", refreshFromRuntime);
      socket.off("server:scan-updated", refreshFromScan);
      if (scanRefreshTimer) {
        window.clearTimeout(scanRefreshTimer);
      }
      socket.disconnect();
    };
  }, [load, loadResultSummary, loadTrendData]);

  useEffect(() => {
    void loadTrendData();
    const interval = window.setInterval(() => {
      void loadTrendData();
    }, TREND_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadTrendData]);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    void loadResultSummary();
    const interval = window.setInterval(() => {
      void loadResultSummary(false, true);
    }, RUNTIME_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadResultSummary, preferencesReady]);

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

  const connectedCount = rows.filter((row) => row.isConnected).length;

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
    <section className="min-w-0 space-y-3" aria-label={t("dashboardLocalMachines")}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{t("dashboardLocalMachines")}</h2>
            <Badge variant="default" className="shrink-0">{connectedCount}/{rows.length} {t("connectedMachines")}</Badge>
            <InfoTooltip content={t("dashboardLocalMachinesDesc")} />
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <DevVirtualMachineButton onCreate={createVirtualMachine} className="w-full sm:w-auto" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load(true);
              void loadResultSummary(true);
            }}
            disabled={isLoading || isScopeLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4", (isLoading || isScopeLoading) && "animate-spin")} aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      </div>

      <RuntimeResultScopeControl
        scope={resultScope}
        sinceDate={sinceDate}
        maxDate={toAppDateInput(Date.now())}
        isLoading={isScopeLoading}
        error={scopeError}
        onScopeChange={updateResultScope}
        onSinceDateChange={updateSinceDate}
        trailingContent={<NgSoundControls />}
      />

      {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {rows.length > 0 ? (
        <div className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 34rem), 1fr))" }}>
          {rows.map((row) => {
            const virtualRuntime = virtualRuntimeByMachineCode.get(row.machine.machine_code);
            return (
              <MachineRuntimeCard
                key={row.machine.id}
                row={row}
                trendData={virtualRuntime?.trendData ?? trendByMachine[row.machine.machine_code] ?? emptyTrendData}
                resultCounts={
                  virtualRuntime
                    ? getVirtualRuntimeCounts(virtualRuntime.session)
                    : resolveRuntimeResultCounts(row.machine.id, row.session, resultScope, resultCountsByMachine)
                }
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
