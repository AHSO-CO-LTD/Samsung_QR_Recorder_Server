"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { apiGet, apiPatch } from "@/lib/api";
import { formatAppTime } from "@/lib/app-time";
import { cn } from "@/lib/utils";
import type { Locale, MessageKey } from "@/lib/i18n";
import type { NotificationEvent } from "@/features/shared/types";
import { getNotificationMessage, getNotificationTitle } from "@/features/notifications/localized-notification";

type NotificationBellProps = {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number | null | undefined>) => string;
};

const POLL_MS = 5000;

export function NotificationBell({ locale, t }: NotificationBellProps) {
  const [items, setItems] = useState<NotificationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const newestIdRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = useMemo(() => items.filter((item) => item.status === "NEW").length, [items]);
  const visibleItems = useMemo(() => items.slice(0, 8), [items]);

  const load = useCallback(
    async (showToast = false) => {
      try {
        if (showToast) {
          setIsLoading(true);
        }
        setError(null);
        const result = await apiGet<NotificationEvent[]>("/notifications?take=50");
        const nextItems = result.data ?? [];
        setItems(nextItems);

        const newest = nextItems.reduce<number | null>((current, item) => (current === null || item.id > current ? item.id : current), null);
        const previous = newestIdRef.current;
        if (previous !== null && newest !== null && newest > previous) {
          setIsShaking(true);
          if (shakeTimerRef.current) {
            clearTimeout(shakeTimerRef.current);
          }
          shakeTimerRef.current = setTimeout(() => setIsShaking(false), 900);
        }
        if (newest !== null) {
          newestIdRef.current = Math.max(previous ?? newest, newest);
        }
      } catch (currentError) {
        const message = currentError instanceof Error ? currentError.message : t("notificationLoadFailed");
        setError(message);
        if (showToast) {
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearInterval(timer);
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }
    };
  }, [load]);

  const markRead = useCallback(
    async (item: NotificationEvent) => {
      try {
        await apiPatch(`/notifications/${item.id}/status`, { status: "READ" });
        toast.success(t("notificationMarkedRead"));
        await load();
      } catch (currentError) {
        toast.error(currentError instanceof Error ? currentError.message : t("notificationStatusUpdateFailed"));
      }
    },
    [load, t]
  );

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0" aria-label={t("notificationBell")} data-notification-bell>
              <Bell className={cn("h-4 w-4", isShaking && "animate-bell-shake")} aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("notificationBellDesc")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-[min(23rem,calc(100vw-1rem))]">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>{t("latestNotifications")}</span>
          <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>{t("unreadNotifications", { count: unreadCount })}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto px-1 py-1">
          {isLoading ? <div className="px-2 py-3 text-sm text-muted-foreground">{t("loading")}</div> : null}
          {error ? <div className="px-2 py-3 text-sm text-destructive">{error}</div> : null}
          {!isLoading && !error && visibleItems.length === 0 ? <div className="px-2 py-3 text-sm text-muted-foreground">{t("noNotifications")}</div> : null}
          {!isLoading && !error
            ? visibleItems.map((item) => (
                <div key={item.id} className="rounded-sm px-2 py-2 text-sm hover:bg-muted">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{getNotificationTitle(item, locale)}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{getNotificationMessage(item, locale)}</div>
                    </div>
                    <Badge variant={item.status === "NEW" ? "destructive" : "secondary"}>{item.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{item.machine?.machine_code ?? item.noti_code}</span>
                    <span className="shrink-0">{formatTime(item.created_at, locale)}</span>
                  </div>
                  {item.status === "NEW" ? (
                    <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => void markRead(item)}>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("markNotificationRead")}
                    </Button>
                  ) : null}
                </div>
              ))
            : null}
        </div>

        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-1 p-1">
          <Button variant="ghost" size="sm" onClick={() => void load(true)} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
            {t("retry")}
          </Button>
          <DropdownMenuItem asChild>
            <Link href="/notifications" className="justify-center">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("viewAllNotifications")}
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatTime(value: string, locale: Locale) {
  return formatAppTime(value, locale);
}
