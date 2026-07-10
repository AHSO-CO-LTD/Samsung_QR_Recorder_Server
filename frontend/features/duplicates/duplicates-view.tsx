"use client";

import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { DuplicateKey, HistoricalDuplicateResult } from "@/features/shared/types";

export function DuplicatesView() {
  const recentColumns: Column<DuplicateKey>[] = [
    { key: "key", header: "Duplicate key", render: (item) => <MonoText value={item.duplicate_key} /> },
    { key: "profile", header: "Profile", render: (item) => <MonoText value={item.profile?.chassis_code?.code_full} /> },
    { key: "machine", header: "Máy đầu tiên", render: (item) => <MonoText value={item.first_machine?.machine_code} /> },
    { key: "first", header: "First scan", render: (item) => <DateText value={item.first_scan_at} /> },
    { key: "expires", header: "Hết hạn", render: (item) => <DateText value={item.expires_at} /> },
    { key: "scan", header: "Scan ID", render: (item) => <MonoText value={item.first_scan_record_id} /> }
  ];

  const historicalColumns: Column<HistoricalDuplicateResult>[] = [
    { key: "key", header: "Duplicate key", render: (item) => <MonoText value={item.duplicate_key} /> },
    { key: "profile", header: "Profile", render: (item) => <MonoText value={item.profile?.chassis_code?.code_full} /> },
    { key: "count", header: "Số lần", render: (item) => item.total_count },
    { key: "first", header: "Đầu tiên", render: (item) => <DateText value={item.first_scan_at} /> },
    { key: "latest", header: "Gần nhất", render: (item) => <DateText value={item.latest_scan_at} /> },
    { key: "job", header: "Job", render: (item) => <StatusBadge value={item.job?.status || "-"} /> }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Duplicate" description="Theo dõi khóa duplicate đang active và kết quả kiểm duplicate lịch sử." />
      <DataTablePanel title="Recent duplicate keys" endpoint="/duplicates/recent-keys?take=100" columns={recentColumns} getRowKey={(item) => item.id} />
      <DataTablePanel
        title="Historical duplicate results"
        endpoint="/duplicates/historical-results?take=100"
        columns={historicalColumns}
        getRowKey={(item) => item.id}
      />
    </div>
  );
}
