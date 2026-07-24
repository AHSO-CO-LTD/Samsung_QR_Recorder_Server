import { MachineManagementView } from "@/features/machines/machine-management-view";

export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <MachineManagementView defaultTab={tab === "runtime" ? "runtime" : "machines"} />;
}
