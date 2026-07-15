export type ScreenPermissionKey =
  | "dashboard"
  | "machines"
  | "runtime"
  | "scans"
  | "reports"
  | "master-data"
  | "sync"
  | "duplicate-audit"
  | "duplicates"
  | "users"
  | "audit-logs"
  | "notifications"
  | "settings"
  | "api-docs";

export type ScreenPermissionGroup = "monitoring" | "operation" | "system";

export type ScreenPermissionDefinition = {
  key: ScreenPermissionKey;
  group: ScreenPermissionGroup;
  label_vi: string;
  label_en: string;
};

export const screenPermissionKeys: readonly ScreenPermissionKey[] = [
  "dashboard",
  "machines",
  "runtime",
  "scans",
  "reports",
  "master-data",
  "sync",
  "duplicate-audit",
  "duplicates",
  "users",
  "audit-logs",
  "notifications",
  "settings",
  "api-docs"
] as const;

export const routeByPermissionKey: Partial<Record<ScreenPermissionKey, string>> = {
  dashboard: "/",
  machines: "/machines",
  runtime: "/runtime",
  scans: "/scans",
  reports: "/reports",
  "master-data": "/master-data",
  sync: "/sync",
  "duplicate-audit": "/duplicate-audit",
  duplicates: "/duplicates",
  users: "/users",
  "audit-logs": "/audit-logs",
  notifications: "/notifications",
  settings: "/settings"
};

export function getScreenPermissionKeyForPath(pathname: string): ScreenPermissionKey | null {
  if (pathname === "/") {
    return "dashboard";
  }

  const routeEntries = Object.entries(routeByPermissionKey)
    .filter((entry): entry is [ScreenPermissionKey, string] => Boolean(entry[1]))
    .sort((left, right) => right[1].length - left[1].length);

  for (const [permissionKey, route] of routeEntries) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return permissionKey;
    }
  }

  if (pathname === "/profiles" || pathname.startsWith("/profiles/")) {
    return "master-data";
  }

  return null;
}

export function getFirstRouteForPermissions(permissionKeys: readonly ScreenPermissionKey[]) {
  for (const permissionKey of screenPermissionKeys) {
    if (permissionKeys.includes(permissionKey) && routeByPermissionKey[permissionKey]) {
      return routeByPermissionKey[permissionKey]!;
    }
  }

  return "/";
}
