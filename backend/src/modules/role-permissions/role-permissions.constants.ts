import { UserRole } from "@prisma/client";

export const userRoles = [UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMIN, UserRole.DEV] as const;
export const configurableRoles = [UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMIN] as const;

export const screenPermissionDefinitions = [
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

export type ScreenPermissionKey = (typeof screenPermissionDefinitions)[number]["key"];

export const allScreenPermissionKeys = screenPermissionDefinitions.map((permission) => permission.key);

export const defaultRoleScreenPermissions: Record<(typeof configurableRoles)[number], readonly ScreenPermissionKey[]> = {
  [UserRole.OPERATOR]: ["dashboard", "machines", "runtime", "scans", "reports", "notifications", "settings"],
  [UserRole.ENGINEER]: [
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
  [UserRole.ADMIN]: allScreenPermissionKeys
};

export function isUserRole(value: string): value is UserRole {
  return (userRoles as readonly string[]).includes(value);
}

export function isConfigurableRole(role: UserRole): role is (typeof configurableRoles)[number] {
  return (configurableRoles as readonly UserRole[]).includes(role);
}

export function isScreenPermissionKey(value: string): value is ScreenPermissionKey {
  return (allScreenPermissionKeys as readonly string[]).includes(value);
}
