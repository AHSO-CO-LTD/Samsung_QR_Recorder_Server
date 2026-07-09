"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { PrimaryNavbar } from "@/components/layout/primary-navbar";
import { UserMenu } from "@/components/layout/user-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavGroupId } from "@/components/layout/navigation-config";
import type { AuthUser } from "@/lib/auth";
import type { Locale, MessageKey } from "@/lib/i18n";

type AppHeaderProps = {
  activeGroupId: NavGroupId;
  selectedGroupId: NavGroupId;
  user: AuthUser | null;
  locale: Locale;
  theme: "light" | "dark";
  onSelectGroup: (groupId: NavGroupId) => void;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onQuitApp: () => void;
  onRestartApp: () => void;
  t: (key: MessageKey) => string;
};

export function AppHeader({
  activeGroupId,
  selectedGroupId,
  user,
  locale,
  theme,
  onSelectGroup,
  onToggleLocale,
  onToggleTheme,
  onLogout,
  onQuitApp,
  onRestartApp,
  t
}: AppHeaderProps) {
  return (
    <div className="bg-card">
      <div className="mx-auto max-w-[1440px] px-3 py-3 sm:px-4 lg:h-16 lg:py-0">
        <div className="flex min-w-0 items-center justify-between gap-2 lg:grid lg:h-full lg:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] lg:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                className="flex min-w-0 max-w-[min(72vw,24rem)] flex-1 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:max-w-none lg:gap-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="block min-w-0 truncate text-sm font-semibold">{t("appName")}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t("appSubtitle")}</TooltipContent>
          </Tooltip>

          <PrimaryNavbar
            className="hidden lg:block lg:justify-self-center"
            activeGroupId={activeGroupId}
            selectedGroupId={selectedGroupId}
            onSelectGroup={onSelectGroup}
          />

          <div className="flex shrink-0 justify-end">
            <UserMenu
              user={user}
              locale={locale}
              theme={theme}
              onToggleLocale={onToggleLocale}
              onToggleTheme={onToggleTheme}
              onLogout={onLogout}
              onQuitApp={onQuitApp}
              onRestartApp={onRestartApp}
              t={t}
            />
          </div>
        </div>

        <PrimaryNavbar
          className="mt-3 lg:hidden"
          activeGroupId={activeGroupId}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
        />
      </div>
    </div>
  );
}
