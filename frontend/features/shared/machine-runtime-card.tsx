"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { API_BASE_URL } from "@/lib/api";
import { formatAppTime } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { MonoText } from "@/features/shared/data-view";
import { LatestScanStatusStrip } from "@/features/shared/latest-scan-status-strip";
import type { Machine, MachineRuntimeSession, ScanRecord } from "@/features/shared/types";
import type { Locale } from "@/lib/i18n";

export const SERVER_TREND_HOURS = 12;
export const SERVER_TREND_BUCKET_MINUTES = 30;

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

type MachineRuntimeCardProps = {
  row: MachineRuntimeRow;
  trendData?: ScanTrendPoint[];
  timeAxis?: RuntimeChartTimeAxis;
  displayOptions?: Partial<MachineRuntimeCardDisplayOptions>;
  showCommonLocalNgReason?: boolean;
  showServerChart?: boolean;
};

export function MachineRuntimeCard({
  row,
  trendData = emptyTrendData,
  timeAxis,
  displayOptions,
  showCommonLocalNgReason = false,
  showServerChart = true
}: MachineRuntimeCardProps) {
  const { t, locale } = useI18n();
  const { machine, session, isConnected, isRunning } = row;
  const currentProduct = resolveCurrentProductCode(session);
  const serverChartData = showServerChart ? buildIncrementalCumulativeChartData(trendData, timeAxis) : [];
  const serverCounts = resolveOkNgCountsFromChart(serverChartData, { ok: 0, ng: 0, total: 0 });
  const serverTotal = showServerChart ? resolveCumulativeTotal(serverChartData, 0) : 0;
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
  const headerItems = [
    activeDisplayOptions.machineInfo ? <MachineIdentity key="machine" name={machine.machine_name || machine.machine_code} code={machine.machine_code} /> : null,
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
    <Card className={cn("relative overflow-hidden", isConnected && isRunning && "border-emerald-500/70", !isConnected && "border-muted bg-muted/40 text-muted-foreground")}>
      {!isConnected ? (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t("machineNotConnected")}
        </div>
      ) : null}

      <div className={cn(!isConnected && "pt-6 grayscale")}>
        {headerItems.length > 0 ? (
        <CardHeader>
          <div
            className="grid min-w-0 gap-3 border-b pb-3 text-sm"
            style={{ gridTemplateColumns: buildHeaderGridTemplate(headerItems.length) }}
          >
            {headerItems}
          </div>
        </CardHeader>
        ) : null}

        {shouldShowServerChart ? (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <MetricTrendBlock title={t("serverFinalOkNgGraph")} total={serverTotal} data={serverChartData} maxTicks={timeAxis?.maxTicks} />
            <OkNgSummary ok={serverCounts.ok} ng={serverCounts.ng} />
          </div>
        </CardContent>
        ) : null}
        <LatestScanStatusStrip code={latestScanCode} result={latestScanResult} />
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

function MachineIdentity({ name, code }: { name: string; code: string }) {
  return (
    <div className="min-w-0">
      <CardTitle className="truncate text-base">{name}</CardTitle>
      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{code}</div>
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

function MetricTrendBlock({
  title,
  total,
  data,
  emptyLabel,
  maxTicks
}: {
  title: string;
  total: number;
  data: ScanTrendPoint[];
  emptyLabel?: string;
  maxTicks?: number;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{title}</span>
        <span>{t("colTotal")}: {total}</span>
      </div>
      {data.length > 0 ? (
        <MachineScanTrendChart data={data} maxTicks={maxTicks} />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}

function MachineScanTrendChart({ data, maxTicks }: { data: ScanTrendPoint[]; maxTicks?: number }) {
  const ticks = maxTicks ? selectChartTicks(data, maxTicks) : undefined;

  return (
    <ChartContainer config={okNgChartConfig} className="h-28 w-full">
      <LineChart data={data} margin={{ left: 4, right: 24, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={20} tickMargin={8} ticks={ticks} interval={ticks ? 0 : "preserveEnd"} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2.25} dot={false} activeDot={{ r: 3 }} animationDuration={250} />
        <Line dataKey="ok" type="monotone" stroke="var(--color-ok)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} animationDuration={250} />
        <Line dataKey="ng" type="monotone" stroke="var(--color-ng)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} animationDuration={250} />
      </LineChart>
    </ChartContainer>
  );
}

function selectChartTicks(data: ScanTrendPoint[], maxTicks: number) {
  const labels = data.map((point) => point.date);
  const uniqueLabels = Array.from(new Set(labels));
  const safeMaxTicks = Math.max(2, Math.floor(maxTicks));

  if (uniqueLabels.length <= safeMaxTicks) {
    return uniqueLabels;
  }

  const selected = new Set<string>();
  const lastIndex = uniqueLabels.length - 1;
  for (let index = 0; index < safeMaxTicks; index += 1) {
    selected.add(uniqueLabels[Math.round((index * lastIndex) / (safeMaxTicks - 1))]);
  }

  return uniqueLabels.filter((label) => selected.has(label));
}

function OkNgSummary({ ok, ng }: { ok: number; ng: number }) {
  return (
    <div className="space-y-2">
      <OkNgBar ok={ok} ng={ng} />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">OK {ok}</div>
        <div className="rounded-md border border-destructive/25 bg-destructive/10 px-2 py-1 text-destructive">NG {ng}</div>
      </div>
    </div>
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

export function buildMachineRows(machines: Machine[], sessions: MachineRuntimeSession[]) {
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

    const reason = normalizeNgReason(record.ng_reason) ?? "LOCAL_NG";
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

export function formatIssueReason(reason: string, locale: Locale) {
  const category = getIssueReasonCategory(reason);
  const labels: Record<IssueReasonCategory, Record<Locale, string>> = {
    duplicate: {
      vi: "Lỗi scan trùng lặp",
      en: "Duplicate scan error"
    },
    led: {
      vi: "Lỗi scan LED",
      en: "LED scan error"
    },
    qr: {
      vi: "Lỗi scan QR",
      en: "QR scan error"
    },
    config: {
      vi: "Lỗi scan cấu hình",
      en: "Scan configuration error"
    },
    machine: {
      vi: "Lỗi scan máy",
      en: "Machine scan error"
    },
    connection: {
      vi: "Lỗi scan kết nối",
      en: "Scan connection error"
    },
    sync: {
      vi: "Lỗi scan đồng bộ",
      en: "Scan sync error"
    },
    data: {
      vi: "Lỗi dữ liệu scan",
      en: "Scan data error"
    },
    local: {
      vi: "Lỗi scan local",
      en: "Local scan error"
    },
    server: {
      vi: "Lỗi scan server",
      en: "Server scan error"
    },
    unknown: {
      vi: "Lỗi scan khác",
      en: "Other scan error"
    }
  };

  return labels[category][locale];
}

function getIssueReasonCategory(reason: string): IssueReasonCategory {
  const normalized = reason.trim().toUpperCase();
  const exactCategoryByReason: Record<string, IssueReasonCategory> = {
    SERVER_DUPLICATE: "duplicate",
    LOCAL_DUPLICATE: "duplicate",
    LED_SUFFIX_NOT_MATCH: "led",
    LED_VENDOR_NOT_MATCH: "led",
    LED_CODE_NOT_FOUND: "led",
    FULL_LED_CODE_INVALID: "led",
    FULL_CODE_INVALID: "qr",
    FULL_CODE_INVALID_LENGTH: "qr",
    FULL_VENDOR_NOT_MATCH: "qr",
    FULL_FACTORY_NOT_MATCH: "qr",
    CHASSIS_NOT_MATCH: "qr",
    PROFILE_NOT_FOUND: "config",
    PROFILE_VERSION_OUTDATED: "config",
    CHASSIS_CODE_NOT_FOUND: "config",
    PROFILE_LED_CODES_REQUIRED: "config",
    PROFILE_LED_CODES_LIMIT_EXCEEDED: "config",
    PROFILE_LED_SLOT_INVALID: "config",
    PROFILE_LED_CODE_DUPLICATED: "config",
    PROFILE_LED_SLOT_DUPLICATED: "config",
    MACHINE_NOT_FOUND: "machine",
    SERVER_DISCONNECTED: "connection",
    SYNC_BATCH_HAS_NG: "sync",
    PAYLOAD_INVALID: "data",
    LOCAL_NG: "local"
  };

  if (exactCategoryByReason[normalized]) {
    return exactCategoryByReason[normalized];
  }
  if (normalized.includes("DUPLICATE") || normalized.includes("TRUNG")) {
    return "duplicate";
  }
  if (normalized.includes("LED")) {
    return "led";
  }
  if (normalized.includes("QR") || normalized.includes("FULL") || normalized.includes("CHASSIS") || normalized.includes("CODE")) {
    return "qr";
  }
  if (normalized.includes("PROFILE") || normalized.includes("CONFIG") || normalized.includes("SETTING")) {
    return "config";
  }
  if (normalized.includes("MACHINE")) {
    return "machine";
  }
  if (normalized.includes("DISCONNECT") || normalized.includes("OFFLINE") || normalized.includes("TIMEOUT")) {
    return "connection";
  }
  if (normalized.includes("SYNC")) {
    return "sync";
  }
  if (normalized.includes("PAYLOAD") || normalized.includes("DATA")) {
    return "data";
  }
  if (normalized.includes("LOCAL")) {
    return "local";
  }
  if (normalized.includes("SERVER")) {
    return "server";
  }
  return "unknown";
}

type IssueReasonCategory = "duplicate" | "led" | "qr" | "config" | "machine" | "connection" | "sync" | "data" | "local" | "server" | "unknown";

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
