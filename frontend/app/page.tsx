import { DashboardView } from "@/features/dashboard/dashboard-view";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";

export default function Page() {
  return (
    <div className="min-w-0 space-y-4">
      <PageGuideToolbar guideIds={["02-dieu-huong", "03-tong-quan", "04-bo-loc-thoi-gian"]} />
      <DashboardView />
    </div>
  );
}
