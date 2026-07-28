import { AuditLogsView } from "@/features/audit/audit-logs-view";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";

export default function AuditLogsPage() {
  return (
    <div className="min-w-0 space-y-4">
      <PageGuideToolbar guideIds={["18-nhat-ky-he-thong"]} />
      <AuditLogsView />
    </div>
  );
}
