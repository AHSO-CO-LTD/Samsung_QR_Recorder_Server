import { ResourcePanel } from "@/features/resource-panel";

export default function MachinesPage() {
  return <ResourcePanel titleKey="machines" descriptionKey="machineDesc" endpoint="/machines" />;
}
