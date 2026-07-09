"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useI18n } from "@/lib/i18n-provider";

const chartData = [
  { date: "T-6", ok: 0, ng: 0 },
  { date: "T-5", ok: 0, ng: 0 },
  { date: "T-4", ok: 0, ng: 0 },
  { date: "T-3", ok: 0, ng: 0 },
  { date: "T-2", ok: 0, ng: 0 },
  { date: "T-1", ok: 0, ng: 0 },
  { date: "Today", ok: 0, ng: 0 }
];

const chartConfig = {
  ok: {
    label: "OK",
    color: "hsl(var(--chart-ok))"
  },
  ng: {
    label: "NG",
    color: "hsl(var(--chart-ng))"
  }
} satisfies ChartConfig;

export function ScanTrendChart() {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="truncate">{t("scanTrend")}</CardTitle>
          <InfoTooltip content={t("scanTrendDesc")} />
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full sm:h-72">
          <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="ok"
              type="monotone"
              stroke="var(--color-ok)"
              fill="var(--color-ok)"
              fillOpacity={0.14}
              strokeWidth={2}
            />
            <Area
              dataKey="ng"
              type="monotone"
              stroke="var(--color-ng)"
              fill="var(--color-ng)"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
