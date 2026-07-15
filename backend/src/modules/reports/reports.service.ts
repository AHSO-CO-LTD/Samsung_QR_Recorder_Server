import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { FinalScanStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ScanReportQueryDto } from "./dto/scan-report-query.dto";
import { DEFAULT_REPORT_COLUMNS, MAX_EXPORT_ROWS, REPORT_COLUMN_KEYS, REPORT_FINAL_STATUSES, type ScanReportColumnKey, type ScanReportLocale } from "./report-definition";

type Locale = ScanReportLocale;
type ReportFilters = {
  machineCodes: string[];
  profileIds: number[];
  finalStatuses: FinalScanStatus[];
  from?: Date;
  to?: Date;
};
type ScanReportRecord = Prisma.ScanRecordGetPayload<{
  include: {
    machine: true;
    profile: {
      include: {
        chassis_code: true;
        profile_led_codes: {
          include: {
            led_code: true;
          };
        };
      };
    };
    led_items: true;
    runtime_session: true;
    runtime_product: true;
  };
}>;

type ReportColumn = {
  key: ScanReportColumnKey;
  width: number;
  value: (record: ScanReportRecord) => string | number | Date | null;
};

const columnLabels: Record<Locale, Record<ScanReportColumnKey, string>> = {
  vi: {
    scan_record_id: "ID record",
    scan_at: "Thời gian scan",
    machine_code: "Mã máy",
    machine_name: "Tên máy",
    line_name: "Line",
    station_name: "Trạm",
    profile: "Profile",
    profile_version: "Version profile",
    local_scan_id: "Local scan ID",
    local_status: "Local",
    server_status: "Server",
    final_status: "Final",
    ng_stage: "NG stage",
    ng_reason: "Lý do NG",
    full_code_raw: "Full code",
    chassis_scan_raw: "Chassis raw",
    full_chassis_code: "Chassis",
    full_before_vendor: "Before vendor",
    full_vendor_char: "Vendor char",
    full_led_code: "LED trong full code",
    full_factory_code: "Factory",
    full_after_factory: "After factory",
    duplicate_key: "Duplicate key",
    led_slot_1_code: "LED slot 1 code",
    led_slot_1_raw: "LED slot 1 raw",
    led_slot_1_lot_no: "LED slot 1 lot",
    led_slot_1_status: "LED slot 1 local",
    led_slot_1_ng_reason: "LED slot 1 NG",
    led_slot_2_code: "LED slot 2 code",
    led_slot_2_raw: "LED slot 2 raw",
    led_slot_2_lot_no: "LED slot 2 lot",
    led_slot_2_status: "LED slot 2 local",
    led_slot_2_ng_reason: "LED slot 2 NG",
    led_all_raw: "Tất cả LED raw",
    runtime_session_code: "Runtime session",
    runtime_product_code: "Mã đang chạy",
    sync_batch_id: "Sync batch ID",
    created_at: "Server ghi lúc"
  },
  en: {
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
    led_slot_1_code: "LED slot 1 code",
    led_slot_1_raw: "LED slot 1 raw",
    led_slot_1_lot_no: "LED slot 1 lot",
    led_slot_1_status: "LED slot 1 local",
    led_slot_1_ng_reason: "LED slot 1 NG",
    led_slot_2_code: "LED slot 2 code",
    led_slot_2_raw: "LED slot 2 raw",
    led_slot_2_lot_no: "LED slot 2 lot",
    led_slot_2_status: "LED slot 2 local",
    led_slot_2_ng_reason: "LED slot 2 NG",
    led_all_raw: "All LED raw",
    runtime_session_code: "Runtime session",
    runtime_product_code: "Runtime product",
    sync_batch_id: "Sync batch ID",
    created_at: "Server created at"
  }
};

const reportColumns: Record<ScanReportColumnKey, ReportColumn> = {
  scan_record_id: { key: "scan_record_id", width: 12, value: (record) => record.id },
  scan_at: { key: "scan_at", width: 22, value: (record) => record.scan_at },
  machine_code: { key: "machine_code", width: 16, value: (record) => record.machine.machine_code },
  machine_name: { key: "machine_name", width: 24, value: (record) => record.machine.machine_name },
  line_name: { key: "line_name", width: 16, value: (record) => record.machine.line_name },
  station_name: { key: "station_name", width: 16, value: (record) => record.machine.station_name },
  profile: { key: "profile", width: 18, value: (record) => record.profile.chassis_code.code_full },
  profile_version: { key: "profile_version", width: 14, value: (record) => record.profile.version },
  local_scan_id: { key: "local_scan_id", width: 24, value: (record) => record.local_scan_id },
  local_status: { key: "local_status", width: 12, value: (record) => record.local_status },
  server_status: { key: "server_status", width: 12, value: (record) => record.server_status },
  final_status: { key: "final_status", width: 12, value: (record) => record.final_status },
  ng_stage: { key: "ng_stage", width: 14, value: (record) => record.ng_stage },
  ng_reason: { key: "ng_reason", width: 24, value: (record) => record.ng_reason },
  full_code_raw: { key: "full_code_raw", width: 42, value: (record) => record.full_code_raw },
  chassis_scan_raw: { key: "chassis_scan_raw", width: 30, value: (record) => record.chassis_scan_raw },
  full_chassis_code: { key: "full_chassis_code", width: 18, value: (record) => record.full_chassis_code },
  full_before_vendor: { key: "full_before_vendor", width: 18, value: (record) => record.full_before_vendor },
  full_vendor_char: { key: "full_vendor_char", width: 14, value: (record) => record.full_vendor_char },
  full_led_code: { key: "full_led_code", width: 18, value: (record) => record.full_led_code },
  full_factory_code: { key: "full_factory_code", width: 14, value: (record) => record.full_factory_code },
  full_after_factory: { key: "full_after_factory", width: 18, value: (record) => record.full_after_factory },
  duplicate_key: { key: "duplicate_key", width: 28, value: (record) => record.duplicate_key },
  led_slot_1_code: { key: "led_slot_1_code", width: 18, value: (record) => getProfileLedCode(record, 1) },
  led_slot_1_raw: { key: "led_slot_1_raw", width: 32, value: (record) => getLedItem(record, 1)?.led_scan_raw ?? null },
  led_slot_1_lot_no: { key: "led_slot_1_lot_no", width: 18, value: (record) => getLedItem(record, 1)?.led_lot_no ?? null },
  led_slot_1_status: { key: "led_slot_1_status", width: 14, value: (record) => getLedItem(record, 1)?.local_status ?? null },
  led_slot_1_ng_reason: { key: "led_slot_1_ng_reason", width: 24, value: (record) => getLedItem(record, 1)?.ng_reason ?? null },
  led_slot_2_code: { key: "led_slot_2_code", width: 18, value: (record) => getProfileLedCode(record, 2) },
  led_slot_2_raw: { key: "led_slot_2_raw", width: 32, value: (record) => getLedItem(record, 2)?.led_scan_raw ?? null },
  led_slot_2_lot_no: { key: "led_slot_2_lot_no", width: 18, value: (record) => getLedItem(record, 2)?.led_lot_no ?? null },
  led_slot_2_status: { key: "led_slot_2_status", width: 14, value: (record) => getLedItem(record, 2)?.local_status ?? null },
  led_slot_2_ng_reason: { key: "led_slot_2_ng_reason", width: 24, value: (record) => getLedItem(record, 2)?.ng_reason ?? null },
  led_all_raw: {
    key: "led_all_raw",
    width: 44,
    value: (record) => record.led_items.map((item) => `S${item.led_slot}.${item.led_index}: ${item.led_scan_raw}`).join("\n")
  },
  runtime_session_code: { key: "runtime_session_code", width: 24, value: (record) => record.runtime_session?.session_code ?? null },
  runtime_product_code: { key: "runtime_product_code", width: 24, value: (record) => record.runtime_product?.product_code ?? null },
  sync_batch_id: { key: "sync_batch_id", width: 14, value: (record) => record.sync_batch_id },
  created_at: { key: "created_at", width: 22, value: (record) => record.created_at }
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildScanReport(query: ScanReportQueryDto) {
    const locale = query.locale === "en" ? "en" : "vi";
    const filters = this.parseFilters(query);
    await this.assertFilterTargetsExist(filters);
    const where = this.buildWhere(filters);
    const selectedColumns = this.parseColumns(query.column_keys);
    const total = await this.prisma.scanRecord.count({ where });

    if (total > MAX_EXPORT_ROWS) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_TOO_LARGE",
        message: `Report has ${total} rows. Please narrow filters to ${MAX_EXPORT_ROWS} rows or fewer.`
      });
    }

    const records = await this.prisma.scanRecord.findMany({
      where,
      orderBy: [{ scan_at: "asc" }, { id: "asc" }],
      include: {
        machine: true,
        profile: {
          include: {
            chassis_code: true,
            profile_led_codes: {
              include: {
                led_code: true
              },
              orderBy: [{ led_slot: "asc" }, { id: "asc" }]
            }
          }
        },
        led_items: {
          orderBy: [{ led_slot: "asc" }, { led_index: "asc" }, { id: "asc" }]
        },
        runtime_session: true,
        runtime_product: true
      }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "QR Recorder Server";
    workbook.created = new Date();

    if (this.parseBoolean(query.include_summary, true)) {
      this.addSummarySheet(workbook, records, filters, locale);
    }
    this.addScansSheet(workbook, records, selectedColumns, locale);

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `qr-scan-report-${formatFileStamp(new Date())}.xlsx`,
      buffer: Buffer.from(buffer as ArrayBuffer)
    };
  }

  private parseFilters(query: ScanReportQueryDto): ReportFilters {
    const filters = {
      machineCodes: parseCsv(query.machine_codes),
      profileIds: parseNumberCsv(query.profile_ids, "profile_ids"),
      finalStatuses: parseFinalStatuses(query.final_statuses),
      from: parseDate(query.from, "from"),
      to: parseDate(query.to, "to")
    };

    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_RANGE_INVALID",
        message: "From date must be before to date."
      });
    }

    return filters;
  }

  private buildWhere(filters: ReportFilters): Prisma.ScanRecordWhereInput {
    return {
      machine: filters.machineCodes.length ? { machine_code: { in: filters.machineCodes } } : undefined,
      profile_id: filters.profileIds.length ? { in: filters.profileIds } : undefined,
      final_status: filters.finalStatuses.length ? { in: filters.finalStatuses } : undefined,
      scan_at:
        filters.from || filters.to
          ? {
              gte: filters.from ?? undefined,
              lte: filters.to ?? undefined
            }
          : undefined
    };
  }

  private parseColumns(rawColumns?: string): ScanReportColumnKey[] {
    const requested = parseCsv(rawColumns);
    const validKeys = new Set<ScanReportColumnKey>(REPORT_COLUMN_KEYS);
    const unknownKeys = requested.filter((key) => !validKeys.has(key as ScanReportColumnKey));
    if (unknownKeys.length > 0) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_COLUMNS_INVALID",
        message: `Invalid report columns: ${unknownKeys.join(", ")}.`
      });
    }

    const selected = requested as ScanReportColumnKey[];
    const fallback = selected.length ? selected : [...DEFAULT_REPORT_COLUMNS];

    return Array.from(new Set(fallback));
  }

  private async assertFilterTargetsExist(filters: ReportFilters) {
    const [machines, profiles] = await Promise.all([
      filters.machineCodes.length
        ? this.prisma.machine.findMany({
            where: {
              machine_code: {
                in: filters.machineCodes
              }
            },
            select: {
              machine_code: true
            }
          })
        : Promise.resolve([]),
      filters.profileIds.length
        ? this.prisma.productProfile.findMany({
            where: {
              id: {
                in: filters.profileIds
              }
            },
            select: {
              id: true
            }
          })
        : Promise.resolve([])
    ]);

    const existingMachineCodes = new Set(machines.map((machine) => machine.machine_code));
    const missingMachineCodes = filters.machineCodes.filter((machineCode) => !existingMachineCodes.has(machineCode));
    if (missingMachineCodes.length > 0) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_MACHINE_NOT_FOUND",
        message: `Unknown machine code(s): ${missingMachineCodes.join(", ")}.`
      });
    }

    const existingProfileIds = new Set(profiles.map((profile) => profile.id));
    const missingProfileIds = filters.profileIds.filter((profileId) => !existingProfileIds.has(profileId));
    if (missingProfileIds.length > 0) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_PROFILE_NOT_FOUND",
        message: `Unknown profile id(s): ${missingProfileIds.join(", ")}.`
      });
    }
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, records: ScanReportRecord[], filters: ReportFilters, locale: Locale) {
    const labels =
      locale === "vi"
        ? {
            sheet: "Tổng quan",
            generatedAt: "Xuất lúc",
            from: "Từ ngày",
            to: "Đến ngày",
            machines: "Máy",
            profiles: "Profile",
            statuses: "Trạng thái",
            total: "Tổng record",
            ok: "Final OK",
            ng: "Final NG",
            pending: "Final pending"
          }
        : {
            sheet: "Summary",
            generatedAt: "Generated at",
            from: "From",
            to: "To",
            machines: "Machines",
            profiles: "Profiles",
            statuses: "Statuses",
            total: "Total records",
            ok: "Final OK",
            ng: "Final NG",
            pending: "Final pending"
          };
    const sheet = workbook.addWorksheet(labels.sheet);
    const counts = records.reduce(
      (current, record) => {
        current[record.final_status] += 1;
        return current;
      },
      { OK: 0, NG: 0, PENDING: 0 } as Record<FinalScanStatus, number>
    );

    sheet.columns = [
      { key: "label", width: 24 },
      { key: "value", width: 60 }
    ];
    sheet.addRows([
      { label: labels.generatedAt, value: new Date() },
      { label: labels.from, value: filters.from ?? "All" },
      { label: labels.to, value: filters.to ?? "All" },
      { label: labels.machines, value: filters.machineCodes.join(", ") || "All" },
      { label: labels.profiles, value: filters.profileIds.join(", ") || "All" },
      { label: labels.statuses, value: filters.finalStatuses.join(", ") || "All" },
      { label: labels.total, value: records.length },
      { label: labels.ok, value: counts.OK },
      { label: labels.ng, value: counts.NG },
      { label: labels.pending, value: counts.PENDING }
    ]);
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn("value").numFmt = "yyyy-mm-dd hh:mm:ss";
  }

  private addScansSheet(workbook: ExcelJS.Workbook, records: ScanReportRecord[], selectedColumns: ScanReportColumnKey[], locale: Locale) {
    const sheet = workbook.addWorksheet(locale === "vi" ? "Scan records" : "Scan records");
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns = selectedColumns.map((key) => ({
      key,
      header: columnLabels[locale][key],
      width: reportColumns[key].width
    }));

    for (const record of records) {
      const row = selectedColumns.reduce<Record<string, string | number | Date | null>>((current, key) => {
        current[key] = reportColumns[key].value(record);
        return current;
      }, {});
      sheet.addRow(row);
    }

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" }
    };
    header.alignment = { vertical: "middle", wrapText: true };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: selectedColumns.length }
    };

    for (const column of sheet.columns) {
      column.alignment = { vertical: "top", wrapText: true };
      if (column.key === "scan_at" || column.key === "created_at") {
        column.numFmt = "yyyy-mm-dd hh:mm:ss";
      }
    }
  }

  private parseBoolean(value: string | undefined, fallback: boolean) {
    if (value === undefined) {
      return fallback;
    }
    return value === "true" || value === "1";
  }
}

function getLedItem(record: ScanReportRecord, slot: number) {
  return record.led_items.find((item) => item.led_slot === slot) ?? null;
}

function getProfileLedCode(record: ScanReportRecord, slot: number) {
  return record.profile.profile_led_codes.find((item) => item.led_slot === slot)?.led_code.code_full ?? null;
}

function parseCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberCsv(value: string | undefined, fieldName: string) {
  return parseCsv(value).map((item) => {
    const numberValue = Number(item);
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_NUMBER_LIST_INVALID",
        message: `${fieldName} must contain positive integer ids only.`
      });
    }
    return numberValue;
  });
}

function parseFinalStatuses(value?: string): FinalScanStatus[] {
  const valid = new Set<string>(REPORT_FINAL_STATUSES);
  return parseCsv(value).map((item) => {
    const status = item.toUpperCase();
    if (!valid.has(status)) {
      throw new BadRequestException({
        success: false,
        code: "REPORT_STATUS_INVALID",
        message: `Invalid final status: ${item}.`
      });
    }
    return status as FinalScanStatus;
  });
}

function parseDate(value: string | undefined, fieldName: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      success: false,
      code: "REPORT_DATE_INVALID",
      message: `Invalid ${fieldName} date.`
    });
  }
  return date;
}

function formatFileStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}`;
}
