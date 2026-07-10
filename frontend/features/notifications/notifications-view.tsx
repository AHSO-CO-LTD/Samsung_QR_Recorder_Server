"use client";

import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { NotificationEvent } from "@/features/shared/types";

type NotificationTemplate = {
  id: number;
  noti_code: string;
  title_template: string;
  severity: string;
  target: string;
  is_active: boolean;
  updated_at: string;
};

export function NotificationsView() {
  const eventColumns: Column<NotificationEvent>[] = [
    { key: "time", header: "Thời gian", render: (item) => <DateText value={item.created_at} /> },
    { key: "code", header: "Code", render: (item) => <MonoText value={item.noti_code} /> },
    { key: "title", header: "Tiêu đề", render: (item) => item.title },
    { key: "machine", header: "Máy", render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "severity", header: "Mức độ", render: (item) => <StatusBadge value={item.severity} /> },
    { key: "status", header: "Trạng thái", render: (item) => <StatusBadge value={item.status} /> }
  ];

  const templateColumns: Column<NotificationTemplate>[] = [
    { key: "code", header: "Code", render: (item) => <MonoText value={item.noti_code} /> },
    { key: "title", header: "Template", render: (item) => item.title_template },
    { key: "target", header: "Target", render: (item) => item.target },
    { key: "severity", header: "Mức độ", render: (item) => <StatusBadge value={item.severity} /> },
    { key: "active", header: "Trạng thái", render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: "Cập nhật", render: (item) => <DateText value={item.updated_at} /> }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Thông báo" description="Theo dõi cảnh báo vận hành, duplicate, offline sync và template thông báo." />
      <DataTablePanel title="Notification events" endpoint="/notifications?take=100" columns={eventColumns} getRowKey={(item) => item.id} />
      <DataTablePanel title="Notification templates" endpoint="/notifications/templates" columns={templateColumns} getRowKey={(item) => item.id} />
    </div>
  );
}
