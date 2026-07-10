"use client";

import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { Profile } from "@/features/shared/types";

export function ProfilesView() {
  const columns: Column<Profile>[] = [
    { key: "chassis", header: "Chassis", render: (item) => <MonoText value={item.chassis_code?.code_full} /> },
    { key: "vendor", header: "Vendor", render: (item) => item.vendor ? `${item.vendor.vendor_name} (${item.vendor.vendor_char})` : "-" },
    { key: "factory", header: "Factory", render: (item) => <MonoText value={item.factory_code} /> },
    {
      key: "led",
      header: "LED slots",
      render: (item) =>
        item.profile_led_codes?.length
          ? item.profile_led_codes.map((slot) => `S${slot.led_slot}:${slot.led_code?.code_full ?? "-"}`).join(", ")
          : "-"
    },
    { key: "version", header: "Version", render: (item) => <MonoText value={`v${item.version}`} /> },
    { key: "active", header: "Trạng thái", render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: "Cập nhật", render: (item) => <DateText value={item.updated_at} /> }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Profiles" description="Theo dõi profile sản phẩm, rule parse và LED slot đang được máy local đồng bộ." />
      <DataTablePanel title="Danh sách profile" endpoint="/profiles" columns={columns} getRowKey={(item) => item.id} />
    </div>
  );
}
