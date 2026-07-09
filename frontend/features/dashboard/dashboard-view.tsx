"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useI18n } from "@/lib/i18n-provider";
import { ResourcePanel } from "@/features/resource-panel";
import { ScanTrendChart } from "./scan-trend-chart";

const metrics = [
  { key: "todayOk", value: "0", tone: "default" },
  { key: "todayNg", value: "0", tone: "destructive" },
  { key: "pendingSync", value: "0", tone: "secondary" },
  { key: "duplicateWindow", value: "31D", tone: "outline" }
] as const;

export function DashboardView() {
  const { t } = useI18n();

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Runtime metrics">
        {metrics.map((metric) => (
          <Card key={metric.key}>
            <CardHeader>
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate">{t(metric.key)}</CardTitle>
                <InfoTooltip content={metric.key === "duplicateWindow" ? t("duplicateRule") : t("localRule")} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-3">
              <span className="text-3xl font-semibold">{metric.value}</span>
              <Badge variant={metric.tone}>{metric.key}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ScanTrendChart />
        <ResourcePanel titleKey="health" descriptionKey="apiContractDesc" endpoint="/health" />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ResourcePanel titleKey="machines" descriptionKey="machineDesc" endpoint="/machines" />
      </section>
    </div>
  );
}
