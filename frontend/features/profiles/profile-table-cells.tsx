"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n-provider";
import type { Profile } from "@/features/shared/types";

type ProfileLedSlot = NonNullable<Profile["profile_led_codes"]>[number];

export function RuleNumberCell({ value }: { value?: number | null }) {
  return <span className="font-mono text-xs tabular-nums">{value ?? "-"}</span>;
}

export function LedSlotCell({ profile, slot }: { profile: Profile; slot: number }) {
  const ledSlot = profile.profile_led_codes?.find((item) => item.led_slot === slot);
  return <LedSlotValue ledSlot={ledSlot} />;
}

function LedSlotValue({ ledSlot }: { ledSlot?: ProfileLedSlot }) {
  const { t } = useI18n();

  if (!ledSlot) {
    return <EmptyCell />;
  }

  return (
    <div className="w-36 min-w-0 space-y-1">
      <div className="min-w-0">
        <span className="block truncate font-mono text-xs leading-5" title={ledSlot.led_code?.code_full ?? undefined}>
          {ledSlot.led_code?.code_full ?? "-"}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
        <span>{t("ledSuffixLabel")}</span>
        <span className="min-w-0 truncate font-mono text-foreground" title={ledSlot.led_code?.suffix_check ?? undefined}>
          {ledSlot.led_code?.suffix_check ?? "-"}
        </span>
        <Badge variant={ledSlot.is_required ? "outline" : "secondary"} className="h-5 shrink-0 px-1.5 py-0 text-[10px]">
          {ledSlot.is_required ? t("ledRequiredShort") : t("ledOptionalShort")}
        </Badge>
      </div>
    </div>
  );
}

function EmptyCell() {
  return <span className="text-muted-foreground">-</span>;
}
