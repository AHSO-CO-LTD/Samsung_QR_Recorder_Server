"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Cell, Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
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
import type { Machine, MachineRuntimeSession, ScanRecord } from "@/features/shared/types";
import type { RuntimeResultCounts } from "@/features/shared/runtime-result-counts";

export const SERVER_TREND_HOURS = 12;
export const SERVER_TREND_BUCKET_MINUTES = 30;

const resultChartConfig = {
  ok: {
    label: "OK",
    color: "var(--chart-ok)"
  },
  ng: {
    label: "NG",
    color: "var(--chart-ng)"
  },
  rework: {
    label: "REWORK",
    color: "var(--chart-rework)"
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
  rework: number;
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
  machineStatus: boolean;
  serverChart: boolean;
};

const defaultDisplayOptions: MachineRuntimeCardDisplayOptions = {
  machineInfo: true,
  currentProduct: true,
  duration: true,
  machineStatus: true,
  serverChart: true
};

export type TrendByMachine = Record<string, ScanTrendPoint[]>;

export type { RuntimeResultCounts } from "@/features/shared/runtime-result-counts";

type MachineRuntimeCardProps = {
  row: MachineRuntimeRow;
  trendData?: ScanTrendPoint[];
  resultCounts?: RuntimeResultCounts;
  timeAxis?: RuntimeChartTimeAxis;
  displayOptions?: Partial<MachineRuntimeCardDisplayOptions>;
  showServerChart?: boolean;
  ngHref?: string;
  reworkHref?: string;
};

export function MachineRuntimeCard({
  row,
  trendData = emptyTrendData,
  resultCounts,
  timeAxis,
  displayOptions,
  showServerChart = true,
  ngHref,
  reworkHref
}: MachineRuntimeCardProps) {
  const { t, locale } = useI18n();
  const { machine, session, isConnected } = row;
  const currentProduct = resolveCurrentProductCode(session);
  const serverChartData = showServerChart ? buildIncrementalCumulativeChartData(trendData, timeAxis) : [];
  const serverCounts = resolveResultCountsFromChart(serverChartData, { ok: 0, ng: 0, rework: 0, total: 0 });
  const serverTotal = showServerChart ? resolveCumulativeTotal(serverChartData, 0) : 0;
  const displayedCounts = resultCounts
    ? {
        ok: toSafeCount(resultCounts.ok),
        ng: toSafeCount(resultCounts.ng),
        rework: toSafeCount(resultCounts.rework),
        total: toSafeCount(resultCounts.total)
      }
    : {
        ok: serverCounts.ok,
        ng: serverCounts.ng,
        rework: serverCounts.rework,
        total: serverTotal
      };
  const activeDisplayOptions = { ...defaultDisplayOptions, ...displayOptions };
  const shouldShowServerChart = showServerChart && activeDisplayOptions.serverChart;
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
  const shouldDimDisconnectedState = !isConnected && runtimeStatus !== "STOPPED";
  const headerItems = [
    activeDisplayOptions.machineInfo ? (
      <MachineIdentity
        key="machine"
        name={machine.machine_name || machine.machine_code}
        line={machine.line_name || "-"}
        isVirtual={Boolean(machine.is_virtual)}
      />
    ) : null,
    activeDisplayOptions.currentProduct ? <HeaderMetric key="product" label={t("colCurrentProduct")} value={<MonoText value={currentProduct ?? t("noCurrentProduct")} />} /> : null,
    activeDisplayOptions.duration ? <HeaderMetric key="duration" label={t("colDuration")} value={<RuntimeDuration session={session} />} /> : null,
    activeDisplayOptions.machineStatus ? (
      <MachineStatusMetric key="machine-status" status={runtimeStatus} />
    ) : null
  ].filter(Boolean);

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-2",
        runtimeStatus === "RUNNING" && "border-runtime-ok",
        runtimeStatus === "PAUSED" && "border-runtime-warning",
        runtimeStatus === "STOPPED" && "border-runtime-stopped",
        runtimeStatus === "DISCONNECTED" && "border-runtime-ng",
        runtimeStatus === "ERROR" && "border-runtime-ng",
        shouldDimDisconnectedState && "bg-muted/40 text-muted-foreground"
      )}
    >
      <div>
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
              rework={displayedCounts.rework}
              total={displayedCounts.total}
              ngHref={ngHref}
              reworkHref={reworkHref}
            />
          ) : null}
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

function MachineIdentity({ name, line, isVirtual }: { name: string; line: string; isVirtual: boolean }) {
  const { t, locale } = useI18n();
  const lineText = `Line: ${line}`;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <CardTitle className="truncate text-base">{name}</CardTitle>
        {isVirtual ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {t("virtualMachine")}
          </Badge>
        ) : null}
      </div>
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

function MachineStatusMetric({ status }: { status: MachineRuntimeStatus }) {
  const { t } = useI18n();
  const label = getMachineRuntimeStatusLabel(status, t);
  const statusClassName = cn(
    "rounded-sm border px-2 py-1",
    status === "RUNNING" && "border-runtime-ok/70 bg-runtime-ok/10 text-runtime-ok",
    status === "PAUSED" && "border-runtime-warning/70 bg-runtime-warning/15 text-runtime-warning",
    status === "STOPPED" && "border-runtime-stopped/70 bg-runtime-stopped/10 text-runtime-stopped",
    (status === "DISCONNECTED" || status === "ERROR") && "border-runtime-ng/70 bg-runtime-ng/10 text-runtime-ng"
  );

  return (
    <HeaderMetric
      label={t("machineRuntimeStatus")}
      className={statusClassName}
      value={<span className="font-semibold">{label}</span>}
    />
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
  rework,
  total,
  ngHref,
  reworkHref
}: {
  ok: number;
  ng: number;
  rework: number;
  total: number;
  ngHref?: string;
  reworkHref?: string;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)] md:items-stretch">
      <div className="flex min-w-0 items-center border-b pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3">
        <ResultDonut ok={ok} ng={ng} rework={rework} total={total} />
      </div>
      <div className="grid min-h-52 grid-rows-4 gap-2">
        <RuntimeMetricRow label="OK" value={ok} tone="ok" />
        <RuntimeMetricRow label="NG" value={ng} tone="ng" href={ngHref} />
        <RuntimeMetricRow label="REWORK / NG" value={`${formatRuntimeCountFull(rework, locale)} / ${formatRuntimeCountFull(ng, locale)}`} tone="rework" href={reworkHref} />
        <RuntimeMetricRow label={t("colTotal")} value={total} tone="total" />
      </div>
    </div>
  );
}

function ResultDonut({ ok, ng, rework, total }: { ok: number; ng: number; rework: number; total: number }) {
  const { t, locale } = useI18n();
  const reworkInDonut = Math.min(rework, ng);
  const data = [
    { key: "ok", name: "OK", value: ok, color: "var(--color-ok)" },
    { key: "ng", name: "NG", value: Math.max(0, ng - reworkInDonut), color: "var(--color-ng)" },
    { key: "rework", name: "REWORK", value: reworkInDonut, color: "var(--color-rework)" }
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
      <ChartContainer config={resultChartConfig} className="h-full w-full">
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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="pointer-events-auto flex h-[128px] w-[128px] cursor-help flex-col items-center justify-center rounded-full"
          title={`${t("colTotal")}: ${fullTotal}`}
          aria-label={`${t("colTotal")}: ${fullTotal}`}
        >
          <span className="font-mono text-3xl font-semibold tabular-nums">{compactTotal}</span>
          <span className="text-[11px] text-muted-foreground">{t("colTotal")}</span>
        </div>
      </div>
    </div>
  );
}

function RuntimeMetricRow({
  label,
  value,
  tone,
  href
}: {
  label: string;
  value: number | string;
  tone: "ok" | "ng" | "rework" | "total";
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "grid h-full grid-cols-[minmax(5rem,0.8fr)_minmax(0,1.2fr)] overflow-hidden rounded-md border text-sm transition-colors",
        tone === "ok" && "border-runtime-ok bg-runtime-ok/10",
        tone === "ng" && "border-runtime-ng bg-runtime-ng/10",
        tone === "rework" && "border-[var(--runtime-rework)] bg-[var(--runtime-rework)]/10",
        tone === "total" && "border-primary bg-primary/10",
        href && tone === "ng" && "hover:border-runtime-ng/80 hover:bg-runtime-ng/20",
        href && tone === "rework" && "hover:border-[var(--runtime-rework)]/80 hover:bg-[var(--runtime-rework)]/20"
      )}
    >
      <div
        className={cn(
          "px-3 py-2 font-semibold",
          tone === "ok" && "bg-runtime-ok text-[var(--runtime-black)]",
          tone === "ng" && "bg-runtime-ng text-[var(--runtime-white)]",
          tone === "rework" && "bg-[var(--runtime-rework)] text-white",
          tone === "total" && "bg-primary text-primary-foreground"
        )}
      >
        {label}
      </div>
      {typeof value === "number" ? <ResponsiveRuntimeCount value={value} /> : <div className="flex items-center justify-end px-3 font-mono text-sm font-semibold tabular-nums">{value}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} title={`Xem lịch sử quét ${label}`} className="block min-h-0 min-w-0 transition-transform active:scale-[0.99]">
        {content}
      </Link>
    );
  }

  return content;
}

type MachineRuntimeStatus = MachineRuntimeSession["status"];

function getMachineRuntimeStatusLabel(status: MachineRuntimeStatus, t: ReturnType<typeof useI18n>["t"]) {
  if (status === "RUNNING") return t("statusRunning");
  if (status === "PAUSED") return t("statusPaused");
  if (status === "STOPPED") return t("statusStopped");
  if (status === "ERROR") return t("statusError");
  return t("statusDisconnected");
}

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

export function buildSessionServerTrendData(session?: MachineRuntimeSession): ScanTrendPoint[] {
  const records = [...(session?.scan_records ?? [])].sort((left, right) => new Date(left.scan_at).getTime() - new Date(right.scan_at).getTime());

  if (records.length === 0) {
    return [
      {
        date: formatLiveSampleTime(session?.last_seen_at),
        ok: 0,
        ng: 0,
        rework: 0,
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
  const ng = status === "NG" || status === "NG_REWORK" ? 1 : 0;
  const rework = status === "REWORK" ? 1 : 0;
  return {
    date: formatLiveSampleTime(record.scan_at),
    ok,
    ng,
    rework,
    pending: 0,
    total: ok + ng,
    timestamp: toTimestamp(record.scan_at)
  };
}

function resolveResultCountsFromChart(data: ScanTrendPoint[], fallback: RuntimeResultCounts) {
  const latest = data.at(-1);
  if (!latest) {
    return fallback;
  }

  return {
    ok: toSafeCount(latest.ok),
    ng: toSafeCount(latest.ng),
    rework: toSafeCount(latest.rework),
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
  let rework = 0;

  return [
    buildOriginPoint(),
    ...source.map((point) => {
      ok += toSafeCount(point.ok);
      ng += toSafeCount(point.ng);
      rework += toSafeCount(point.rework);
      return {
        ...point,
        ok,
        ng,
        rework,
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
  const incrementsByBucket = new Map<number, { ok: number; ng: number; rework: number }>();
  let ok = 0;
  let ng = 0;
  let rework = 0;

  for (const point of data) {
    const pointMs = point.timestamp;
    if (typeof pointMs !== "number" || !Number.isFinite(pointMs) || pointMs > timeAxis.nowMs) {
      continue;
    }

    const bucketMsKey = floorToBucket(pointMs, bucketMs);
    const pointOk = toSafeCount(point.ok);
    const pointNg = toSafeCount(point.ng);
    const pointRework = toSafeCount(point.rework);

    if (bucketMsKey < rollingStartMs) {
      ok += pointOk;
      ng += pointNg;
      rework += pointRework;
      continue;
    }

    const current = incrementsByBucket.get(bucketMsKey) ?? { ok: 0, ng: 0, rework: 0 };
    current.ok += pointOk;
    current.ng += pointNg;
    current.rework += pointRework;
    incrementsByBucket.set(bucketMsKey, current);
  }

  return bucketStarts.map((bucketStartMs) => {
    const increments = incrementsByBucket.get(bucketStartMs);
    ok += increments?.ok ?? 0;
    ng += increments?.ng ?? 0;
    rework += increments?.rework ?? 0;

    return {
      date: formatBucketTime(new Date(bucketStartMs)),
      ok,
      ng,
      rework,
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
    rework: 0,
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
      rework: 0,
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
