import {
  Bell,
  Database,
  FileSearch,
  Gauge,
  MonitorCog,
  ScanLine,
  Settings,
  Unplug,
  Workflow,
  type LucideIcon
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";

export type NavGroupId = "monitoring" | "operation" | "system";

export type NavItem = {
  href: string;
  key: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
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
      { href: "/", key: "dashboard", descriptionKey: "dashboardNavDesc", icon: Gauge },
      { href: "/notifications", key: "notifications", descriptionKey: "notificationDesc", icon: Bell }
    ]
  },
  {
    id: "operation",
    key: "navOperation",
    descriptionKey: "navOperationDesc",
    icon: ScanLine,
    items: [
      { href: "/machines", key: "machines", descriptionKey: "machineDesc", icon: MonitorCog },
      { href: "/scans", key: "scans", descriptionKey: "scanDesc", icon: ScanLine },
      { href: "/duplicates", key: "duplicates", descriptionKey: "duplicateDesc", icon: FileSearch }
    ]
  },
  {
    id: "system",
    key: "navSystem",
    descriptionKey: "navSystemDesc",
    icon: Settings,
    items: [
      { href: "/profiles", key: "profiles", descriptionKey: "profileDesc", icon: Database },
      { href: "/sync", key: "sync", descriptionKey: "syncDesc", icon: Workflow },
      { href: "http://127.0.0.1:3979/api/docs", key: "apiDocs", descriptionKey: "apiDocsDesc", icon: Unplug, external: true }
    ]
  }
] as const;

export function getActiveNavGroup(pathname: string) {
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return getNavGroupById("system");
  }

  return navGroups.find((group) => group.items.some((item) => !item.external && isActivePath(pathname, item.href))) ?? navGroups[0];
}

export function getNavGroupById(groupId: NavGroupId) {
  return navGroups.find((group) => group.id === groupId) ?? navGroups[0];
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
