"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { RuntimeDisplaySettingsMenu } from "@/features/shared/runtime-display-settings-menu";
import { MachineRuntimeCardSkeleton } from "@/features/shared/machine-runtime-card-skeleton";
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
import type { Machine, MachineRuntimeSession, ScanRecord } from "@/features/shared/types";
import { DevVirtualMachineButton } from "@/features/shared/dev-virtual-machine-button";
import { useVirtualMachineRuntimes } from "@/features/shared/use-virtual-machine-runtimes";
import { getVirtualRuntimeCounts } from "@/features/shared/virtual-machine-runtime";
import { NgSoundControls } from "@/features/sound/ng-sound-controls";
import { handleNgSoundScanEvent } from "@/features/sound/ng-sound-player";
import { DashboardSectionHeader } from "./dashboard-section-header";

const RUNTIME_REFRESH_MS = 15_000;
const SOCKET_SYNC_REFRESH_MS = 2_000;
const DASHBOARD_REQUEST_TIMEOUT_MS = 15_000;

type DashboardRuntimeOverview = {
  generated_at: string;
  machines: Machine[];
  sessions: MachineRuntimeSession[];
  result_summary: RuntimeSummaryRow[];
  trends: TrendByMachine;
};

type DashboardScanUpdate = {
  machine_code: string;
  local_scan_id: string;
  server_scan_id: number | null;
  final_status: ScanRecord["final_status"] | null;
  full_code_raw: string | null;
  full_chassis_code: string | null;
  scan_at: string;
  source: "LIVE" | "BATCH";
  is_replay: boolean;
};

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
  const [timeAxisNowMs, setTimeAxisNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overviewLoadSequence = useRef(0);
  const activeOverviewRequest = useRef<AbortController | null>(null);
  const machineIdByCode = useRef(new Map<string, number>());
  const resultScopeRef = useRef<RuntimeResultScope>(resultScope);
  const { virtualMachines, createVirtualMachine } = useVirtualMachineRuntimes(user?.id);
  const {
    columnsPerRow,
    displayOptions,
    updateColumnsPerRow,
    updateDisplayOption,
    resetDisplayOptions
  } = useRuntimeDisplayPreferences();

  useEffect(() => {
    const savedScope = window.localStorage.getItem(RUNTIME_RESULT_SCOPE_STORAGE_KEY);
    if (savedScope && isRuntimeResultScope(savedScope)) {
      setResultScope(savedScope);
    }
    setSinceDate(window.localStorage.getItem(RUNTIME_RESULT_SINCE_DATE_STORAGE_KEY) || toAppDateInput(Date.now()));
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    resultScopeRef.current = resultScope;
  }, [resultScope]);

  const loadOverview = useCallback(
    async (showToast = false, background = false) => {
      if (!preferencesReady) return;
      if (background && activeOverviewRequest.current) return;

      activeOverviewRequest.current?.abort();
      const controller = new AbortController();
      activeOverviewRequest.current = controller;
      const requestId = ++overviewLoadSequence.current;

      if (!background) {
        setIsLoading(true);
        setIsScopeLoading(true);
        setError(null);
        setScopeError(null);
      }

      try {
        const params = new URLSearchParams({
          scope: resultScope,
          trend_hours: String(SERVER_TREND_HOURS),
          bucket_minutes: String(SERVER_TREND_BUCKET_MINUTES)
        });
        if (resultScope === "since") params.set("from", sinceDate);

        const result = await apiGet<DashboardRuntimeOverview>(`/dashboard/runtime-overview?${params.toString()}`, {
          signal: controller.signal,
          timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS
        });
        if (requestId !== overviewLoadSequence.current) return;

        const overview = result.data;
        const nextMachines = (overview?.machines ?? []).filter((machine) => machine.is_active);
        machineIdByCode.current = new Map(nextMachines.map((machine) => [machine.machine_code, machine.id] as const));
        setMachines(nextMachines);
        setSessions(overview?.sessions ?? []);
        setResultCountsByMachine(indexRuntimeSummary(overview?.result_summary ?? []));
        setTrendByMachine(overview?.trends ?? {});
        setTimeAxisNowMs(Date.now());
        setError(null);
        setScopeError(null);
      } catch (currentError) {
        if (requestId !== overviewLoadSequence.current || isAbortedRequest(currentError)) return;
        const message = currentError instanceof Error ? currentError.message : t("runtimeSummaryLoadFailed");
        if (!background) {
          setError(message);
          setScopeError(message);
        }
        if (showToast) toast.error(message);
      } finally {
        if (activeOverviewRequest.current === controller) activeOverviewRequest.current = null;
        if (!background && requestId === overviewLoadSequence.current) {
          setIsLoading(false);
          setIsScopeLoading(false);
        }
      }
    },
    [preferencesReady, resultScope, sinceDate, t]
  );

  const applyScanUpdate = useCallback((payload: unknown) => {
    const update = parseDashboardScanUpdate(payload);
    if (!update || update.is_replay || !update.final_status) return;
    const finalStatus = update.final_status;

    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.machine_code !== update.machine_code) return session;
        const latestScan = buildRealtimeScanRecord(update, session.latest_scan_record);
        const countDelta = getResultDelta(finalStatus);
        return {
          ...session,
          total_count: session.total_count + countDelta.total,
          ok_count: session.ok_count + countDelta.ok,
          ng_count: session.ng_count + countDelta.ng,
          last_result: finalStatus,
          last_code: update.full_code_raw ?? update.local_scan_id,
          last_local_scan_id: update.local_scan_id,
          last_result_at: update.scan_at,
          latest_scan_record: latestScan
        };
      })
    );

    setResultCountsByMachine((currentCounts) => {
      const machineId = machineIdByCode.current.get(update.machine_code);
      if (!machineId || resultScopeRef.current === "session") return currentCounts;
      const previous = currentCounts[machineId] ?? { ok: 0, ng: 0, rework: 0, total: 0 };
      const delta = getResultDelta(finalStatus);
      const next = {
        ok: previous.ok + delta.ok,
        ng: previous.ng + delta.ng,
        rework: previous.rework + delta.rework,
        total: previous.total + delta.ok + delta.ng
      };
      return { ...currentCounts, [machineId]: next };
    });

    setTrendByMachine((currentTrends) => ({
      ...currentTrends,
      [update.machine_code]: appendTrendUpdate(currentTrends[update.machine_code] ?? [], update)
    }));
    setTimeAxisNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    void loadOverview(false, false);
    const interval = window.setInterval(() => {
      void loadOverview(false, true);
    }, RUNTIME_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadOverview, preferencesReady]);

  useEffect(() => {
    const socket = io(buildRuntimeSocketUrl(), {
      transports: ["websocket", "polling"]
    });
    let syncTimer: number | null = null;
    const scheduleServerSync = () => {
      if (syncTimer !== null) return;
      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        void loadOverview(false, true);
      }, SOCKET_SYNC_REFRESH_MS);
    };
    const refreshFromScan = (payload: unknown) => {
      handleNgSoundScanEvent(payload, t("ngSoundPlaybackFailed"));
      applyScanUpdate(payload);
      scheduleServerSync();
    };

    socket.on("server:runtime-updated", scheduleServerSync);
    socket.on("server:scan-updated", refreshFromScan);
    return () => {
      socket.off("server:runtime-updated", scheduleServerSync);
      socket.off("server:scan-updated", refreshFromScan);
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      socket.disconnect();
    };
  }, [applyScanUpdate, loadOverview, t]);

  useEffect(() => () => activeOverviewRequest.current?.abort(), []);

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
    <section className="min-w-0 space-y-3" aria-label={t("dashboardLocalMachines")}>
      <DashboardSectionHeader
        title={t("dashboardLocalMachines")}
        metadata={
          <>
            <Badge variant="default" className="shrink-0">{connectedCount}/{rows.length} {t("connectedMachines")}</Badge>
            <InfoTooltip content={t("dashboardLocalMachinesDesc")} />
          </>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <DevVirtualMachineButton onCreate={createVirtualMachine} className="w-full sm:w-auto" />
            <RuntimeDisplaySettingsMenu
              columnsPerRow={columnsPerRow}
              isLoading={isLoading || isScopeLoading}
              options={displayOptions}
              onColumnsPerRowChange={updateColumnsPerRow}
              onOptionChange={updateDisplayOption}
              onReload={() => {
                void loadOverview(true, false);
              }}
              onReset={resetDisplayOptions}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadOverview(true, false);
              }}
              disabled={isLoading || isScopeLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={cn("h-4 w-4", (isLoading || isScopeLoading) && "animate-spin")} aria-hidden="true" />
              {t("retry")}
            </Button>
          </div>
        }
      />

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

      {isLoading ? <MachineRuntimeCardSkeleton label={t("loading")} /> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {rows.length > 0 ? (
        <div
          className="grid min-w-0 grid-cols-1 gap-3 lg:[grid-template-columns:repeat(var(--machine-columns),minmax(0,1fr))]"
          style={gridStyle}
        >
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
            const reworkParams = new URLSearchParams(ngParams);
            reworkParams.set("final_status", "REWORK");
            const reworkHref = `/scans?${reworkParams.toString()}`;

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
                timeAxis={buildRuntimeChartTimeAxis(columnsPerRow, timeAxisNowMs)}
                displayOptions={displayOptions}
                ngHref={ngHref}
                reworkHref={reworkHref}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function parseDashboardScanUpdate(payload: unknown): DashboardScanUpdate | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const machineCode = typeof value.machine_code === "string" ? value.machine_code.trim() : "";
  const localScanId = typeof value.local_scan_id === "string" ? value.local_scan_id.trim() : "";
  const finalStatus = typeof value.final_status === "string" && ["OK", "NG", "NG_REWORK", "REWORK", "PENDING"].includes(value.final_status)
    ? (value.final_status as ScanRecord["final_status"])
    : null;
  if (!machineCode || !localScanId) return null;

  return {
    machine_code: machineCode,
    local_scan_id: localScanId,
    server_scan_id: typeof value.server_scan_id === "number" ? value.server_scan_id : null,
    final_status: finalStatus,
    full_code_raw: typeof value.full_code_raw === "string" ? value.full_code_raw : null,
    full_chassis_code: typeof value.full_chassis_code === "string" ? value.full_chassis_code : null,
    scan_at: typeof value.scan_at === "string" ? value.scan_at : new Date().toISOString(),
    source: value.source === "BATCH" ? "BATCH" : "LIVE",
    is_replay: value.is_replay === true
  };
}

function buildRealtimeScanRecord(update: DashboardScanUpdate, current?: ScanRecord | null): ScanRecord {
  const updateTimestamp = new Date(update.scan_at).getTime();
  const currentTimestamp = current ? new Date(current.scan_at).getTime() : Number.NEGATIVE_INFINITY;
  if (current && Number.isFinite(currentTimestamp) && currentTimestamp > updateTimestamp) return current;

  return {
    id: update.server_scan_id ?? current?.id ?? -1,
    local_scan_id: update.local_scan_id,
    full_code_raw: update.full_code_raw ?? current?.full_code_raw ?? update.local_scan_id,
    full_chassis_code: update.full_chassis_code ?? current?.full_chassis_code,
    full_vendor_char: current?.full_vendor_char ?? "",
    duplicate_key: current?.duplicate_key ?? "",
    local_status: current?.local_status ?? (update.final_status === "OK" ? "OK" : update.final_status === "REWORK" ? "REWORK" : "NG"),
    server_status: current?.server_status ?? (update.final_status === "OK" || update.final_status === "REWORK" ? "OK" : "NG"),
    final_status: update.final_status ?? current?.final_status ?? "PENDING",
    ng_reason: current?.ng_reason ?? null,
    scan_at: update.scan_at
  };
}

function getResultDelta(status: ScanRecord["final_status"]) {
  return {
    ok: status === "OK" ? 1 : 0,
    ng: status === "NG" || status === "NG_REWORK" ? 1 : 0,
    rework: status === "REWORK" ? 1 : 0,
    total: status === "OK" || status === "NG" || status === "NG_REWORK" || status === "REWORK" ? 1 : 0,
    pending: status === "PENDING" ? 1 : 0
  };
}

function appendTrendUpdate(current: ScanTrendPoint[], update: DashboardScanUpdate) {
  if (!update.final_status) return current;
  const scanTimestamp = new Date(update.scan_at).getTime();
  const oldestAllowedTimestamp = Date.now() - SERVER_TREND_HOURS * 60 * 60 * 1000;
  if (!Number.isFinite(scanTimestamp) || scanTimestamp < oldestAllowedTimestamp) return current;

  const bucketMs = SERVER_TREND_BUCKET_MINUTES * 60 * 1000;
  const timestamp = Math.floor(scanTimestamp / bucketMs) * bucketMs;
  const delta = getResultDelta(update.final_status);
  const existingIndex = current.findIndex((point) => point.timestamp === timestamp);
  const next = [...current];
  const existing = existingIndex >= 0 ? next[existingIndex] : undefined;
  const ok = (existing?.ok ?? 0) + delta.ok;
  const ng = (existing?.ng ?? 0) + delta.ng;
  const point: ScanTrendPoint = {
    date: `${String(new Date(timestamp).getHours()).padStart(2, "0")}:${String(new Date(timestamp).getMinutes()).padStart(2, "0")}`,
    ok,
    ng,
    rework: (existing?.rework ?? 0) + delta.rework,
    pending: (existing?.pending ?? 0) + delta.pending,
    total: ok + ng,
    timestamp
  };
  if (existingIndex >= 0) next[existingIndex] = point;
  else next.push(point);
  return next.sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
}

function isAbortedRequest(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
