import {
  BookOpenCheck,
  CircleAlert,
  Database,
  FileSpreadsheet,
  Gauge,
  History,
  MonitorCog,
  ScanLine,
  Settings,
  UsersRound,
  Workflow,
  type LucideIcon
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import type { ScreenPermissionKey } from "@/lib/screen-permissions";

export type NavGroupId = "monitoring" | "operation" | "system" | "guides";

export type NavItem = {
  href: string;
  key: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  permissionKey?: ScreenPermissionKey;
  alternativePermissionKeys?: readonly ScreenPermissionKey[];
  external?: boolean;
};

export type NavGroup = {
  id: NavGroupId;
  key: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  href?: string;
  items: readonly NavItem[];
};

export const navGroups: readonly NavGroup[] = [
  {
    id: "monitoring",
    key: "navMonitoring",
    descriptionKey: "navMonitoringDesc",
    icon: Gauge,
    items: [
      { href: "/", key: "dashboard", descriptionKey: "dashboardNavDesc", icon: Gauge, permissionKey: "dashboard" }
    ]
  },
  {
    id: "operation",
    key: "navOperation",
    descriptionKey: "navOperationDesc",
    icon: ScanLine,
    items: [
      {
        href: "/machines",
        key: "machines",
        descriptionKey: "machineDesc",
        icon: MonitorCog,
        permissionKey: "machines",
        alternativePermissionKeys: ["runtime"]
      },
      { href: "/master-data", key: "masterData", descriptionKey: "masterDataDesc", icon: Database, permissionKey: "master-data" },
      {
        href: "/scans",
        key: "scans",
        descriptionKey: "scanDesc",
        icon: ScanLine,
        permissionKey: "scans",
        alternativePermissionKeys: ["duplicate-audit"]
      },
      { href: "/reports", key: "reports", descriptionKey: "reportDesc", icon: FileSpreadsheet, permissionKey: "reports" }
    ]
  },
  {
    id: "system",
    key: "navSystem",
    descriptionKey: "navSystemDesc",
    icon: Settings,
    items: [
      { href: "/error-config", key: "errorConfig", descriptionKey: "errorConfigDesc", icon: CircleAlert, permissionKey: "error-config" },
      { href: "/sync", key: "sync", descriptionKey: "syncDesc", icon: Workflow, permissionKey: "sync" },
      { href: "/users", key: "users", descriptionKey: "usersDesc", icon: UsersRound, permissionKey: "users" },
      { href: "/audit-logs", key: "auditLogs", descriptionKey: "auditLogsDesc", icon: History, permissionKey: "audit-logs" }
    ]
  },
  {
    id: "guides",
    key: "navGuides",
    descriptionKey: "navGuidesDesc",
    icon: BookOpenCheck,
    href: "/guides",
    items: [{ href: "/guides", key: "guides", descriptionKey: "guidesDesc", icon: BookOpenCheck }]
  }
] as const;

export function filterNavGroups(canAccess: (permissionKey: ScreenPermissionKey) => boolean): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.permissionKey ||
          canAccess(item.permissionKey) ||
          item.alternativePermissionKeys?.some((permissionKey) => canAccess(permissionKey))
      )
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
