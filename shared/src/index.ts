export const SUPPORTED_LOCALES = ["vi", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_THEMES = ["light", "dark"] as const;
export type SupportedTheme = (typeof SUPPORTED_THEMES)[number];

export const SCAN_STATUS = {
  OK: "OK",
  NG: "NG",
  PENDING: "PENDING",
  SKIPPED: "SKIPPED"
} as const;

export const ERROR_CODES = {
  LOCAL_DUPLICATE: "LOCAL_DUPLICATE",
  FULL_CODE_INVALID_LENGTH: "FULL_CODE_INVALID_LENGTH",
  FULL_VENDOR_NOT_MATCH: "FULL_VENDOR_NOT_MATCH",
  FULL_FACTORY_NOT_MATCH: "FULL_FACTORY_NOT_MATCH",
  CHASSIS_NOT_MATCH: "CHASSIS_NOT_MATCH",
  LED_VENDOR_NOT_MATCH: "LED_VENDOR_NOT_MATCH",
  LED_SUFFIX_NOT_MATCH: "LED_SUFFIX_NOT_MATCH",
  SERVER_DUPLICATE: "SERVER_DUPLICATE",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  MACHINE_NOT_FOUND: "MACHINE_NOT_FOUND",
  PROFILE_VERSION_OUTDATED: "PROFILE_VERSION_OUTDATED",
  SERVER_DISCONNECTED: "SERVER_DISCONNECTED",
  SYNC_BATCH_HAS_NG: "SYNC_BATCH_HAS_NG",
  PAYLOAD_INVALID: "PAYLOAD_INVALID"
} as const;

export const NOTIFICATION_CODES = {
  LOCAL_SERVER_OFFLINE: "LOCAL_SERVER_OFFLINE",
  LOCAL_SERVER_RECONNECTED: "LOCAL_SERVER_RECONNECTED",
  OFFLINE_SYNC_DONE_OK: "OFFLINE_SYNC_DONE_OK",
  OFFLINE_SYNC_HAS_NG: "OFFLINE_SYNC_HAS_NG",
  MACHINE_OFFLINE: "MACHINE_OFFLINE",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  DUPLICATE_REPORT_READY: "DUPLICATE_REPORT_READY"
} as const;

export type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data?: T;
};

export type ScanDecision =
  | "LOCAL_NG_SAVED"
  | "SERVER_OK"
  | "SERVER_DUPLICATE";

export const USER_ROLES = ["OPERATOR", "ENGINEER", "ADMIN", "DEV"] as const;
export type SharedUserRole = (typeof USER_ROLES)[number];

export const SCREEN_PERMISSION_KEYS = [
  "dashboard",
  "machines",
  "runtime",
  "scans",
  "reports",
  "master-data",
  "error-config",
  "sync",
  "duplicate-audit",
  "duplicates",
  "users",
  "audit-logs",
  "notifications",
  "settings",
  "api-docs"
] as const;

export type ScreenPermissionKey = (typeof SCREEN_PERMISSION_KEYS)[number];

export const SCREEN_PERMISSION_DEFINITIONS: readonly {
  key: ScreenPermissionKey;
  group: "monitoring" | "operation" | "system";
  label_vi: string;
  label_en: string;
}[] = [
  { key: "dashboard", group: "monitoring", label_vi: "Tổng quan", label_en: "Dashboard" },
  { key: "machines", group: "operation", label_vi: "Máy cục bộ", label_en: "Local machines" },
  { key: "runtime", group: "operation", label_vi: "Phiên chạy", label_en: "Runtime sessions" },
  { key: "scans", group: "operation", label_vi: "Lịch sử quét", label_en: "Scan history" },
  { key: "reports", group: "operation", label_vi: "Báo cáo", label_en: "Reports" },
  { key: "master-data", group: "system", label_vi: "Dữ liệu nền", label_en: "Master data" },
  { key: "error-config", group: "system", label_vi: "Cấu hình lỗi", label_en: "Error configuration" },
  { key: "sync", group: "system", label_vi: "Đồng bộ", label_en: "Sync" },
  { key: "duplicate-audit", group: "system", label_vi: "Kiểm tra trùng lặp", label_en: "Duplicate audit" },
  { key: "duplicates", group: "system", label_vi: "Trùng lặp", label_en: "Duplicates" },
  { key: "users", group: "system", label_vi: "Người dùng và vai trò", label_en: "Users and roles" },
  { key: "audit-logs", group: "system", label_vi: "Nhật ký kiểm tra", label_en: "Audit logs" },
  { key: "notifications", group: "system", label_vi: "Thông báo", label_en: "Notifications" },
  { key: "settings", group: "system", label_vi: "Cài đặt", label_en: "Settings" },
  { key: "api-docs", group: "system", label_vi: "Swagger", label_en: "Swagger" }
] as const;

export const DEFAULT_ROLE_SCREEN_PERMISSIONS: Record<Exclude<SharedUserRole, "DEV">, readonly ScreenPermissionKey[]> = {
  OPERATOR: ["dashboard", "machines", "runtime", "scans", "reports", "notifications", "settings"],
  ENGINEER: [
    "dashboard",
    "machines",
    "runtime",
    "scans",
    "reports",
    "master-data",
    "error-config",
    "sync",
    "duplicate-audit",
    "duplicates",
    "audit-logs",
    "notifications",
    "settings",
    "api-docs"
  ],
  ADMIN: SCREEN_PERMISSION_KEYS
};
