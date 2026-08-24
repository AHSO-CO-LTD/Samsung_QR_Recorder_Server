export const MAX_EXPORT_ROWS = 100000;

export const DEFAULT_REPORT_COLUMNS = [
  "scan_at",
  "machine_code",
  "profile",
  "local_scan_id",
  "final_status",
  "ng_reason",
  "full_code_raw",
  "duplicate_key"
] as const;

export const REPORT_COLUMN_KEYS = [
  "scan_record_id",
  "scan_at",
  "machine_code",
  "machine_name",
  "line_name",
  "station_name",
  "profile",
  "profile_version",
  "local_scan_id",
  "local_status",
  "server_status",
  "final_status",
  "ng_stage",
  "ng_reason",
  "full_code_raw",
  "chassis_scan_raw",
  "full_chassis_code",
  "full_before_vendor",
  "full_vendor_char",
  "full_led_code",
  "full_factory_code",
  "full_after_factory",
  "duplicate_key",
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
  "led_all_raw",
  "runtime_session_code",
  "runtime_product_code",
  "sync_batch_id",
  "created_at"
] as const;

export const REPORT_FINAL_STATUSES = ["OK", "NG", "REWORK", "PENDING"] as const;
export const REPORT_LOCALES = ["vi", "en"] as const;

export type ScanReportColumnKey = (typeof REPORT_COLUMN_KEYS)[number];
export type ScanReportFinalStatus = (typeof REPORT_FINAL_STATUSES)[number];
export type ScanReportLocale = (typeof REPORT_LOCALES)[number];
