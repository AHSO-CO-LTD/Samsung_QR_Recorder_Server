import { ResourcePanel } from "@/features/resource-panel";

export default function ProfilesPage() {
  return <ResourcePanel titleKey="profiles" descriptionKey="profileDesc" endpoint="/profiles" />;
}
