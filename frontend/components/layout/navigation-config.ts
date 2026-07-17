import {
  Database,
  FileSpreadsheet,
  Gauge,
  History,
  Activity,
  MonitorCog,
  ScanLine,
  SearchCheck,
  Settings,
  Unplug,
  UsersRound,
  Workflow,
  type LucideIcon
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import type { ScreenPermissionKey } from "@/lib/screen-permissions";

export type NavGroupId = "monitoring" | "operation" | "system";

export type NavItem = {
  href: string;
  key: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  permissionKey: ScreenPermissionKey;
  external?: boolean;
};

export type NavGroup = {
  id: NavGroupId;
  key: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  items: readonly NavItem[];
};

export const navGroups: readonly NavGroup[] = [
  {
    id: "monitoring",
    key: "navMonitoring",
    descriptionKey: "navMonitoringDesc",
    icon: Gauge,
    items: [
      { href: "/", key: "dashboard", descriptionKey: "dashboardNavDesc", icon: Gauge, permissionKey: "dashboard" },
      { href: "/runtime-monitor", key: "runtimeMonitor", descriptionKey: "runtimeMonitorDesc", icon: Activity, permissionKey: "runtime" }
    ]
  },
  {
    id: "operation",
    key: "navOperation",
    descriptionKey: "navOperationDesc",
    icon: ScanLine,
    items: [
      { href: "/machines", key: "machines", descriptionKey: "machineDesc", icon: MonitorCog, permissionKey: "machines" },
      { href: "/runtime", key: "runtimeSessions", descriptionKey: "runtimeDesc", icon: Activity, permissionKey: "runtime" },
      { href: "/scans", key: "scans", descriptionKey: "scanDesc", icon: ScanLine, permissionKey: "scans" },
      { href: "/reports", key: "reports", descriptionKey: "reportDesc", icon: FileSpreadsheet, permissionKey: "reports" }
    ]
  },
  {
    id: "system",
    key: "navSystem",
    descriptionKey: "navSystemDesc",
    icon: Settings,
    items: [
      { href: "/master-data", key: "masterData", descriptionKey: "masterDataDesc", icon: Database, permissionKey: "master-data" },
      { href: "/sync", key: "sync", descriptionKey: "syncDesc", icon: Workflow, permissionKey: "sync" },
      { href: "/duplicate-audit", key: "duplicateAudit", descriptionKey: "duplicateAuditDesc", icon: SearchCheck, permissionKey: "duplicate-audit" },
      { href: "/users", key: "users", descriptionKey: "usersDesc", icon: UsersRound, permissionKey: "users" },
      { href: "/audit-logs", key: "auditLogs", descriptionKey: "auditLogsDesc", icon: History, permissionKey: "audit-logs" },
      { href: "http://127.0.0.1:3979/api/docs", key: "apiDocs", descriptionKey: "apiDocsDesc", icon: Unplug, permissionKey: "api-docs", external: true }
    ]
  }
] as const;

export function filterNavGroups(canAccess: (permissionKey: ScreenPermissionKey) => boolean): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.permissionKey))
    }))
    .filter((group) => group.items.length > 0);
}

export function getActiveNavGroup(pathname: string, groups: readonly NavGroup[] = navGroups) {
  if (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/profiles" ||
    pathname.startsWith("/profiles/") ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/") ||
    pathname === "/duplicates" ||
    pathname.startsWith("/duplicates/")
  ) {
    return getNavGroupById("system", groups);
  }

  return groups.find((group) => group.items.some((item) => !item.external && isActivePath(pathname, item.href))) ?? groups[0] ?? navGroups[0];
}

export function getNavGroupById(groupId: NavGroupId, groups: readonly NavGroup[] = navGroups) {
  return groups.find((group) => group.id === groupId) ?? groups[0] ?? navGroups[0];
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
