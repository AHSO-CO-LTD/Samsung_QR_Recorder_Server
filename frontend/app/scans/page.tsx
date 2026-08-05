import { Suspense } from "react";
import { ScansView } from "@/features/scans/scans-view";

export default async function ScansPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Đang tải lịch sử quét...</div>}>
      <ScansView defaultTab={tab === "scheduled-duplicate-check" ? "scheduled-duplicate-check" : "all-scans"} />
    </Suspense>
  );
}
