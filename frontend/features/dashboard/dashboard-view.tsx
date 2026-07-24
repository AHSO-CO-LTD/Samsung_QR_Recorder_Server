"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { LocalMachinesOverview } from "./local-machines-overview";
import { ScanTrendChart } from "./scan-trend-chart";

type ScanSummary = {
  ok: number;
  ng: number;
  pending: number;
  total: number;
  today_duplicates: number;
  total_ok: number;
  total_ng: number;
  total_duplicates: number;
  pending_sync: number;
  duplicate_days: number;
};

export function DashboardView() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<ScanSummary>({
    ok: 0,
    ng: 0,
    pending: 0,
    total: 0,
    today_duplicates: 0,
    total_ok: 0,
    total_ng: 0,
    total_duplicates: 0,
    pending_sync: 0,
    duplicate_days: 31
  });

  useEffect(() => {
    void apiGet<ScanSummary>("/scans/summary")
      .then((result) => {
        if (result.data) {
          setSummary(result.data);
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("error"));
      });
  }, [t]);

  const metrics = [
    { key: "todayOk", value: String(summary.ok), tone: "default", badgeKey: "todayPeriod", tooltipKey: "todayScanMetricRule" },
    { key: "todayNg", value: String(summary.ng), tone: "destructive", badgeKey: "todayPeriod", tooltipKey: "todayScanMetricRule" },
    {
      key: "todayDuplicates",
      value: String(summary.today_duplicates),
      tone: "outline",
      badgeKey: "todayPeriod",
      tooltipKey: "todayDuplicateMetricRule"
    },
    { key: "totalOk", value: String(summary.total_ok), tone: "default", badgeKey: "allHistory", tooltipKey: "totalScanMetricRule" },
    { key: "totalNg", value: String(summary.total_ng), tone: "destructive", badgeKey: "allHistory", tooltipKey: "totalScanMetricRule" },
    {
      key: "totalDuplicates",
      value: String(summary.total_duplicates),
      tone: "outline",
      badgeKey: "allHistory",
      tooltipKey: "totalDuplicateMetricRule"
    },
    {
      key: "duplicateWindow",
      value: `${summary.duplicate_days} ${t("daysUnit")}`,
      tone: "outline",
      badgeKey: "duplicateCheckTarget",
      tooltipKey: "duplicateRule"
    }
  ] as const;

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("runtimeMetrics")}>
        {metrics.map((metric) => (
          <Card key={metric.key}>
            <CardHeader>
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate">{t(metric.key)}</CardTitle>
                <InfoTooltip content={t(metric.tooltipKey)} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-3">
              <span className="text-3xl font-semibold">{metric.value}</span>
              <Badge variant={metric.tone}>{t(metric.badgeKey)}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <LocalMachinesOverview />

      <ScanTrendChart />
    </div>
  );
}
