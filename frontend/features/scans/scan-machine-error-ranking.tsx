"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n-provider";
import type { ScanAnalyticsResult } from "./scan-analytics-types";

type ChartItem = {
  key: string;
  label: string;
  count: number;
  ranking_label: string;
};

const chartConfig = {
  count: {
    label: "Kết quả",
    color: "var(--chart-ng)"
  }
} satisfies ChartConfig;

export function ScanMachineErrorRankingCard({
  result,
  numberFormatter,
  percentageFormatter
}: {
  result: ScanAnalyticsResult;
  numberFormatter: Intl.NumberFormat;
  percentageFormatter: Intl.NumberFormat;
}) {
  const { locale, t } = useI18n();

  const rankingType = result.ranking_type ?? "machine";
  const rankingStatus = result.ranking_status ?? "NG";
  const barColor = rankingStatus === "REWORK" ? "var(--chart-rework)" : "var(--chart-ng)";

  const { title, description, noDataMessage, chartData } = useMemo(() => {
    if (rankingType === "error_type") {
      const items = result.errors ?? [];
      const mapped: ChartItem[] = items.map((err) => {
        const errorName = (locale === "vi" ? err.name_vi?.trim() : err.name_en?.trim()) || err.code;
        return {
          key: err.code,
          label: errorName,
          count: err.ng_count,
          ranking_label: `${numberFormatter.format(err.ng_count)} (${percentageFormatter.format(err.percentage)}%)`
        };
      });

      return {
        title: t("scanErrorTypeStatusRankingTitle", { status: rankingStatus }),
        description: t("scanErrorTypeStatusRankingDesc", { status: rankingStatus }),
        noDataMessage: t("scanErrorTypeStatusRankingNoErrors", { status: rankingStatus }),
        chartData: mapped
      };
    }

    if (rankingType === "profile") {
      const items = result.profiles ?? [];
      const mapped: ChartItem[] = items.map((prof) => ({
        key: String(prof.profile_id),
        label: prof.profile_name,
        count: prof.ng_count,
        ranking_label: `${numberFormatter.format(prof.ng_count)} (${percentageFormatter.format(prof.percentage)}%)`
      }));

      return {
        title: t("scanProfileStatusRankingTitle", { status: rankingStatus }),
        description: t("scanProfileStatusRankingDesc", { status: rankingStatus }),
        noDataMessage: t("scanProfileErrorRankingNoProfiles"),
        chartData: mapped
      };
    }

    // Default: machine
    const items = result.machines ?? [];
    const mapped: ChartItem[] = items.map((machine) => {
      const machineName = machine.machine_name.trim();
      const lineName = machine.line_name?.trim();
      const machineLabel =
        machineName && machineName.toLocaleLowerCase() !== machine.machine_code.toLocaleLowerCase()
          ? `${machine.machine_code} - ${machineName}`
          : machine.machine_code;
      return {
        key: String(machine.machine_id),
        label: lineName ? `${machineLabel} - ${lineName}` : machineLabel,
        count: machine.ng_count,
        ranking_label: `${numberFormatter.format(machine.ng_count)} (${percentageFormatter.format(machine.percentage)}%)`
      };
    });

    return {
      title: t("scanMachineStatusRankingTitle", { status: rankingStatus }),
      description: t("scanMachineStatusRankingDesc", { status: rankingStatus }),
      noDataMessage: t("scanMachineErrorRankingNoMachines"),
      chartData: mapped
    };
  }, [locale, numberFormatter, percentageFormatter, rankingStatus, rankingType, result, t]);

  const chartHeight = Math.max(280, chartData.length * 42 + 40);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center border px-4 text-sm text-muted-foreground">
            {noDataMessage}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ left: 12, right: 104, top: 8, bottom: 8 }}
            >
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
              <Bar dataKey="count" fill={barColor} radius={[0, 3, 3, 0]}>
                <LabelList dataKey="ranking_label" position="right" className="fill-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
