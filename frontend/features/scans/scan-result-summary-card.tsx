"use client";

import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatRuntimeCount, formatRuntimeCountFull } from "@/features/shared/runtime-count";
import { useI18n } from "@/lib/i18n-provider";
import type { ScanAnalyticsResult } from "./scan-analytics-types";

type SummaryChartItem = {
  key: "ok" | "ng" | "rework" | "empty";
  name: string;
  value: number;
  color: string;
};

type SummaryTooltipPayload = {
  payload?: SummaryChartItem;
};

const chartConfig = {
  ok: { label: "OK", color: "var(--chart-ok)" },
  ng: { label: "NG", color: "var(--chart-ng)" },
  rework: { label: "REWORK", color: "var(--chart-rework)" }
} satisfies ChartConfig;

export function ScanResultSummaryCard({ result, numberFormatter }: { result: ScanAnalyticsResult; numberFormatter: Intl.NumberFormat }) {
  const { t, locale } = useI18n();
  const reworkInDonut = Math.min(result.rework_count, result.ng_count);
  const data: SummaryChartItem[] = [
    { key: "ok", name: "OK", value: result.ok_count, color: "var(--color-ok)" },
    { key: "ng", name: "NG", value: Math.max(0, result.ng_count - reworkInDonut), color: "var(--color-ng)" },
    { key: "rework", name: "REWORK", value: reworkInDonut, color: "var(--color-rework)" }
  ];
  const hasData = result.total_count > 0;
  const chartData = hasData
    ? data
    : [{ key: "empty", name: t("empty"), value: 1, color: "hsl(var(--muted))" } satisfies SummaryChartItem];
  const compactTotal = formatRuntimeCount(result.total_count, locale);
  const fullTotal = formatRuntimeCountFull(result.total_count, locale);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("scanResultSummaryTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("scanResultSummaryDesc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(14rem,1fr)_minmax(13rem,0.9fr)] md:items-stretch">
          <div className="relative flex min-h-64 items-center justify-center border-b pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4">
            <ChartContainer config={chartConfig} className="h-60 w-full max-w-72">
              <PieChart accessibilityLayer>
                <ChartTooltip content={<SummaryTooltip numberFormatter={numberFormatter} />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={66}
                  outerRadius={100}
                  paddingAngle={data.filter((item) => item.value > 0).length > 1 ? 2 : 0}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {chartData.map((item) => (
                    <Cell key={item.key} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="pointer-events-auto flex h-[128px] w-[128px] cursor-help flex-col items-center justify-center rounded-full"
                title={`${t("scanResultSummaryTotal")}: ${fullTotal}`}
                aria-label={`${t("scanResultSummaryTotal")}: ${fullTotal}`}
              >
                <span className="font-mono text-3xl font-semibold tabular-nums">{compactTotal}</span>
                <span className="text-[11px] text-muted-foreground">{t("scanResultSummaryTotal")}</span>
              </div>
            </div>
          </div>

          <div className="grid min-h-64 grid-rows-4 gap-3">
            <SummaryMetricRow label="OK" value={result.ok_count} tone="ok" numberFormatter={numberFormatter} />
            <SummaryMetricRow label="NG" value={result.ng_count} tone="ng" numberFormatter={numberFormatter} />
            <SummaryMetricRow label="REWORK / NG" value={`${numberFormatter.format(result.rework_count)} / ${numberFormatter.format(result.ng_count)}`} tone="rework" numberFormatter={numberFormatter} />
            <SummaryMetricRow label={t("scanResultSummaryTotal")} value={result.total_count} tone="total" numberFormatter={numberFormatter} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryMetricRow({
  label,
  value,
  tone,
  numberFormatter
}: {
  label: string;
  value: number | string;
  tone: "ok" | "ng" | "rework" | "total";
  numberFormatter: Intl.NumberFormat;
}) {
  const toneClasses = {
    ok: "border-runtime-ok bg-runtime-ok/10",
    ng: "border-runtime-ng bg-runtime-ng/10",
    rework: "border-orange-600 bg-orange-600/10",
    total: "border-primary bg-primary/10"
  }[tone];
  const labelClasses = {
    ok: "bg-runtime-ok text-[var(--runtime-black)]",
    ng: "bg-runtime-ng text-[var(--runtime-white)]",
    rework: "bg-orange-600 text-white",
    total: "bg-primary text-primary-foreground"
  }[tone];

  return (
    <div className={`grid grid-cols-[minmax(5rem,0.8fr)_minmax(0,1.2fr)] overflow-hidden rounded-md border text-sm ${toneClasses}`}>
      <div className={`flex items-center px-3 font-semibold ${labelClasses}`}>{label}</div>
      <div className="flex items-center justify-end px-4 font-mono text-base font-semibold tabular-nums">
        {typeof value === "number" ? numberFormatter.format(value) : value}
      </div>
    </div>
  );
}

function SummaryTooltip({
  active,
  payload,
  numberFormatter
}: {
  active?: boolean;
  payload?: SummaryTooltipPayload[];
  numberFormatter: Intl.NumberFormat;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item || item.key === "empty") {
    return null;
  }

  return (
    <div className="min-w-36 rounded-md border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-5 text-xs">
        <span className="font-medium">{item.name}</span>
        <span className="font-mono font-semibold">{numberFormatter.format(item.value)}</span>
      </div>
    </div>
  );
}
