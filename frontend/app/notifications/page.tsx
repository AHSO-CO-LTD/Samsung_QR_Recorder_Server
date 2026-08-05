import { NotificationsView } from "@/features/notifications/notifications-view";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";

export default function NotificationsPage() {
  return (
    <div className="min-w-0 space-y-4">
      <PageGuideToolbar guideIds={["17-thong-bao"]} />
      <NotificationsView />
    </div>
  );
}
