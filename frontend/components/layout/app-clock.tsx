"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { APP_TIME_ZONE_LABEL, formatAppDateTime, formatAppTime } from "@/lib/app-time";
import type { Locale } from "@/lib/i18n";

export function AppClock({ locale }: { locale: Locale }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const label = locale === "vi" ? `Giờ Việt Nam (${APP_TIME_ZONE_LABEL})` : `Vietnam time (${APP_TIME_ZONE_LABEL})`;
  const dateText = now
    ? formatAppDateTime(now, locale, { day: "2-digit", month: "2-digit", year: "numeric" })
    : "--/--/----";
  const timeText = now ? formatAppTime(now, locale, true) : "--:--:--";

  return (
    <time
      dateTime={now?.toISOString()}
      aria-label={label}
      title={label}
      className="flex h-9 shrink-0 items-center gap-2 border-x px-2 font-mono text-xs tabular-nums text-foreground sm:px-3"
    >
      <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="hidden whitespace-nowrap 2xl:inline">{dateText}</span>
      <span className="whitespace-nowrap font-semibold">{timeText}</span>
      <span className="hidden whitespace-nowrap text-[10px] text-muted-foreground xl:inline">{APP_TIME_ZONE_LABEL}</span>
    </time>
  );
}
