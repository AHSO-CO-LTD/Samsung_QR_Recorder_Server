"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { DashboardSectionHeader } from "./dashboard-section-header";
import {
  ScanTrendRangeControl,
  scanTrendScopes,
  type ScanTrendScope
} from "./scan-trend-range-control";

type ErrorRankingItem = {
  code: string;
  name_vi: string | null;
  name_en: string | null;
  occurrence_count: number;
};

type ErrorRankingChartItem = ErrorRankingItem & {
  label: string;
  ranking_label: string;
};

const chartConfig = {
  occurrence_count: {
    label: "NG",
    color: "#b91c1c"
  }
} satisfies ChartConfig;

const SCOPE_STORAGE_KEY = "dashboard-error-ranking-scope";

export function ErrorRankingChart() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<ErrorRankingItem[]>([]);
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

    void apiGet<ErrorRankingItem[]>(`/scans/error-ranking?scope=${scope}`)
      .then((result) => {
        if (isMounted && result.data) {
          setItems(result.data);
        }
      })
      .catch((currentError) => {
        if (!isMounted) {
          return;
        }
        const message = currentError instanceof Error ? currentError.message : t("errorRankingLoadFailed");
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
  }, [preferencesReady, reloadKey, scope, t]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US"), [locale]);
  const percentageFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }),
    [locale]
  );

  const totalOccurrences = useMemo(
    () => items.reduce((sum, item) => sum + item.occurrence_count, 0),
    [items]
  );

  const chartData = useMemo<ErrorRankingChartItem[]>(
    () =>
      items.map((item) => {
        const percentage = totalOccurrences > 0 ? (item.occurrence_count / totalOccurrences) * 100 : 0;
        return {
          ...item,
          label: (locale === "vi" ? item.name_vi?.trim() : item.name_en?.trim()) || item.code,
          ranking_label: `${numberFormatter.format(item.occurrence_count)} (${percentageFormatter.format(percentage)}%)`
        };
      }),
    [items, locale, numberFormatter, percentageFormatter, totalOccurrences]
  );
  const chartHeight = Math.max(280, chartData.length * 42 + 40);

  const updateScope = (value: ScanTrendScope) => {
    setScope(value);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, value);
  };

  return (
    <Card>
      <CardHeader>
        <DashboardSectionHeader
          title={t("errorRankingTitle")}
          description={t("errorRankingDesc")}
          actions={<ScanTrendRangeControl scope={scope} disabled={isLoading} onScopeChange={updateScope} />}
        />
      </CardHeader>
      <CardContent aria-busy={isLoading}>
        {isLoading ? (
          <div className="h-80 w-full animate-pulse rounded-md bg-muted" aria-label={t("loading")} />
        ) : null}
        {!isLoading && error ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-md border border-destructive/40 px-4 text-center text-sm text-destructive">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((current) => current + 1)}>
              {t("retry")}
            </Button>
          </div>
        ) : null}
        {!isLoading && !error && chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center rounded-md border px-4 text-sm text-muted-foreground">
            {t("errorRankingEmpty")}
          </div>
        ) : null}
        {!isLoading && !error && chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 104, top: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={220}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="occurrence_count" fill="var(--color-occurrence_count)" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="ranking_label" position="right" className="fill-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isScanTrendScope(value: string): value is ScanTrendScope {
  return scanTrendScopes.includes(value as ScanTrendScope);
}
