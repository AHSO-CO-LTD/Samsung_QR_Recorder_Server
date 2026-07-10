"use client";

import { DataTablePanel, DateText, MonoText, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { AuditLog } from "@/features/shared/types";

export function AuditLogsView() {
  const columns: Column<AuditLog>[] = [
    { key: "time", header: "Thời gian", render: (item) => <DateText value={item.created_at} /> },
    { key: "action", header: "Action", render: (item) => <MonoText value={item.action} /> },
    { key: "table", header: "Bảng", render: (item) => <MonoText value={item.table_name} /> },
    { key: "record", header: "Record", render: (item) => <MonoText value={item.record_id} /> },
    { key: "user", header: "User", render: (item) => item.user ? `${item.user.full_name} (${item.user.username})` : "-" },
    { key: "role", header: "Role", render: (item) => item.user?.role ?? "-" }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Audit logs" description="Truy vết thay đổi cấu hình, tài khoản, profile và thao tác report." />
      <DataTablePanel title="Audit mới nhất" endpoint="/audit-logs?take=200" columns={columns} getRowKey={(item) => item.id} />
    </div>
  );
}
