import { ErrorRankingChart } from "./error-ranking-chart";
import { LocalMachinesOverview } from "./local-machines-overview";
import { ScanTrendChart } from "./scan-trend-chart";

export function DashboardView() {
  return (
    <div className="min-w-0 space-y-4">
      <ScanTrendChart />

      <LocalMachinesOverview />

      <ErrorRankingChart />
    </div>
  );
}
