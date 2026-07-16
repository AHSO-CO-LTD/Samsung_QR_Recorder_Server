"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, RefreshCw, WifiOff } from "lucide-react";
import { io } from "socket.io-client";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet, API_BASE_URL } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { MonoText, StatusBadge } from "@/features/shared/data-view";
import type { Machine, MachineRuntimeSession } from "@/features/shared/types";

const RUNTIME_REFRESH_MS = 5000;
const TREND_REFRESH_MS = 30000;
const SERVER_TREND_HOURS = 12;
const SERVER_TREND_BUCKET_MINUTES = 30;
const LIVE_SAMPLE_LIMIT = 60;

const okNgChartConfig = {
  total: {
    label: "Total",
    color: "hsl(var(--primary))"
  },
  ok: {
    label: "OK",
    color: "hsl(var(--chart-ok))"
  },
  ng: {
    label: "NG",
    color: "hsl(var(--chart-ng))"
  }
} satisfies ChartConfig;

const emptyTrendData: ScanTrendPoint[] = buildEmptyTrendData();

type MachineRuntimeRow = {
  machine: Machine;
  session?: MachineRuntimeSession;
  isConnected: boolean;
  isRunning: boolean;
  sortScore: number;
};

type ScanTrendPoint = {
  date: string;
  ok: number;
  ng: number;
  pending: number;
  total: number;
};

type TrendByMachine = Record<string, ScanTrendPoint[]>;

type RuntimeUpdatedPayload = {
  event?: string;
  machine_code?: string;
  data?: {
    ok_count?: number | null;
    ng_count?: number | null;
    total_count?: number | null;
    last_seen_at?: string | null;
    updated_at?: string | null;
  } | null;
};

export function LocalMachinesOverview() {
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
  const [trendByMachine, setTrendByMachine] = useState<TrendByMachine>({});
  const [liveByMachine, setLiveByMachine] = useState<TrendByMachine>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setLiveByMachine((current) => appendRuntimeSnapshotSamples(current, nextMachines, nextSessions));
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

    socket.on("server:runtime-updated", (payload: RuntimeUpdatedPayload) => {
      void load(false, true);
      void loadTrendData();
      const liveSample = buildLiveSample(payload);
      if (liveSample) {
        setLiveByMachine((current) => appendLiveSample(current, liveSample.machineCode, liveSample.point));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [load, loadTrendData]);

  useEffect(() => {
    void loadTrendData();
    const interval = window.setInterval(() => {
      void loadTrendData();
    }, TREND_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadTrendData]);

  const rows = useMemo(() => {
    return buildMachineRows(machines, sessions);
  }, [machines, sessions]);

  const connectedCount = rows.filter((row) => row.isConnected).length;

  return (
    <section className="min-w-0 space-y-3" aria-label={t("dashboardLocalMachines")}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold">{t("dashboardLocalMachines")}</h2>
            <InfoTooltip content={t("dashboardLocalMachinesDesc")} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="default">{connectedCount}/{rows.length} {t("connectedMachines")}</Badge>
            <span>{t("activeMachinesFirst")}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={isLoading} className="w-full sm:w-auto">
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>

      {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <MachineRuntimeCard
              key={row.machine.id}
              row={row}
              trendData={trendByMachine[row.machine.machine_code] ?? emptyTrendData}
              liveData={liveByMachine[row.machine.machine_code] ?? []}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MachineRuntimeCard({ row, trendData, liveData }: { row: MachineRuntimeRow; trendData: ScanTrendPoint[]; liveData: ScanTrendPoint[] }) {
  const { t } = useI18n();
  const { machine, session, isConnected, isRunning } = row;
  const currentProduct = session?.current_product?.product_code ?? null;
  const connectionStatus = isConnected ? (isRunning ? "RUNNING" : machine.sync_state?.connection_status ?? "ONLINE") : "DISCONNECTED";
  const runTime = session ? formatDuration(session.started_at, session.ended_at ?? session.last_seen_at) : "-";
  const { ok, ng } = resolveOkNgCounts(machine, session);
  const localChartData = buildLocalCumulativeChartData(liveData, ok, ng, machine.sync_state?.last_seen_at ?? session?.last_seen_at);
  const serverChartData = buildServerCumulativeChartData(trendData);
  const localTotal = resolveCumulativeTotal(localChartData, ok + ng);
  const serverTotal = resolveCumulativeTotal(serverChartData, 0);

  return (
    <Card className={cn("relative overflow-hidden", !isConnected && "border-muted bg-muted/40 text-muted-foreground")}>
      {!isConnected ? (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t("machineNotConnected")}
        </div>
      ) : null}

      <div className={cn(!isConnected && "pt-6 grayscale")}>
        <CardHeader className="space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <CardTitle className="truncate text-base">{machine.machine_name || machine.machine_code}</CardTitle>
              <MonoText value={machine.machine_code} />
              <StatusBadge value={connectionStatus} />
            </div>
            <Activity className={cn("h-5 w-5 shrink-0", isConnected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          </div>
          <div className="grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
            <HeaderMetric label={t("colCurrentProduct")} value={<MonoText value={currentProduct ?? t("noCurrentProduct")} />} />
            <HeaderMetric label={t("colDuration")} value={runTime} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            {isConnected ? (
              <MetricTrendBlock title={t("liveOkNgGraph")} total={localTotal} data={localChartData} emptyLabel={t("waitingLiveRuntime")} />
            ) : null}
            <MetricTrendBlock title={t("serverFinalOkNgGraph")} total={serverTotal} data={serverChartData} />
            <OkNgBar ok={ok} ng={ng} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">OK {ok}</div>
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-2 py-1 text-destructive">NG {ng}</div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function HeaderMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function MetricTrendBlock({ title, total, data, emptyLabel }: { title: string; total: number; data: ScanTrendPoint[]; emptyLabel?: string }) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{title}</span>
        <span>{t("colTotal")}: {total}</span>
      </div>
      {data.length > 0 ? (
        <MachineScanTrendChart data={data} />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}

function MachineScanTrendChart({ data }: { data: ScanTrendPoint[] }) {
  return (
    <ChartContainer config={okNgChartConfig} className="h-28 w-full">
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={20} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2.25} dot={false} activeDot={{ r: 3 }} animationDuration={250} />
        <Line dataKey="ok" type="monotone" stroke="var(--color-ok)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} animationDuration={250} />
        <Line dataKey="ng" type="monotone" stroke="var(--color-ng)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} animationDuration={250} />
      </LineChart>
    </ChartContainer>
  );
}

function OkNgBar({ ok, ng }: { ok: number; ng: number }) {
  const total = ok + ng;
  const okPercent = total > 0 ? Math.max(0, Math.min(100, (ok / total) * 100)) : 0;
  const ngPercent = total > 0 ? 100 - okPercent : 0;

  return (
    <div className="h-3 w-full overflow-hidden rounded-sm border bg-muted" aria-label={`OK ${ok}, NG ${ng}`}>
      {total > 0 ? (
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-500" style={{ width: `${okPercent}%` }} />
          <div className="h-full bg-destructive" style={{ width: `${ngPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function buildMachineRows(machines: Machine[], sessions: MachineRuntimeSession[]) {
  const sessionByMachine = indexSessionsByMachine(sessions);
  return machines
    .filter((machine) => machine.is_active)
    .map((machine): MachineRuntimeRow => {
      const session = sessionByMachine.get(machine.machine_code);
      const isRunning = session?.status === "RUNNING";
      const isOnline = machine.sync_state?.connection_status === "ONLINE";
      const isConnected = machine.is_active && (isRunning || isOnline);
      const sortScore = isRunning ? 0 : isOnline ? 1 : machine.is_active ? 2 : 3;
      return { machine, session, isConnected, isRunning, sortScore };
    })
    .sort((left, right) => left.sortScore - right.sortScore || left.machine.machine_code.localeCompare(right.machine.machine_code));
}

function indexSessionsByMachine(sessions: MachineRuntimeSession[]) {
  const sessionByMachine = new Map<string, MachineRuntimeSession>();
  for (const session of sessions) {
    if (!sessionByMachine.has(session.machine_code)) {
      sessionByMachine.set(session.machine_code, session);
    }
  }
  return sessionByMachine;
}

function resolveOkNgCounts(machine: Machine, session?: MachineRuntimeSession) {
  const ok = session?.ok_count ?? machine.sync_state?.local_ok_record ?? 0;
  const ng = session?.ng_count ?? machine.sync_state?.local_ng_record ?? 0;
  return {
    ok,
    ng,
    total: session?.total_count ?? machine.sync_state?.local_total_record ?? ok + ng
  };
}

function resolveCumulativeTotal(data: ScanTrendPoint[], fallback = 0) {
  return data.at(-1)?.total ?? fallback;
}

function buildLocalCumulativeChartData(data: ScanTrendPoint[], ok: number, ng: number, lastSeenAt?: string | null) {
  if (data.length > 0) {
    return [buildOriginPoint(), ...data.map(normalizeCumulativePoint)];
  }

  const total = ok + ng;
  if (total === 0) {
    return [];
  }

  return [
    buildOriginPoint(),
    {
      date: formatLiveSampleTime(lastSeenAt),
      ok,
      ng,
      pending: 0,
      total
    }
  ];
}

function buildServerCumulativeChartData(data: ScanTrendPoint[]) {
  const source = data.length > 0 ? data : emptyTrendData;
  let ok = 0;
  let ng = 0;

  return [
    buildOriginPoint(),
    ...source.map((point) => {
      ok += toSafeCount(point.ok);
      ng += toSafeCount(point.ng);
      return {
        ...point,
        ok,
        ng,
        pending: 0,
        total: ok + ng
      };
    })
  ];
}

function normalizeCumulativePoint(point: ScanTrendPoint) {
  const ok = toSafeCount(point.ok);
  const ng = toSafeCount(point.ng);
  const total = Math.max(toSafeCount(point.total), ok + ng);

  return {
    ...point,
    ok,
    ng,
    total
  };
}

function buildOriginPoint(): ScanTrendPoint {
  return {
    date: "0",
    ok: 0,
    ng: 0,
    pending: 0,
    total: 0
  };
}

function buildLiveSample(payload: RuntimeUpdatedPayload) {
  if (!payload.machine_code || !payload.data) {
    return null;
  }

  const ok = toCount(payload.data.ok_count);
  const ng = toCount(payload.data.ng_count);
  if (ok === null && ng === null) {
    return null;
  }

  const safeOk = ok ?? 0;
  const safeNg = ng ?? 0;
  const total = toCount(payload.data.total_count) ?? safeOk + safeNg;

  return {
    machineCode: payload.machine_code,
    point: {
      date: formatLiveSampleTime(payload.data.last_seen_at ?? payload.data.updated_at),
      ok: safeOk,
      ng: safeNg,
      pending: 0,
      total
    }
  };
}

function appendLiveSample(current: TrendByMachine, machineCode: string, point: ScanTrendPoint) {
  const samples = current[machineCode] ?? [];
  return {
    ...current,
    [machineCode]: [...samples, point].slice(-LIVE_SAMPLE_LIMIT)
  };
}

function appendRuntimeSnapshotSamples(current: TrendByMachine, machines: Machine[], sessions: MachineRuntimeSession[]) {
  const rows = buildMachineRows(machines, sessions);
  let next = current;

  for (const row of rows) {
    if (!row.isConnected) {
      continue;
    }

    const { ok, ng } = resolveOkNgCounts(row.machine, row.session);
    const total = ok + ng;
    if (total === 0) {
      continue;
    }

    next = appendLiveSample(next, row.machine.machine_code, {
      date: formatLiveSampleTime(),
      ok,
      ng,
      pending: 0,
      total
    });
  }

  return next;
}

function toCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toSafeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatLiveSampleTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function buildRuntimeSocketUrl() {
  return API_BASE_URL.replace(/\/api\/?$/, "") + "/machine-runtime";
}

function buildEmptyTrendData() {
  const bucketCount = Math.floor((SERVER_TREND_HOURS * 60) / SERVER_TREND_BUCKET_MINUTES) + 1;
  return Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date();
    date.setSeconds(0, 0);
    date.setMinutes(Math.floor(date.getMinutes() / SERVER_TREND_BUCKET_MINUTES) * SERVER_TREND_BUCKET_MINUTES, 0, 0);
    date.setMinutes(date.getMinutes() - (bucketCount - index - 1) * SERVER_TREND_BUCKET_MINUTES);
    return {
      date: formatBucketTime(date),
      ok: 0,
      ng: 0,
      pending: 0,
      total: 0
    };
  });
}

function formatBucketTime(date: Date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatDuration(start: string, end?: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
