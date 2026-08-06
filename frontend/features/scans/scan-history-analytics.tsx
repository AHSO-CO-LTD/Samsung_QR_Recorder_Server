"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import type { ScanAnalyticsResult } from "./scan-analytics-types";
import { ScanMachineErrorRankingCard } from "./scan-machine-error-ranking";
import { ScanResultSummaryCard } from "./scan-result-summary-card";

const emptyResult: ScanAnalyticsResult = {
  ok_count: 0,
  ng_count: 0,
  rework_count: 0,
  total_count: 0,
  machines: []
};

export function ScanHistoryAnalytics({
  summaryEndpoint,
  rankingEndpoint,
  refreshSignal,
  autoRefreshMs
}: {
  summaryEndpoint: string;
  rankingEndpoint: string;
  refreshSignal: number;
  autoRefreshMs?: number;
}) {
  const { locale, t } = useI18n();
  const [summaryResult, setSummaryResult] = useState<ScanAnalyticsResult>(emptyResult);
  const [rankingResult, setRankingResult] = useState<ScanAnalyticsResult>(emptyResult);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let hasNotifiedError = false;

    const load = async (showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }
      try {
        const [summaryResponse, rankingResponse] = await Promise.all([
          apiGet<ScanAnalyticsResult>(summaryEndpoint),
          apiGet<ScanAnalyticsResult>(rankingEndpoint)
        ]);
        if (!isMounted) {
          return;
        }
        setSummaryResult(summaryResponse.data ?? emptyResult);
        setRankingResult(rankingResponse.data ?? emptyResult);
        setError(null);
        hasNotifiedError = false;
      } catch (currentError) {
        if (!isMounted) {
          return;
        }
        const message = currentError instanceof Error ? currentError.message : t("scanAnalyticsLoadFailed");
        setError(message);
        if (!hasNotifiedError) {
          toast.error(message);
          hasNotifiedError = true;
        }
      } finally {
        if (isMounted && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void load(true);
    const interval = autoRefreshMs ? window.setInterval(() => void load(false), autoRefreshMs) : undefined;
    return () => {
      isMounted = false;
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [autoRefreshMs, rankingEndpoint, refreshSignal, reloadKey, summaryEndpoint, t]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US"), [locale]);
  const percentageFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }),
    [locale]
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-2" aria-label={t("loading")}>
        <AnalyticsSkeleton />
        <AnalyticsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ScanResultSummaryCard result={summaryResult} numberFormatter={numberFormatter} />
      <ScanMachineErrorRankingCard result={rankingResult} numberFormatter={numberFormatter} percentageFormatter={percentageFormatter} />
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <Card>
      <CardContent className="grid min-h-80 gap-4 md:grid-cols-2">
        <div className="animate-pulse rounded-md bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
