"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FilterX, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiDownloadBlob, apiGet } from "@/lib/api";
import { appDatetimeLocalToIso, toAppDatetimeLocal } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { DateTimePickerField } from "@/features/shared/date-time-picker";
import { SelectField, TextInputField } from "@/features/shared/form-fields";
import type { Machine, Profile } from "@/features/shared/types";

type ReportColumnKey =
  | "scan_record_id"
  | "scan_at"
  | "machine_code"
  | "machine_name"
  | "line_name"
  | "station_name"
  | "profile"
  | "profile_version"
  | "local_scan_id"
  | "local_status"
  | "server_status"
  | "final_status"
  | "ng_stage"
  | "ng_reason"
  | "full_code_raw"
  | "chassis_scan_raw"
  | "full_chassis_code"
  | "full_before_vendor"
  | "full_vendor_char"
  | "full_led_code"
  | "full_factory_code"
  | "full_after_factory"
  | "duplicate_key"
  | "led_slot_1_code"
  | "led_slot_1_raw"
  | "led_slot_1_lot_no"
  | "led_slot_1_status"
  | "led_slot_1_ng_reason"
  | "led_slot_2_code"
  | "led_slot_2_raw"
  | "led_slot_2_lot_no"
  | "led_slot_2_status"
  | "led_slot_2_ng_reason"
  | "led_all_raw"
  | "runtime_session_code"
  | "runtime_product_code"
  | "sync_batch_id"
  | "created_at";

type ReportStatus = "OK" | "NG" | "PENDING";

type ReportColumnGroup = {
  id: string;
  columns: ReportColumnKey[];
};

const reportColumnGroups: ReportColumnGroup[] = [
  {
    id: "general",
    columns: ["scan_record_id", "scan_at", "machine_code", "machine_name", "line_name", "station_name", "profile", "profile_version", "local_scan_id"]
  },
  {
    id: "result",
    columns: ["local_status", "server_status", "final_status", "ng_stage", "ng_reason"]
  },
  {
    id: "codes",
    columns: ["full_code_raw", "chassis_scan_raw", "full_chassis_code", "full_before_vendor", "full_vendor_char", "full_led_code", "full_factory_code", "full_after_factory", "duplicate_key"]
  },
  {
    id: "led",
    columns: [
      "led_slot_1_code",
      "led_slot_1_raw",
      "led_slot_1_lot_no",
      "led_slot_1_status",
      "led_slot_1_ng_reason",
      "led_slot_2_code",
      "led_slot_2_raw",
      "led_slot_2_lot_no",
      "led_slot_2_status",
      "led_slot_2_ng_reason",
      "led_all_raw"
    ]
  },
  {
    id: "runtime",
    columns: ["runtime_session_code", "runtime_product_code", "sync_batch_id", "created_at"]
  }
];

const allColumnKeys = reportColumnGroups.flatMap((group) => group.columns);
const defaultSelectedColumns: ReportColumnKey[] = [
  "scan_at",
  "machine_code",
  "profile",
  "local_scan_id",
  "local_status",
  "server_status",
  "final_status",
  "ng_reason",
  "full_code_raw",
  "duplicate_key"
];
const reportStatuses: ReportStatus[] = ["OK", "NG", "PENDING"];

const copy = {
  vi: {
    title: "Báo cáo Excel",
    desc: "Chọn khoảng thời gian, máy, hồ sơ, trạng thái và các cột cần xuất.",
    filterTitle: "Bộ lọc báo cáo",
    fieldMachine: "Máy",
    fieldProfile: "Hồ sơ",
    allMachines: "Tất cả máy",
    allProfiles: "Tất cả hồ sơ",
    from: "Từ ngày",
    to: "Đến ngày",
    statusTitle: "Trạng thái cần xuất",
    statusDesc: "Bỏ chọn trạng thái nào thì bản ghi trạng thái đó sẽ không có trong tệp.",
    includeSummary: "Thêm trang tổng quan",
    includeSummaryDesc: "Trang tổng quan ghi bộ lọc và tổng OK/NG/PENDING của tệp.",
    columnsTitle: "Thông số xuất ra",
    columnsDesc: "Tích các cột người dùng muốn thấy trong tệp Excel.",
    selectAll: "Chọn tất cả",
    clearAll: "Bỏ chọn",
    resetFilters: "Xóa lọc",
    exportExcel: "Xuất Excel",
    exporting: "Đang xuất...",
    exportDone: "Đã xuất báo cáo Excel.",
    exportFailed: "Không xuất được báo cáo.",
    filtersLoadFailed: "Không tải được máy/hồ sơ.",
    noColumn: "Chọn ít nhất một cột trước khi xuất.",
    noStatus: "Chọn ít nhất một trạng thái trước khi xuất.",
    invalidRange: "Từ ngày phải nhỏ hơn đến ngày.",
    selectedColumns: "{count} cột",
    selectedStatuses: "{count} trạng thái",
    general: "Thông tin chung",
    result: "Kết quả OK/NG",
    codes: "Toàn bộ mã",
    led: "Chi tiết LED",
    runtime: "Dấu vết phiên/máy chủ",
    scan_record_id: "ID bản ghi",
    scan_at: "Thời gian quét",
    machine_code: "Mã máy",
    machine_name: "Tên máy",
    line_name: "Dây chuyền",
    station_name: "Trạm",
    profile: "Hồ sơ",
    profile_version: "Phiên bản hồ sơ",
    local_scan_id: "ID quét cục bộ",
    local_status: "Cục bộ",
    server_status: "Máy chủ",
    final_status: "Cuối cùng",
    ng_stage: "Bước NG",
    ng_reason: "Lý do NG",
    full_code_raw: "Mã đầy đủ",
    chassis_scan_raw: "Dữ liệu khung thô",
    full_chassis_code: "Mã khung",
    full_before_vendor: "Trước nhà cung cấp",
    full_vendor_char: "Ký tự nhà cung cấp",
    full_led_code: "LED trong mã đầy đủ",
    full_factory_code: "Nhà máy",
    full_after_factory: "Sau nhà máy",
    duplicate_key: "Khóa trùng lặp",
    led_slot_1_code: "Mã LED 1",
    led_slot_1_raw: "Dữ liệu thô LED 1",
    led_slot_1_lot_no: "Lô LED 1",
    led_slot_1_status: "Cục bộ LED 1",
    led_slot_1_ng_reason: "LED 1 NG",
    led_slot_2_code: "Mã LED 2",
    led_slot_2_raw: "Dữ liệu thô LED 2",
    led_slot_2_lot_no: "Lô LED 2",
    led_slot_2_status: "Cục bộ LED 2",
    led_slot_2_ng_reason: "LED 2 NG",
    led_all_raw: "Tất cả dữ liệu LED thô",
    runtime_session_code: "Phiên chạy",
    runtime_product_code: "Mã đang chạy",
    sync_batch_id: "ID đợt đồng bộ",
    created_at: "Máy chủ ghi lúc"
  },
  en: {
    title: "Excel reports",
    desc: "Choose time range, machine, profile, statuses, and the exact fields to export.",
    filterTitle: "Report filters",
    fieldMachine: "Machine",
    fieldProfile: "Profile",
    allMachines: "All machines",
    allProfiles: "All profiles",
    from: "From date",
    to: "To date",
    statusTitle: "Statuses to export",
    statusDesc: "Unchecked statuses will not be included in the file.",
    includeSummary: "Include summary sheet",
    includeSummaryDesc: "The summary sheet records filters and OK/NG/PENDING totals.",
    columnsTitle: "Export fields",
    columnsDesc: "Select the columns users need in the Excel file.",
    selectAll: "Select all",
    clearAll: "Clear",
    resetFilters: "Clear filters",
    exportExcel: "Export Excel",
    exporting: "Exporting...",
    exportDone: "Excel report exported.",
    exportFailed: "Unable to export report.",
    filtersLoadFailed: "Unable to load machines/profiles.",
    noColumn: "Select at least one column before exporting.",
    noStatus: "Select at least one status before exporting.",
    invalidRange: "From date must be before to date.",
    selectedColumns: "{count} columns",
    selectedStatuses: "{count} statuses",
    general: "General info",
    result: "OK/NG result",
    codes: "All codes",
    led: "LED details",
    runtime: "Runtime/server trace",
    scan_record_id: "Record ID",
    scan_at: "Scan time",
    machine_code: "Machine code",
    machine_name: "Machine name",
    line_name: "Line",
    station_name: "Station",
    profile: "Profile",
    profile_version: "Profile version",
    local_scan_id: "Local scan ID",
    local_status: "Local",
    server_status: "Server",
    final_status: "Final",
    ng_stage: "NG stage",
    ng_reason: "NG reason",
    full_code_raw: "Full code",
    chassis_scan_raw: "Chassis raw",
    full_chassis_code: "Chassis",
    full_before_vendor: "Before vendor",
    full_vendor_char: "Vendor char",
    full_led_code: "Full-code LED",
    full_factory_code: "Factory",
    full_after_factory: "After factory",
    duplicate_key: "Duplicate key",
    led_slot_1_code: "LED 1 code",
    led_slot_1_raw: "LED 1 raw",
    led_slot_1_lot_no: "LED 1 lot",
    led_slot_1_status: "LED 1 local",
    led_slot_1_ng_reason: "LED 1 NG",
    led_slot_2_code: "LED 2 code",
    led_slot_2_raw: "LED 2 raw",
    led_slot_2_lot_no: "LED 2 lot",
    led_slot_2_status: "LED 2 local",
    led_slot_2_ng_reason: "LED 2 NG",
    led_all_raw: "All LED raw",
    runtime_session_code: "Runtime session",
    runtime_product_code: "Runtime product",
    sync_batch_id: "Sync batch ID",
    created_at: "Server created at"
  }
} as const;

export function ReportsView() {
  const { locale } = useI18n();
  const text = copy[locale];
  const [machines, setMachines] = useState<Machine[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [machineCode, setMachineCode] = useState("");
  const [profileId, setProfileId] = useState("");
  const [fromDate, setFromDate] = useState(toAppDatetimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [toDate, setToDate] = useState(toAppDatetimeLocal(new Date()));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ReportStatus>>(new Set(["OK", "NG"]));
  const [selectedColumns, setSelectedColumns] = useState<Set<ReportColumnKey>>(new Set(defaultSelectedColumns));
  const [includeSummary, setIncludeSummary] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([apiGet<Machine[]>("/machines"), apiGet<Profile[]>("/profiles")])
      .then(([machineResult, profileResult]) => {
        if (!isMounted) {
          return;
        }
        setMachines(machineResult.data ?? []);
        setProfiles(profileResult.data ?? []);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : text.filtersLoadFailed);
      });

    return () => {
      isMounted = false;
    };
  }, [text.filtersLoadFailed]);

  const selectedColumnList = useMemo(() => allColumnKeys.filter((key) => selectedColumns.has(key)), [selectedColumns]);
  const selectedStatusList = useMemo(() => reportStatuses.filter((status) => selectedStatuses.has(status)), [selectedStatuses]);

  const updateColumn = (column: ReportColumnKey, checked: boolean) => {
    setSelectedColumns((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(column);
      } else {
        next.delete(column);
      }
      return next;
    });
  };

  const updateGroup = (group: ReportColumnGroup, checked: boolean) => {
    setSelectedColumns((current) => {
      const next = new Set(current);
      for (const column of group.columns) {
        if (checked) {
          next.add(column);
        } else {
          next.delete(column);
        }
      }
      return next;
    });
  };

  const updateStatus = (status: ReportStatus, checked: boolean) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(status);
      } else {
        next.delete(status);
      }
      return next;
    });
  };

  const exportReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedColumnList.length === 0) {
      toast.warning(text.noColumn);
      return;
    }
    if (selectedStatusList.length === 0) {
      toast.warning(text.noStatus);
      return;
    }
    if (fromDate && toDate && appDatetimeLocalToIso(fromDate) > appDatetimeLocalToIso(toDate)) {
      toast.warning(text.invalidRange);
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading(text.exporting);
    try {
      const params = new URLSearchParams({
        column_keys: selectedColumnList.join(","),
        final_statuses: selectedStatusList.join(","),
        include_summary: includeSummary ? "true" : "false",
        locale
      });

      if (fromDate) params.set("from", appDatetimeLocalToIso(fromDate));
      if (toDate) params.set("to", appDatetimeLocalToIso(toDate));
      if (machineCode) params.set("machine_codes", machineCode);
      if (profileId) params.set("profile_ids", profileId);

      const result = await apiDownloadBlob(`/reports/scan-export?${params.toString()}`);
      downloadBlob(result.blob, result.fileName);
      toast.success(text.exportDone, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text.exportFailed, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <form className="min-w-0 space-y-4" onSubmit={exportReport}>
      <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold">{text.title}</h1>
          <p className="text-sm text-muted-foreground">{text.desc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{formatCount(text.selectedColumns, selectedColumnList.length)}</Badge>
          <Badge variant="outline">{formatCount(text.selectedStatuses, selectedStatusList.length)}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-sky-600" aria-hidden="true" />
            {text.filterTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <DateTimePickerField label={text.from} value={fromDate} onChange={setFromDate} />
            <DateTimePickerField label={text.to} value={toDate} onChange={setToDate} />
            <SelectField label={text.fieldMachine} value={machineCode} onChange={(event) => setMachineCode(event.target.value)}>
              <option value="">{text.allMachines}</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.machine_code}>
                  {machine.machine_code} - {machine.machine_name}
                </option>
              ))}
            </SelectField>
            <SelectField label={text.fieldProfile} value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              <option value="">{text.allProfiles}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.chassis_code?.code_full ?? `Profile ${profile.id}`}
                </option>
              ))}
            </SelectField>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMachineCode("");
                  setProfileId("");
                  setFromDate(toAppDatetimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
                  setToDate(toAppDatetimeLocal(new Date()));
                }}
              >
                <FilterX className="h-4 w-4" aria-hidden="true" />
                {text.resetFilters}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PanelBlock title={text.statusTitle} desc={text.statusDesc}>
              <div className="flex flex-wrap gap-2">
                {reportStatuses.map((status) => (
                  <CheckboxPill key={status} label={status} checked={selectedStatuses.has(status)} onCheckedChange={(checked) => updateStatus(status, checked)} />
                ))}
              </div>
            </PanelBlock>
            <PanelBlock title={text.includeSummary} desc={text.includeSummaryDesc}>
              <CheckboxPill label={text.includeSummary} checked={includeSummary} onCheckedChange={setIncludeSummary} />
            </PanelBlock>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-sky-600" aria-hidden="true" />
              {text.columnsTitle}
            </CardTitle>
            <CardDescription>{text.columnsDesc}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedColumns(new Set(allColumnKeys))}>
              {text.selectAll}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedColumns(new Set())}>
              {text.clearAll}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-2">
            {reportColumnGroups.map((group) => {
              const checkedCount = group.columns.filter((column) => selectedColumns.has(column)).length;
              const isAllChecked = checkedCount === group.columns.length;
              const isPartial = checkedCount > 0 && checkedCount < group.columns.length;

              return (
                <div key={group.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3 border-b pb-3">
                    <label className="flex min-w-0 items-center gap-3 text-sm font-semibold">
                      <Checkbox checked={isAllChecked} onChange={(event) => updateGroup(group, event.currentTarget.checked)} />
                      <span className={cn("truncate", isPartial && "text-sky-700 dark:text-sky-300")}>{text[group.id as keyof typeof text]}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">{checkedCount}/{group.columns.length}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.columns.map((column) => (
                      <CheckboxPill key={column} label={text[column]} checked={selectedColumns.has(column)} onCheckedChange={(checked) => updateColumn(column, checked)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={isExporting}>
              <Download className={cn("h-4 w-4", isExporting && "animate-pulse")} aria-hidden="true" />
              {isExporting ? text.exporting : text.exportExcel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function PanelBlock({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function CheckboxPill({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <label className={cn("flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm", checked ? "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200" : "bg-background")}>
      <Checkbox checked={checked} onChange={(event) => onCheckedChange(event.currentTarget.checked)} />
      <span className="truncate">{label}</span>
    </label>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCount(template: string, count: number) {
  return template.replace("{count}", String(count));
}
