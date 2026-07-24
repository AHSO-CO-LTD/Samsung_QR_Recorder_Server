import { ScansView } from "@/features/scans/scans-view";

export default async function ScansPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ScansView defaultTab={tab === "scheduled-duplicate-check" ? "scheduled-duplicate-check" : "all-scans"} />;
}
