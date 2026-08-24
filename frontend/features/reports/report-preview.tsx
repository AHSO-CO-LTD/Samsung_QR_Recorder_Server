"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportColumnKey } from "@/features/reports/reports-view";

type ReportPreviewProps = {
  columns: readonly ReportColumnKey[];
  statuses: readonly string[];
  labels: Record<ReportColumnKey, string>;
  title: string;
  description: string;
  sampleRowsLabel: string;
  emptyLabel: string;
  noRowsLabel: string;
};

type PreviewRow = Partial<Record<ReportColumnKey, string>>;

const sampleRows: readonly PreviewRow[] = [
  {
    scan_record_id: "SCN-000128",
    scan_at: "06/08/2026 14:32:18",
    machine_code: "LOCAL01",
    machine_name: "Máy quét 01",
    line_name: "LINE-A",
    station_name: "ST-01",
    profile: "BN96-TEST99",
    profile_version: "v3",
    local_scan_id: "LOCAL-20260806-00128",
    local_status: "OK",
    server_status: "OK",
    final_status: "OK",
    ng_stage: "-",
    ng_reason: "-",
    full_code_raw: "BN96-12345A1A1L60376",
    chassis_scan_raw: "BN96-12345A",
    full_chassis_code: "BN96-12345A",
    full_before_vendor: "BN96-12345",
    full_vendor_char: "A",
    full_led_code: "1A1L",
    full_factory_code: "60376",
    full_after_factory: "-",
    duplicate_key: "BN96-12345A",
    led_slot_1_code: "LED-A01",
    led_slot_1_raw: "LED-A01",
    led_slot_1_lot_no: "LOT-0608",
    led_slot_1_status: "OK",
    led_slot_1_ng_reason: "-",
    led_slot_2_code: "LED-B01",
    led_slot_2_raw: "LED-B01",
    led_slot_2_lot_no: "LOT-0608",
    led_slot_2_status: "OK",
    led_slot_2_ng_reason: "-",
    led_all_raw: "LED-A01 | LED-B01",
    runtime_session_code: "RUN-0806-A",
    runtime_product_code: "BN96-TEST99",
    sync_batch_id: "SYNC-0806-01",
    created_at: "06/08/2026 14:32:19"
  },
  {
    scan_record_id: "SCN-000129",
    scan_at: "06/08/2026 14:35:42",
    machine_code: "LOCAL02",
    machine_name: "Máy quét 02",
    line_name: "LINE-B",
    station_name: "ST-02",
    profile: "BN96-61234B",
    profile_version: "v2",
    local_scan_id: "LOCAL-20260806-00129",
    local_status: "NG",
    server_status: "SKIPPED",
    final_status: "NG",
    ng_stage: "QR",
    ng_reason: "Không quét được QR",
    full_code_raw: "-",
    chassis_scan_raw: "-",
    full_chassis_code: "-",
    full_before_vendor: "-",
    full_vendor_char: "-",
    full_led_code: "LED-B02",
    full_factory_code: "-",
    full_after_factory: "-",
    duplicate_key: "-",
    led_slot_1_code: "LED-A02",
    led_slot_1_raw: "LED-A02",
    led_slot_1_lot_no: "LOT-0608",
    led_slot_1_status: "OK",
    led_slot_1_ng_reason: "-",
    led_slot_2_code: "LED-B02",
    led_slot_2_raw: "LED-B02",
    led_slot_2_lot_no: "LOT-0608",
    led_slot_2_status: "OK",
    led_slot_2_ng_reason: "-",
    led_all_raw: "LED-A02 | LED-B02",
    runtime_session_code: "RUN-0806-B",
    runtime_product_code: "BN96-61234B",
    sync_batch_id: "SYNC-0806-02",
    created_at: "06/08/2026 14:35:43"
  },
  {
    scan_record_id: "SCN-000130",
    scan_at: "06/08/2026 14:39:06",
    machine_code: "LOCAL01",
    machine_name: "Máy quét 01",
    line_name: "LINE-A",
    station_name: "ST-01",
    profile: "BN96-TEST99",
    profile_version: "v3",
    local_scan_id: "RW-LOCAL-20260806-00128",
    local_status: "REWORK",
    server_status: "OK",
    final_status: "REWORK",
    ng_stage: "REWORK",
    ng_reason: "Đã rework lỗi QR",
    full_code_raw: "BN96-12345A1A1L60376",
    chassis_scan_raw: "BN96-12345A",
    full_chassis_code: "BN96-12345A",
    full_before_vendor: "BN96-12345",
    full_vendor_char: "A",
    full_led_code: "1A1L",
    full_factory_code: "60376",
    full_after_factory: "-",
    duplicate_key: "BN96-12345A",
    led_slot_1_code: "LED-A01",
    led_slot_1_raw: "LED-A01",
    led_slot_1_lot_no: "LOT-0608",
    led_slot_1_status: "OK",
    led_slot_1_ng_reason: "-",
    led_slot_2_code: "LED-B01",
    led_slot_2_raw: "LED-B01",
    led_slot_2_lot_no: "LOT-0608",
    led_slot_2_status: "OK",
    led_slot_2_ng_reason: "-",
    led_all_raw: "LED-A01 | LED-B01",
    runtime_session_code: "RUN-0806-A",
    runtime_product_code: "BN96-TEST99",
    sync_batch_id: "SYNC-0806-03",
    created_at: "06/08/2026 14:39:07"
  }
];

export function ReportPreview({ columns, statuses, labels, title, description, sampleRowsLabel, emptyLabel, noRowsLabel }: ReportPreviewProps) {
  const visibleRows = sampleRows.filter((row) => statuses.includes(row.final_status ?? ""));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant="secondary">{sampleRowsLabel.replace("{count}", String(visibleRows.length))}</Badge>
      </CardHeader>
      <CardContent>
        {columns.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : visibleRows.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{noRowsLabel}</p>
        ) : (
          <Table showTopScrollbar topScrollbarLabel={title}>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column} className="whitespace-nowrap">{labels[column]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.scan_record_id}>
                  {columns.map((column) => (
                    <TableCell key={column} className="whitespace-nowrap text-xs">
                      <PreviewValue column={column} value={row[column] ?? "-"} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewValue({ column, value }: { column: ReportColumnKey; value: string }) {
  if (column === "local_status" || column === "server_status" || column === "final_status" || column === "led_slot_1_status" || column === "led_slot_2_status") {
    return <StatusBadge value={value} />;
  }

  return value;
}

function StatusBadge({ value }: { value: string }) {
  if (value === "NG") {
    return <Badge variant="destructive">{value}</Badge>;
  }
  if (value === "REWORK") {
    return <Badge className="border-transparent bg-orange-600 text-white">{value}</Badge>;
  }
  if (value === "OK") {
    return <Badge className="border-transparent bg-emerald-600 text-white">{value}</Badge>;
  }

  return <Badge variant="secondary">{value}</Badge>;
}
