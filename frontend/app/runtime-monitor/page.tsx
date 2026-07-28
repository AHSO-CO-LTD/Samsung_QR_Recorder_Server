import { PageGuideToolbar } from "@/features/guides/guide-launcher";
import { RuntimeMonitorView } from "@/features/runtime-monitor/runtime-monitor-view";

export default function RuntimeMonitorPage() {
  return (
    <div className="min-w-0 space-y-1">
      <PageGuideToolbar guideIds={["05-giam-sat-phien-chay", "04-bo-loc-thoi-gian"]} className="pr-12" />
      <RuntimeMonitorView />
    </div>
  );
}
