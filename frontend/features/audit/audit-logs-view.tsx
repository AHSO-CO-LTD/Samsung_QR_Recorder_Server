"use client";

import { DataTablePanel, DateText, MonoText, type Column } from "@/features/shared/data-view";
import { useI18n } from "@/lib/i18n-provider";
import type { AuditLog } from "@/features/shared/types";

export function AuditLogsView() {
  const { t } = useI18n();

  const columns: Column<AuditLog>[] = [
    { key: "time", header: t("colTime"), render: (item) => <DateText value={item.created_at} /> },
    { key: "action", header: t("colAction"), render: (item) => <MonoText value={item.action} /> },
    { key: "table", header: t("colTable"), render: (item) => <MonoText value={item.table_name} /> },
    { key: "record", header: t("colRecord"), render: (item) => <MonoText value={item.record_id} /> },
    { key: "user", header: t("colUser"), render: (item) => item.user ? `${item.user.full_name} (${item.user.username})` : "-" },
    { key: "role", header: t("colRole"), render: (item) => item.user?.role ?? "-" }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <DataTablePanel
        title={t("latestAudit")}
        endpoint="/audit-logs?take=200"
        columns={columns}
        getRowKey={(item) => item.id}
        searchableText={(item) => `${item.action} ${item.table_name} ${item.record_id} ${item.user?.username ?? ""} ${item.user?.full_name ?? ""} ${item.user?.role ?? ""}`}
      />
    </div>
  );
}
