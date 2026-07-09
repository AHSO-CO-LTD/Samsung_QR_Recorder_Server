import { ResourcePanel } from "@/features/resource-panel";

export default function SyncPage() {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ResourcePanel titleKey="sync" descriptionKey="syncDesc" endpoint="/sync/batches?take=50" />
      <ResourcePanel titleKey="sync" descriptionKey="apiContractDesc" endpoint="/sync/request-logs?take=100" />
    </div>
  );
}
