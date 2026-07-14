"use client";

import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { useI18n } from "@/lib/i18n-provider";
import type { SyncBatch, SyncRequestLog } from "@/features/shared/types";

export function SyncView() {
  const { t } = useI18n();

  const batchColumns: Column<SyncBatch>[] = [
    { key: "batch", header: t("colBatch"), render: (item) => <MonoText value={item.batch_code} /> },
    { key: "machine", header: t("colMachine"), render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "trigger", header: t("colTrigger"), render: (item) => item.trigger_type },
    { key: "received", header: t("colReceived"), render: (item) => item.total_received },
    { key: "ok", header: t("colOk"), render: (item) => item.total_ok },
    { key: "ng", header: t("colNg"), render: (item) => item.total_ng },
    { key: "status", header: t("colStatus"), render: (item) => <StatusBadge value={item.status} /> },
    { key: "created", header: t("colCreatedAt"), render: (item) => <DateText value={item.created_at} /> },
    { key: "finished", header: t("colFinished"), render: (item) => <DateText value={item.finished_at} /> }
  ];

  const logColumns: Column<SyncRequestLog>[] = [
    { key: "time", header: t("colTime"), render: (item) => <DateText value={item.created_at} /> },
    { key: "machine", header: t("colMachine"), render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "type", header: t("colRequestType"), render: (item) => item.request_type },
    { key: "local", header: t("colLocalScan"), render: (item) => <MonoText value={item.local_scan_id} /> },
    { key: "batch", header: t("colBatch"), render: (item) => <MonoText value={item.batch_code} /> },
    { key: "status", header: t("colStatus"), render: (item) => <StatusBadge value={item.status} /> },
    { key: "error", header: t("colError"), render: (item) => item.error_message || "-" }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <DataTablePanel
        title={t("syncBatches")}
        endpoint="/sync/batches?take=100"
        columns={batchColumns}
        getRowKey={(item) => item.id}
        searchableText={(item) => `${item.batch_code} ${item.machine?.machine_code ?? ""} ${item.trigger_type} ${item.status}`}
      />
      <DataTablePanel
        title={t("requestLogs")}
        endpoint="/sync/request-logs?take=100"
        columns={logColumns}
        getRowKey={(item) => item.id}
        searchableText={(item) => `${item.machine?.machine_code ?? ""} ${item.request_type} ${item.local_scan_id ?? ""} ${item.batch_code ?? ""} ${item.status} ${item.error_message ?? ""}`}
      />
    </div>
  );
}
