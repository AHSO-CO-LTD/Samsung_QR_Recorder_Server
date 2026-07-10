"use client";

import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { SyncBatch, SyncRequestLog } from "@/features/shared/types";

export function SyncView() {
  const batchColumns: Column<SyncBatch>[] = [
    { key: "batch", header: "Batch", render: (item) => <MonoText value={item.batch_code} /> },
    { key: "machine", header: "Máy", render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "trigger", header: "Trigger", render: (item) => item.trigger_type },
    { key: "received", header: "Received", render: (item) => item.total_received },
    { key: "ok", header: "OK", render: (item) => item.total_ok },
    { key: "ng", header: "NG", render: (item) => item.total_ng },
    { key: "status", header: "Trạng thái", render: (item) => <StatusBadge value={item.status} /> },
    { key: "finished", header: "Hoàn tất", render: (item) => <DateText value={item.finished_at} /> }
  ];

  const logColumns: Column<SyncRequestLog>[] = [
    { key: "time", header: "Thời gian", render: (item) => <DateText value={item.created_at} /> },
    { key: "machine", header: "Máy", render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "type", header: "Request", render: (item) => item.request_type },
    { key: "local", header: "Local scan", render: (item) => <MonoText value={item.local_scan_id} /> },
    { key: "batch", header: "Batch", render: (item) => <MonoText value={item.batch_code} /> },
    { key: "status", header: "Trạng thái", render: (item) => <StatusBadge value={item.status} /> },
    { key: "error", header: "Error", render: (item) => item.error_message || "-" }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Đồng bộ" description="Theo dõi batch sync, request logs và lỗi khi máy local gửi dữ liệu offline/pending." />
      <DataTablePanel title="Sync batches" endpoint="/sync/batches?take=100" columns={batchColumns} getRowKey={(item) => item.id} />
      <DataTablePanel title="Request logs" endpoint="/sync/request-logs?take=100" columns={logColumns} getRowKey={(item) => item.id} />
    </div>
  );
}
