"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet } from "@/lib/api";
import { toAppDateInput } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
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
};

const emptyChartData: ScanTrendPoint[] = Array.from({ length: 7 }, (_, index) => ({
  date: `T-${6 - index}`,
  ok: 0,
  ng: 0,
  pending: 0,
  total: 0
}));

const chartConfig = {
  ok: {
    label: "OK",
    color: "var(--chart-ok)"
  },
  ng: {
    label: "NG",
    color: "var(--chart-ng)"
  }
} satisfies ChartConfig;

const SCOPE_STORAGE_KEY = "dashboard-scan-trend-scope";
const SINCE_DATE_STORAGE_KEY = "dashboard-scan-trend-since-date";

export function ScanTrendChart() {
  const { t } = useI18n();
  const [chartData, setChartData] = useState<ScanTrendPoint[]>(emptyChartData);
  const [scope, setScope] = useState<ScanTrendScope>("last_7_days");
  const [sinceDate, setSinceDate] = useState("");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedScope = window.localStorage.getItem(SCOPE_STORAGE_KEY);
    if (savedScope && isScanTrendScope(savedScope)) {
      setScope(savedScope);
    }
    setSinceDate(window.localStorage.getItem(SINCE_DATE_STORAGE_KEY) || toAppDateInput(Date.now()));
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    const path = `/scans/trend?scope=${scope}${scope === "since" ? `&from=${encodeURIComponent(sinceDate)}` : ""}`;

    void apiGet<ScanTrendPoint[]>(path)
      .then((result) => {
        if (isMounted && result.data) {
          setChartData(result.data);
        }
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
  }, [preferencesReady, scope, sinceDate, t]);

  const updateScope = (value: ScanTrendScope) => {
    if (value === "since" && !sinceDate) {
      const appToday = toAppDateInput(Date.now());
      setSinceDate(appToday);
      window.localStorage.setItem(SINCE_DATE_STORAGE_KEY, appToday);
    }
    setScope(value);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, value);
  };

  const updateSinceDate = (value: string) => {
    setSinceDate(value);
    window.localStorage.setItem(SINCE_DATE_STORAGE_KEY, value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="truncate">{t("scanTrend")}</CardTitle>
            <InfoTooltip content={t("scanTrendDesc")} />
          </div>
          <ScanTrendRangeControl
            scope={scope}
            sinceDate={sinceDate}
            maxDate={toAppDateInput(Date.now())}
            disabled={isLoading}
            onScopeChange={updateScope}
            onSinceDateChange={updateSinceDate}
          />
        </div>
      </CardHeader>
      <CardContent aria-busy={isLoading}>
        {isLoading ? <div className="h-64 w-full animate-pulse rounded-md bg-muted sm:h-72" aria-label={t("loading")} /> : null}
        {error ? (
          <div className="flex h-64 items-center justify-center rounded-md border border-destructive/40 px-4 text-sm text-destructive sm:h-72">
            {error}
          </div>
        ) : null}
        {!isLoading && !error ? (
          <ChartContainer config={chartConfig} className="h-64 w-full sm:h-72">
            <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="ok" type="monotone" stroke="var(--color-ok)" fill="var(--color-ok)" fillOpacity={0.14} strokeWidth={2} />
              <Area dataKey="ng" type="monotone" stroke="var(--color-ng)" fill="var(--color-ng)" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isScanTrendScope(value: string): value is ScanTrendScope {
  return scanTrendScopes.includes(value as ScanTrendScope);
}
