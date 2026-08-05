"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import { DashboardSectionHeader } from "./dashboard-section-header";
import { formatTrendDateLabel } from "./scan-trend-label";
import {
  ScanTrendRangeControl,
  scanTrendScopes,
  type ScanTrendScope
} from "./scan-trend-range-control";

type ScanTrendPoint = {
  date: string;
  ok: number;
  ng: number;
  pending: number;
  total: number;
  rework: number;
};

type TrendMetric = "total" | "ok" | "ng" | "rework";

type TrendDefinition = {
  key: TrendMetric;
  labelKey: MessageKey;
  tooltipKey: MessageKey;
  color: string;
  comingSoon?: boolean;
};

const trendDefinitions: TrendDefinition[] = [
  {
    key: "total",
    labelKey: "dashboardTrendTotal",
    tooltipKey: "dashboardTrendTotalDesc",
    color: "#2563eb"
  },
  {
    key: "ok",
    labelKey: "dashboardTrendOk",
    tooltipKey: "dashboardTrendOkDesc",
    color: "#16a34a"
  },
  {
    key: "ng",
    labelKey: "dashboardTrendNg",
    tooltipKey: "dashboardTrendNgDesc",
    color: "#dc2626"
  },
  {
    key: "rework",
    labelKey: "dashboardTrendRework",
    tooltipKey: "dashboardTrendReworkDesc",
    color: "#ea580c",
    comingSoon: true
  }
];

const SCOPE_STORAGE_KEY = "dashboard-scan-trend-scope";

export function ScanTrendChart() {
  const { locale, t } = useI18n();
  const [chartData, setChartData] = useState<ScanTrendPoint[]>([]);
  const [scope, setScope] = useState<ScanTrendScope>("last_7_days");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const savedScope = window.localStorage.getItem(SCOPE_STORAGE_KEY);
    if (savedScope && isScanTrendScope(savedScope)) {
      setScope(savedScope);
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    void apiGet<Omit<ScanTrendPoint, "rework">[]>(`/scans/trend?scope=${scope}`)
      .then((result) => {
        if (!isMounted || !result.data) {
          return;
        }
        setChartData(
          result.data.map((point) => ({
            ...point,
            date: formatTrendDateLabel(point.date, locale),
            rework: 0
          }))
        );
      })
      .catch((currentError) => {
        if (!isMounted) {
          return;
        }
        const message = currentError instanceof Error ? currentError.message : t("scanTrendLoadFailed");
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [locale, preferencesReady, reloadKey, scope, t]);

  const totals = useMemo(
    () =>
      chartData.reduce(
        (current, point) => ({
          total: current.total + point.total,
          ok: current.ok + point.ok,
          ng: current.ng + point.ng,
          rework: 0
        }),
        { total: 0, ok: 0, ng: 0, rework: 0 }
      ),
    [chartData]
  );

  const updateScope = (value: ScanTrendScope) => {
    setScope(value);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, value);
  };

  return (
    <section className="min-w-0 space-y-3" aria-labelledby="dashboard-trend-heading">
      <DashboardSectionHeader
        headingId="dashboard-trend-heading"
        title={t("dashboardOutcomeTrends")}
        description={t("dashboardOutcomeTrendsDesc")}
        actions={<ScanTrendRangeControl scope={scope} disabled={isLoading} onScopeChange={updateScope} />}
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        {trendDefinitions.map((definition) => (
          <TrendChartCard
            key={definition.key}
            definition={definition}
            data={chartData}
            total={totals[definition.key]}
            isLoading={isLoading}
            error={error}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        ))}
      </div>
    </section>
  );
}

function TrendChartCard({
  definition,
  data,
  total,
  isLoading,
  error,
  onRetry
}: {
  definition: TrendDefinition;
  data: ScanTrendPoint[];
  total: number;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const chartConfig = {
    [definition.key]: {
      label: t(definition.labelKey),
      color: definition.color
    }
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: definition.color }} aria-hidden="true" />
            <CardTitle className="truncate text-base tracking-tight sm:text-lg">{t(definition.labelKey)}</CardTitle>
            <InfoTooltip content={t(definition.tooltipKey)} />
            {definition.comingSoon ? (
              <Badge className="border-orange-600/40 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" variant="outline">
                {t("comingSoon")}
              </Badge>
            ) : null}
          </div>
          <span className="shrink-0 text-2xl font-semibold tabular-nums" style={{ color: definition.color }}>
            {new Intl.NumberFormat().format(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent aria-busy={isLoading}>
        {isLoading ? (
          <div className="h-56 w-full animate-pulse rounded-md bg-muted" aria-label={t("loading")} />
        ) : null}
        {!isLoading && error ? (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-md border border-destructive/40 px-4 text-center text-sm text-destructive">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              {t("retry")}
            </Button>
          </div>
        ) : null}
        {!isLoading && !error && data.length === 0 ? (
          <div className="flex h-56 items-center justify-center rounded-md border px-4 text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : null}
        {!isLoading && !error && data.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <LineChart data={data} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} domain={[0, "auto"]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey={definition.key}
                type="linear"
                stroke={`var(--color-${definition.key})`}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isScanTrendScope(value: string): value is ScanTrendScope {
  return scanTrendScopes.includes(value as ScanTrendScope);
}
