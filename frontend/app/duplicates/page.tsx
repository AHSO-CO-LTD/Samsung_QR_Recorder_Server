import { ResourcePanel } from "@/features/resource-panel";

export default function DuplicatesPage() {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ResourcePanel titleKey="duplicates" descriptionKey="duplicateDesc" endpoint="/duplicates/recent-keys?take=100" />
      <ResourcePanel titleKey="duplicates" descriptionKey="duplicateRule" endpoint="/duplicates/historical-results?take=100" />
    </div>
  );
}
