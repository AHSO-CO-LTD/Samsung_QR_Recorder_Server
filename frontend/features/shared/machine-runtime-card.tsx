"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { API_BASE_URL } from "@/lib/api";
import { formatAppTime } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { MonoText } from "@/features/shared/data-view";
import { LatestScanStatusStrip } from "@/features/shared/latest-scan-status-strip";
import { ResponsiveRuntimeCount } from "@/features/shared/responsive-runtime-count";
import { formatRuntimeCount, formatRuntimeCountFull } from "@/features/shared/runtime-count";
import { formatIssueReason, resolveScanIssueReason } from "@/features/shared/scan-issue-reason";
import type { Machine, MachineRuntimeSession, ScanRecord } from "@/features/shared/types";
import type { Locale } from "@/lib/i18n";

export const SERVER_TREND_HOURS = 12;
export const SERVER_TREND_BUCKET_MINUTES = 30;

const okNgChartConfig = {
  ok: {
    label: "OK",
    color: "hsl(var(--chart-ok))"
  },
  ng: {
    label: "NG",
    color: "hsl(var(--chart-ng))"
  }
} satisfies ChartConfig;

export const emptyTrendData: ScanTrendPoint[] = buildEmptyTrendData();

export type MachineRuntimeRow = {
  machine: Machine;
  session?: MachineRuntimeSession;
  isConnected: boolean;
  isRunning: boolean;
  sortScore: number;
};

export type ScanTrendPoint = {
  date: string;
  ok: number;
  ng: number;
  pending: number;
  total: number;
  timestamp?: number;
};

export type RuntimeChartTimeAxis = {
  bucketMinutes: 30 | 60;
  maxBuckets: number;
  maxTicks: number;
  nowMs: number;
};

export type MachineRuntimeCardDisplayOptions = {
  machineInfo: boolean;
  currentProduct: boolean;
  duration: boolean;
  commonIssue: boolean;
  serverChart: boolean;
};

const defaultDisplayOptions: MachineRuntimeCardDisplayOptions = {
  machineInfo: true,
  currentProduct: true,
  duration: true,
  commonIssue: true,
  serverChart: true
};

export type TrendByMachine = Record<string, ScanTrendPoint[]>;

export type RuntimeResultCounts = {
  ok: number;
  ng: number;
  total: number;
};

type MachineRuntimeCardProps = {
  row: MachineRuntimeRow;
  trendData?: ScanTrendPoint[];
  resultCounts?: RuntimeResultCounts;
  timeAxis?: RuntimeChartTimeAxis;
  displayOptions?: Partial<MachineRuntimeCardDisplayOptions>;
  showCommonLocalNgReason?: boolean;
  showServerChart?: boolean;
};

export function MachineRuntimeCard({
  row,
  trendData = emptyTrendData,
  resultCounts,
  timeAxis,
  displayOptions,
  showCommonLocalNgReason = false,
  showServerChart = true
}: MachineRuntimeCardProps) {
  const { t, locale } = useI18n();
  const { machine, session, isConnected } = row;
  const currentProduct = resolveCurrentProductCode(session);
  const serverChartData = showServerChart ? buildIncrementalCumulativeChartData(trendData, timeAxis) : [];
  const serverCounts = resolveOkNgCountsFromChart(serverChartData, { ok: 0, ng: 0, total: 0 });
  const serverTotal = showServerChart ? resolveCumulativeTotal(serverChartData, 0) : 0;
  const displayedCounts = resultCounts
    ? {
        ok: toSafeCount(resultCounts.ok),
        ng: toSafeCount(resultCounts.ng),
        total: toSafeCount(resultCounts.total)
      }
    : {
        ok: serverCounts.ok,
        ng: serverCounts.ng,
        total: serverTotal
      };
  const activeDisplayOptions = { ...defaultDisplayOptions, ...displayOptions };
  const shouldShowCommonIssue = showCommonLocalNgReason && activeDisplayOptions.commonIssue;
  const shouldShowServerChart = showServerChart && activeDisplayOptions.serverChart;
  const commonIssueReason = shouldShowCommonIssue ? resolveCommonLocalNgReason(session, locale) : null;
  const latestScan = findLatestScanRecord([
    ...(session?.scan_records ?? []),
    ...(session?.latest_scan_record ? [session.latest_scan_record] : [])
  ]);
  const latestScanCode =
    normalizeScanValue(latestScan?.full_code_raw) ??
    normalizeScanValue(session?.last_code) ??
    normalizeScanValue(latestScan?.local_scan_id) ??
    normalizeScanValue(session?.last_local_scan_id);
  const latestScanResult = normalizeScanValue(latestScan?.final_status) ?? normalizeScanValue(session?.last_result);
  const latestScanAt = latestScan?.scan_at ?? session?.last_result_at ?? null;
  const runtimeStatus = resolveMachineRuntimeDisplayStatus(session, isConnected);
  const shouldShowDisconnectedState = !isConnected && runtimeStatus !== "STOPPED";
  const headerItems = [
    activeDisplayOptions.machineInfo ? <MachineIdentity key="machine" name={machine.machine_name || machine.machine_code} line={machine.line_name || "-"} /> : null,
    activeDisplayOptions.currentProduct ? <HeaderMetric key="product" label={t("colCurrentProduct")} value={<MonoText value={currentProduct ?? t("noCurrentProduct")} />} /> : null,
    activeDisplayOptions.duration ? <HeaderMetric key="duration" label={t("colDuration")} value={<RuntimeDuration session={session} />} /> : null,
    shouldShowCommonIssue ? (
      <HeaderMetric
        key="common-issue"
        label={t("commonIssueReason")}
        value={
          commonIssueReason ? (
            <span className="inline-flex min-w-0 items-center gap-2" title={commonIssueReason.reason}>
              <span className="truncate">{commonIssueReason.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">x{commonIssueReason.count}</span>
            </span>
          ) : (
            "-"
          )
        }
      />
    ) : null
  ].filter(Boolean);

  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        runtimeStatus === "RUNNING" && "border-emerald-500/70",
        runtimeStatus === "PAUSED" && "border-amber-500/70",
        runtimeStatus === "DISCONNECTED" && "border-destructive/60",
        shouldShowDisconnectedState && "bg-muted/40 text-muted-foreground"
      )}
    >
      {shouldShowDisconnectedState ? (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t("machineNotConnected")}
        </div>
      ) : null}

      <div className={cn(shouldShowDisconnectedState && "pt-6 grayscale")}>
        {headerItems.length > 0 ? (
        <CardHeader className="pb-2 sm:pb-2">
          <div
            className="grid min-w-0 gap-3 text-sm"
            style={{ gridTemplateColumns: buildHeaderGridTemplate(headerItems.length) }}
          >
            {headerItems}
          </div>
        </CardHeader>
        ) : null}

        <CardContent className="px-3 py-2 sm:px-4 sm:py-2">
          {shouldShowServerChart ? (
            <MachineRuntimeOverview
              ok={displayedCounts.ok}
              ng={displayedCounts.ng}
              total={displayedCounts.total}
              status={runtimeStatus}
            />
          ) : (
            <RuntimeStatusRow status={runtimeStatus} />
          )}
        </CardContent>
        <LatestScanStatusStrip code={latestScanCode} result={latestScanResult} scannedAt={latestScanAt} />
      </div>
    </Card>
  );
}

function buildHeaderGridTemplate(itemCount: number) {
  if (itemCount <= 1) {
    return "minmax(0, 1fr)";
  }
  if (itemCount === 2) {
    return "minmax(0, 1.3fr) minmax(0, 1fr)";
  }
  if (itemCount === 3) {
    return "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.9fr)";
  }
  return "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1.15fr)";
}

function MachineIdentity({ name, line }: { name: string; line: string }) {
  const lineText = `Line: ${line}`;

  return (
    <div className="min-w-0">
      <CardTitle className="truncate text-base">{name}</CardTitle>
      <div className="mt-1 truncate text-xs text-muted-foreground" title={lineText}>
        <span className="font-medium">Line:</span> {line}
      </div>
    </div>
  );
}

function HeaderMetric({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function RuntimeDuration({ session }: { session?: MachineRuntimeSession }) {
  const shouldTick = session?.status === "RUNNING" && !session.ended_at;
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    if (!shouldTick) {
      setNowMs(0);
      return;
    }

    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [shouldTick, session?.id, session?.started_at]);

  if (!session) {
    return "-";
  }

  return <span className="tabular-nums">{formatDuration(session.started_at, getDurationEnd(session, nowMs))}</span>;
}

function MachineRuntimeOverview({
  ok,
  ng,
  total,
  status
}: {
  ok: number;
  ng: number;
  total: number;
  status: MachineRuntimeStatus;
}) {
  const { t } = useI18n();

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)] md:items-stretch">
      <div className="flex min-w-0 items-center border-b pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3">
        <OkNgDonut ok={ok} ng={ng} total={total} />
      </div>
      <div className="grid min-h-52 grid-rows-4 gap-2">
        <RuntimeMetricRow label="OK" value={ok} tone="ok" />
        <RuntimeMetricRow label="NG" value={ng} tone="ng" />
        <RuntimeMetricRow label={t("colTotal")} value={total} tone="neutral" />
        <RuntimeStatusRow status={status} />
      </div>
    </div>
  );
}

function OkNgDonut({ ok, ng, total }: { ok: number; ng: number; total: number }) {
  const { t, locale } = useI18n();
  const data = [
    { key: "ok", name: "OK", value: ok, color: "var(--color-ok)" },
    { key: "ng", name: "NG", value: ng, color: "var(--color-ng)" }
  ];
  const hasData = total > 0;
  const compactTotal = formatRuntimeCount(total, locale);
  const fullTotal = formatRuntimeCountFull(total, locale);

  return (
    <div
      className="relative mx-auto h-52 w-full max-w-80"
      title={`${t("colTotal")}: ${fullTotal}`}
      aria-label={`${t("colTotal")}: ${fullTotal}`}
    >
      <ChartContainer config={okNgChartConfig} className="h-full w-full">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={hasData ? data : [{ key: "empty", name: t("empty"), value: 1, color: "hsl(var(--muted))" }]}
            dataKey="value"
            nameKey="name"
            innerRadius={65}
            outerRadius={92}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {(hasData ? data : [{ key: "empty", color: "hsl(var(--muted))" }]).map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-semibold tabular-nums">{compactTotal}</span>
        <span className="text-[11px] text-muted-foreground">{t("colTotal")}</span>
      </div>
    </div>
  );
}

function RuntimeMetricRow({ label, value, tone }: { label: string; value: number; tone: "ok" | "ng" | "neutral" }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(5rem,0.8fr)_minmax(0,1.2fr)] overflow-hidden rounded-md border text-sm",
        tone === "ok" && "border-emerald-500/35",
        tone === "ng" && "border-destructive/35"
      )}
    >
      <div
        className={cn(
          "px-3 py-2 font-semibold",
          tone === "ok" && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
          tone === "ng" && "bg-destructive/10 text-destructive",
          tone === "neutral" && "bg-muted"
        )}
      >
        {label}
      </div>
      <ResponsiveRuntimeCount value={value} />
    </div>
  );
}

function RuntimeStatusRow({ status }: { status: MachineRuntimeStatus }) {
  const { t } = useI18n();
  const label =
    status === "RUNNING"
      ? t("statusRunning")
      : status === "PAUSED"
        ? t("statusPaused")
        : status === "STOPPED"
          ? t("statusStopped")
          : status === "ERROR"
            ? t("statusError")
            : t("statusDisconnected");

  return (
    <div className="grid grid-cols-[minmax(5rem,0.8fr)_minmax(0,1.2fr)] overflow-hidden rounded-md border text-sm">
      <div className="bg-muted px-3 py-2 font-medium">{t("machineRuntimeStatus")}</div>
      <div
        className={cn(
          "border-l px-3 py-2 text-right font-semibold",
          status === "RUNNING" && "text-emerald-700 dark:text-emerald-300",
          status === "PAUSED" && "text-amber-700 dark:text-amber-300",
          status === "DISCONNECTED" && "text-destructive",
          status === "ERROR" && "text-destructive"
        )}
      >
        {label}
      </div>
    </div>
  );
}

type MachineRuntimeStatus = MachineRuntimeSession["status"];

export function resolveMachineRuntimeDisplayStatus(session: MachineRuntimeSession | undefined, isConnected: boolean): MachineRuntimeStatus {
  return session?.status ?? (isConnected ? "STOPPED" : "DISCONNECTED");
}

export function buildMachineRows(machines: Machine[], sessions: MachineRuntimeSession[]) {
  const sessionByMachine = indexSessionsByMachine(sessions);
  return machines
    .filter((machine) => machine.is_active)
    .map((machine): MachineRuntimeRow => {
      const session = sessionByMachine.get(machine.machine_code);
      const isRunning = session?.status === "RUNNING";
      const isPaused = session?.status === "PAUSED";
      const isOnline = machine.sync_state?.connection_status === "ONLINE";
      const isDisconnectedSession = session?.status === "DISCONNECTED";
      const isConnected = machine.is_active && !isDisconnectedSession && (isRunning || isPaused || isOnline);
      const sortScore = isRunning ? 0 : isPaused ? 1 : isOnline ? 2 : machine.is_active ? 3 : 4;
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

export function resolveCurrentProductCode(session?: MachineRuntimeSession | null) {
  return (
    normalizeProductCode(session?.current_product?.product_code) ??
    resolveScanProductCode(session?.latest_scan_record) ??
    resolveScanProductCode(findLatestScanRecord(session?.scan_records)) ??
    null
  );
}

export function resolveCommonLocalNgReason(session?: MachineRuntimeSession | null, locale: Locale = "vi") {
  const counts = new Map<string, number>();

  for (const record of session?.scan_records ?? []) {
    if (record.local_status !== "NG") {
      continue;
    }

    const reason = resolveScanIssueReason(normalizeNgReason(record.ng_reason) ?? "LOCAL_NG", record);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  let bestReason: string | null = null;
  let bestCount = 0;
  for (const [reason, count] of counts) {
    if (count > bestCount || (count === bestCount && bestReason && reason < bestReason)) {
      bestReason = reason;
      bestCount = count;
    }
  }

  return bestReason
    ? {
        reason: bestReason,
        label: formatIssueReason(bestReason, locale),
        count: bestCount
      }
    : null;
}

function resolveScanProductCode(scan?: ScanRecord | null) {
  return (
    normalizeProductCode(scan?.full_chassis_code) ??
    normalizeProductCode(scan?.profile?.chassis_code?.code_full) ??
    normalizeProductCode(scan?.chassis_scan_raw) ??
    null
  );
}

function findLatestScanRecord(records?: ScanRecord[]) {
  if (!records?.length) {
    return null;
  }

  return [...records].sort((left, right) => new Date(right.scan_at).getTime() - new Date(left.scan_at).getTime())[0] ?? null;
}

function normalizeProductCode(value?: string | number | null) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  if (!text || text.toUpperCase() === "UNKNOWN") {
    return null;
  }
  return text;
}

function normalizeScanValue(value?: string | number | null) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
}

function normalizeNgReason(value?: string | null) {
  const text = value?.trim();
  return text || null;
}

export function buildSessionServerTrendData(session?: MachineRuntimeSession): ScanTrendPoint[] {
  const records = [...(session?.scan_records ?? [])].sort((left, right) => new Date(left.scan_at).getTime() - new Date(right.scan_at).getTime());

  if (records.length === 0) {
    return [
      {
        date: formatLiveSampleTime(session?.last_seen_at),
        ok: 0,
        ng: 0,
        pending: 0,
        total: 0,
        timestamp: toTimestamp(session?.last_seen_at)
      }
    ];
  }

  return records.map(buildScanRecordPoint);
}

function buildScanRecordPoint(record: ScanRecord): ScanTrendPoint {
  const status = record.final_status;
  const ok = status === "OK" ? 1 : 0;
  const ng = status === "NG" ? 1 : 0;
  return {
    date: formatLiveSampleTime(record.scan_at),
    ok,
    ng,
    pending: 0,
    total: ok + ng,
    timestamp: toTimestamp(record.scan_at)
  };
}

function resolveOkNgCountsFromChart(data: ScanTrendPoint[], fallback: { ok: number; ng: number; total: number }) {
  const latest = data.at(-1);
  if (!latest) {
    return fallback;
  }

  return {
    ok: toSafeCount(latest.ok),
    ng: toSafeCount(latest.ng),
    total: toSafeCount(latest.total)
  };
}

function resolveCumulativeTotal(data: ScanTrendPoint[], fallback = 0) {
  return data.at(-1)?.total ?? fallback;
}

function buildIncrementalCumulativeChartData(data: ScanTrendPoint[], timeAxis?: RuntimeChartTimeAxis) {
  if (timeAxis) {
    return buildFixedBucketCumulativeChartData(data, timeAxis);
  }

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

function buildFixedBucketCumulativeChartData(data: ScanTrendPoint[], timeAxis: RuntimeChartTimeAxis) {
  const bucketMs = timeAxis.bucketMinutes * 60 * 1000;
  const latestBucketMs = ceilToBucket(timeAxis.nowMs, bucketMs);
  const rollingStartMs = latestBucketMs - (Math.max(1, timeAxis.maxBuckets) - 1) * bucketMs;
  const bucketStarts = buildBucketStarts(rollingStartMs, latestBucketMs, bucketMs);
  const incrementsByBucket = new Map<number, { ok: number; ng: number }>();
  let ok = 0;
  let ng = 0;

  for (const point of data) {
    const pointMs = point.timestamp;
    if (typeof pointMs !== "number" || !Number.isFinite(pointMs) || pointMs > timeAxis.nowMs) {
      continue;
    }

    const bucketMsKey = floorToBucket(pointMs, bucketMs);
    const pointOk = toSafeCount(point.ok);
    const pointNg = toSafeCount(point.ng);

    if (bucketMsKey < rollingStartMs) {
      ok += pointOk;
      ng += pointNg;
      continue;
    }

    const current = incrementsByBucket.get(bucketMsKey) ?? { ok: 0, ng: 0 };
    current.ok += pointOk;
    current.ng += pointNg;
    incrementsByBucket.set(bucketMsKey, current);
  }

  return bucketStarts.map((bucketStartMs) => {
    const increments = incrementsByBucket.get(bucketStartMs);
    ok += increments?.ok ?? 0;
    ng += increments?.ng ?? 0;

    return {
      date: formatBucketTime(new Date(bucketStartMs)),
      ok,
      ng,
      pending: 0,
      total: ok + ng,
      timestamp: bucketStartMs
    };
  });
}

function buildBucketStarts(startMs: number, endMs: number, bucketMs: number) {
  const bucketStarts: number[] = [];
  for (let bucketStartMs = startMs; bucketStartMs <= endMs; bucketStartMs += bucketMs) {
    bucketStarts.push(bucketStartMs);
  }
  return bucketStarts.length > 0 ? bucketStarts : [endMs];
}

function floorToBucket(valueMs: number, bucketMs: number) {
  return Math.floor(valueMs / bucketMs) * bucketMs;
}

function ceilToBucket(valueMs: number, bucketMs: number) {
  return Math.ceil(valueMs / bucketMs) * bucketMs;
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

function toSafeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toTimestamp(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function formatLiveSampleTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return formatAppTime(safeDate, "en", true);
}

export function buildRuntimeSocketUrl() {
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
  return formatAppTime(date, "en");
}

function getDurationEnd(session: MachineRuntimeSession, nowMs: number) {
  if (session.status === "RUNNING" && !session.ended_at && nowMs > 0) {
    return nowMs;
  }
  return session.ended_at ?? session.last_seen_at;
}

function formatDuration(start: string, end?: string | number | null) {
  const startMs = new Date(start).getTime();
  const endMs = typeof end === "number" ? end : end ? new Date(end).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}:${padDurationUnit(hours)}:${padDurationUnit(minutes)}:${padDurationUnit(seconds)}`;
}

function padDurationUnit(value: number) {
  return String(value).padStart(2, "0");
}
