"use client";

import Link from "next/link";
import { LogOut, Moon, Power, RotateCw, Settings, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AuthUser } from "@/lib/auth";
import type { Locale, MessageKey } from "@/lib/i18n";

type UserMenuProps = {
  user: AuthUser | null;
  locale: Locale;
  theme: "light" | "dark";
  canAccessSettings: boolean;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onQuitApp: () => void;
  onRestartApp: () => void;
  t: (key: MessageKey, params?: Record<string, string | number | null | undefined>) => string;
};

export function UserMenu({
  user,
  locale,
  theme,
  canAccessSettings,
  onToggleLocale,
  onToggleTheme,
  onLogout,
  onQuitApp,
  onRestartApp,
  t
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="min-w-0 shrink-0 justify-start px-2 md:w-44 md:px-2"
              aria-label={t("userMenu")}
              data-user-menu-trigger
            >
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden min-w-0 text-left md:block">
                <span className="block truncate text-xs font-semibold">{user?.full_name ?? t("guestUser")}</span>
                <span className="block truncate text-[11px] font-normal text-muted-foreground">{user?.role ?? t("offlineMode")}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("userMenuDesc")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="end"
        className="w-[min(18rem,calc(100vw-1rem))] md:w-[var(--radix-dropdown-menu-trigger-width)]"
        style={{ minWidth: "var(--radix-dropdown-menu-trigger-width)" }}
      >
        <DropdownMenuLabel>
          <span className="block truncate">{user?.full_name ?? t("guestUser")}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{user?.username ?? t("offlineMode")}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canAccessSettings ? (
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <div className={canAccessSettings ? "border-t" : ""}>
          <ToggleRow active={locale === "en"} leftLabel="VN" rightLabel="EN" tooltip={locale === "vi" ? t("english") : t("vietnamese")} onClick={onToggleLocale} />
          <ToggleRow
            active={theme === "dark"}
            leftIcon={Sun}
            rightIcon={Moon}
            tooltip={theme === "light" ? t("dark") : t("light")}
            onClick={onToggleTheme}
          />
        </div>
        <DropdownMenuItem onSelect={onRestartApp} data-user-action="restart" className="border-t text-sky-700 focus:text-sky-800 dark:text-sky-300">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {t("restartApp")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onQuitApp} data-user-action="quit" className="border-t text-destructive focus:text-destructive">
          <Power className="h-4 w-4" aria-hidden="true" />
          {t("exitApp")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} data-user-action="logout" className="border-t text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToggleRow({
  active,
  leftLabel,
  rightLabel,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  tooltip,
  onClick
}: {
  active: boolean;
  leftLabel?: string;
  rightLabel?: string;
  leftIcon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  rightIcon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={tooltip}
          onClick={onClick}
          className="flex h-9 w-full items-center justify-center border-b px-2 transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="relative grid h-7 w-[4.75rem] shrink-0 grid-cols-2 rounded-full border bg-muted/60 p-0.5 text-[11px] font-semibold text-muted-foreground">
            <span
              className="absolute top-0.5 h-6 w-[2.125rem] rounded-full bg-background shadow-sm transition-transform data-[active=true]:translate-x-[2.125rem]"
              data-active={active}
              aria-hidden="true"
            />
            <span className="relative z-10 flex items-center justify-center">
              {LeftIcon ? <LeftIcon className="h-3.5 w-3.5" aria-hidden={true} /> : leftLabel}
            </span>
            <span className="relative z-10 flex items-center justify-center">
              {RightIcon ? <RightIcon className="h-3.5 w-3.5" aria-hidden={true} /> : rightLabel}
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
