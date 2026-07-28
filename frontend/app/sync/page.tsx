import { SyncView } from "@/features/sync/sync-view";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";

export default function SyncPage() {
  return (
    <div className="min-w-0 space-y-4">
      <PageGuideToolbar guideIds={["15-dong-bo"]} />
      <SyncView />
    </div>
  );
}
