"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { ChassisCode, LedCode, Vendor } from "@/features/shared/types";

export function MasterDataView() {
  const vendorColumns: Column<Vendor>[] = [
    { key: "char", header: "Vendor char", render: (item) => <MonoText value={item.vendor_char} /> },
    { key: "name", header: "Tên vendor", render: (item) => item.vendor_name },
    { key: "status", header: "Trạng thái", render: (item) => <StatusBadge value={item.status} /> },
    { key: "updated", header: "Cập nhật", render: (item) => <DateText value={item.updated_at} /> }
  ];

  const chassisColumns: Column<ChassisCode>[] = [
    { key: "full", header: "Code full", render: (item) => <MonoText value={item.code_full} /> },
    { key: "input", header: "Code input", render: (item) => <MonoText value={item.code_input} /> },
    { key: "active", header: "Trạng thái", render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: "Cập nhật", render: (item) => <DateText value={item.updated_at} /> }
  ];

  const ledColumns: Column<LedCode>[] = [
    { key: "full", header: "LED code", render: (item) => <MonoText value={item.code_full} /> },
    { key: "input", header: "Input", render: (item) => <MonoText value={item.code_input} /> },
    { key: "suffix", header: "Suffix check", render: (item) => <MonoText value={item.suffix_check} /> },
    { key: "active", header: "Trạng thái", render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: "Cập nhật", render: (item) => <DateText value={item.updated_at} /> }
  ];

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Master data" description="Quản lý dữ liệu nền dùng để tạo profile và kiểm rule scan." />
      <Tabs defaultValue="vendors" className="min-w-0 space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="chassis">Chassis</TabsTrigger>
          <TabsTrigger value="led">LED</TabsTrigger>
        </TabsList>
        <TabsContent value="vendors">
          <DataTablePanel title="Vendors" endpoint="/master-data/vendors" columns={vendorColumns} getRowKey={(item) => item.id} />
        </TabsContent>
        <TabsContent value="chassis">
          <DataTablePanel title="Chassis codes" endpoint="/master-data/chassis-codes" columns={chassisColumns} getRowKey={(item) => item.id} />
        </TabsContent>
        <TabsContent value="led">
          <DataTablePanel title="LED codes" endpoint="/master-data/led-codes" columns={ledColumns} getRowKey={(item) => item.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
