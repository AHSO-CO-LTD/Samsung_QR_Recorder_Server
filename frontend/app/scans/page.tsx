import { ResourcePanel } from "@/features/resource-panel";

export default function ScansPage() {
  return <ResourcePanel titleKey="scans" descriptionKey="scanDesc" endpoint="/scans?take=50" />;
}
