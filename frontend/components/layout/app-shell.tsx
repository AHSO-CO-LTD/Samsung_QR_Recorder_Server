"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Power, RotateCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { filterNavGroups, getActiveNavGroup, type NavGroupId } from "@/components/layout/navigation-config";
import { SecondaryNavbar } from "@/components/layout/secondary-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { getDesktopApp } from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";
import { usePermissions } from "@/lib/permissions";
import { getScreenPermissionKeyForPath } from "@/lib/screen-permissions";
import { useTheme } from "@/lib/theme-provider";

type ConfirmAction = "logout" | "quit" | "restart";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { canAccess, isLoading: isPermissionLoading, error: permissionError, firstAccessiblePath } = usePermissions();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const visibleNavGroups = useMemo(() => filterNavGroups(canAccess), [canAccess]);
  const activeGroup = useMemo(() => getActiveNavGroup(pathname, visibleNavGroups), [pathname, visibleNavGroups]);
  const [openGroupId, setOpenGroupId] = useState<NavGroupId | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const lastRedirectKeyRef = useRef<string | null>(null);
  const selectedGroupId = openGroupId ?? activeGroup.id;
  const selectedGroup = useMemo(() => (openGroupId ? (visibleNavGroups.find((group) => group.id === openGroupId) ?? null) : null), [openGroupId, visibleNavGroups]);
  const currentPermissionKey = useMemo(() => getScreenPermissionKeyForPath(pathname), [pathname]);
  const canViewCurrentPath = !currentPermissionKey || canAccess(currentPermissionKey);
  const shouldRedirectToAllowedPath = Boolean(user) && !isPermissionLoading && !canViewCurrentPath && firstAccessiblePath !== pathname;

  useEffect(() => {
    setOpenGroupId(null);
  }, [pathname]);

  useEffect(() => {
    if (openGroupId && !visibleNavGroups.some((group) => group.id === openGroupId)) {
      setOpenGroupId(null);
    }
  }, [openGroupId, visibleNavGroups]);

  useEffect(() => {
    if (!shouldRedirectToAllowedPath) {
      return;
    }

    const redirectKey = `${pathname}->${firstAccessiblePath}`;
    if (lastRedirectKeyRef.current !== redirectKey) {
      lastRedirectKeyRef.current = redirectKey;
      toast.warning(t("accessRedirected"));
    }
    router.replace(firstAccessiblePath);
  }, [firstAccessiblePath, pathname, router, shouldRedirectToAllowedPath, t]);

  useEffect(() => {
    const syncHeaderHeight = () => {
      const header = headerRef.current;
      if (!header) {
        return;
      }

      const headerHeight = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
      document.documentElement.style.setProperty("--app-header-height", `${headerHeight}px`);
    };

    syncHeaderHeight();

    const observer = new ResizeObserver(syncHeaderHeight);
    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    window.addEventListener("resize", syncHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeaderHeight);
    };
  }, [openGroupId, pathname]);

  useEffect(() => {
    if (!openGroupId) {
      return;
    }

    const hideOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && headerRef.current?.contains(target)) {
        return;
      }

      setOpenGroupId(null);
    };

    const hideOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroupId(null);
      }
    };

    document.addEventListener("pointerdown", hideOnOutsidePointer);
    document.addEventListener("keydown", hideOnEscape);

    return () => {
      document.removeEventListener("pointerdown", hideOnOutsidePointer);
      document.removeEventListener("keydown", hideOnEscape);
    };
  }, [openGroupId]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    toast.success(nextTheme === "dark" ? t("dark") : t("light"));
  };

  const toggleLocale = () => {
    const nextLocale = locale === "vi" ? "en" : "vi";
    setLocale(nextLocale);
    toast.success(nextLocale === "vi" ? t("vietnamese") : t("english"));
  };

  const runDesktopAction = async (action: "quit" | "restart") => {
    const desktopApp = getDesktopApp();
    if (!desktopApp) {
      toast.warning(t("desktopActionUnavailable"));
      return;
    }

    const toastId = toast.loading(action === "quit" ? t("exitAppLoading") : t("restartAppLoading"));

    try {
      if (action === "quit") {
        await desktopApp.quit();
      } else {
        await desktopApp.restart();
      }
      toast.success(action === "quit" ? t("exitAppSent") : t("restartAppSent"), { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("desktopActionFailed");
      toast.error(message, { id: toastId });
    }
  };

  const confirmActionConfig = confirmAction ? getConfirmActionConfig(confirmAction) : null;
  const ConfirmActionIcon = confirmActionConfig?.icon;

  const runConfirmedAction = () => {
    if (confirmAction === "logout") {
      logout();
    }

    if (confirmAction === "quit") {
      void runDesktopAction("quit");
    }

    if (confirmAction === "restart") {
      void runDesktopAction("restart");
    }

    setConfirmAction(null);
  };

  return (
    <>
      <div className="min-h-[100dvh] min-w-0 bg-background text-foreground">
        <header ref={headerRef} className="sticky top-0 z-40 border-b bg-card">
          <AppHeader
            activeGroupId={activeGroup.id}
            selectedGroupId={selectedGroupId}
            groups={visibleNavGroups}
            user={user}
            locale={locale}
            theme={theme}
            canAccessNotifications={canAccess("notifications")}
            canAccessSettings={canAccess("settings")}
            onSelectGroup={setOpenGroupId}
            onToggleLocale={toggleLocale}
            onToggleTheme={toggleTheme}
            onLogout={() => setConfirmAction("logout")}
            onQuitApp={() => setConfirmAction("quit")}
            onRestartApp={() => setConfirmAction("restart")}
            t={t}
          />
          {selectedGroup ? (
            <SecondaryNavbar group={selectedGroup} pathname={pathname} onItemSelect={() => setOpenGroupId(null)} />
          ) : null}
        </header>

        <main className="w-full min-w-0 p-3 sm:p-4 lg:p-5 2xl:p-6">
          {isPermissionLoading && user ? (
            <AccessStatePanel title={t("rolePermissionLoading")} description={t("rolePermissionLoadingDesc")} />
          ) : canViewCurrentPath ? (
            children
          ) : shouldRedirectToAllowedPath ? (
            <AccessStatePanel title={t("accessRedirectingTitle")} description={t("accessRedirectingDesc")} />
          ) : (
            <AccessStatePanel
              title={t("accessDeniedTitle")}
              description={permissionError || t("accessDeniedDesc")}
              actionLabel={t("goToAllowedScreen")}
              onAction={() => router.push(firstAccessiblePath)}
            />
          )}
        </main>
      </div>

      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          {confirmActionConfig && ConfirmActionIcon ? (
            <>
              <DialogHeader>
                <div className={confirmActionConfig.iconClassName}>
                  <ConfirmActionIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <DialogTitle>{t(confirmActionConfig.titleKey)}</DialogTitle>
                <DialogDescription>{t(confirmActionConfig.descriptionKey)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmAction(null)}>
                  {t("cancel")}
                </Button>
                <Button type="button" variant={confirmActionConfig.destructive ? "destructive" : "default"} onClick={runConfirmedAction}>
                  <ConfirmActionIcon className="h-4 w-4" aria-hidden="true" />
                  {t(confirmActionConfig.confirmKey)}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccessStatePanel({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getConfirmActionConfig(action: ConfirmAction) {
  if (action === "logout") {
    return {
      icon: LogOut,
      titleKey: "confirmLogoutTitle",
      descriptionKey: "confirmLogoutDesc",
      confirmKey: "logout",
      destructive: true,
      iconClassName: "mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive"
    } as const;
  }

  if (action === "quit") {
    return {
      icon: Power,
      titleKey: "confirmExitTitle",
      descriptionKey: "confirmExitDesc",
      confirmKey: "exitApp",
      destructive: true,
      iconClassName: "mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive"
    } as const;
  }

  return {
    icon: RotateCw,
    titleKey: "confirmRestartTitle",
    descriptionKey: "confirmRestartDesc",
    confirmKey: "restartApp",
    destructive: false,
    iconClassName: "mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-200"
  } as const;
}
