import { ReportsView } from "@/features/reports/reports-view";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";

export default function ReportsPage() {
  return (
    <div className="min-w-0 space-y-4">
      <PageGuideToolbar guideIds={["14-bao-cao"]} />
      <ReportsView />
    </div>
  );
}
