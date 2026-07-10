"use client";

import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { ScanRecord } from "@/features/shared/types";

export function ScansView() {
  const columns: Column<ScanRecord>[] = [
    { key: "time", header: "Scan time", render: (item) => <DateText value={item.scan_at} /> },
    { key: "machine", header: "Máy", render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "profile", header: "Profile", render: (item) => <MonoText value={item.profile?.chassis_code?.code_full} /> },
    { key: "local_id", header: "Local ID", render: (item) => <MonoText value={item.local_scan_id} /> },
    { key: "duplicate", header: "Duplicate key", render: (item) => <MonoText value={item.duplicate_key} /> },
    { key: "local", header: "Local", render: (item) => <StatusBadge value={item.local_status} /> },
    { key: "server", header: "Server", render: (item) => <StatusBadge value={item.server_status} /> },
    { key: "final", header: "Final", render: (item) => <StatusBadge value={item.final_status} /> },
    { key: "reason", header: "NG reason", render: (item) => item.ng_reason || "-" }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Lịch sử scan" description="Tra cứu scan OK/NG, duplicate key, kết quả local/server và lý do NG." />
      <DataTablePanel title="Scan mới nhất" endpoint="/scans?take=100" columns={columns} getRowKey={(item) => item.id} />
    </div>
  );
}
