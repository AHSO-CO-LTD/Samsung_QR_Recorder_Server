"use client";

import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import type { MachineRuntimeCardDisplayOptions } from "@/features/shared/machine-runtime-card";
import {
  runtimeDisplayOptionKeys,
  runtimeDisplayOptionLabelKeys
} from "@/features/shared/runtime-display-preferences";

type RuntimeDisplaySettingsMenuProps = {
  columnsPerRow: number;
  isLoading?: boolean;
  isNavbarHidden?: boolean;
  options: MachineRuntimeCardDisplayOptions;
  placement?: "inline" | "floating";
  onColumnsPerRowChange: (value: number) => void;
  onOptionChange: (key: keyof MachineRuntimeCardDisplayOptions, checked: boolean) => void;
  onReload?: () => void;
  onReset: () => void;
  onToggleNavbar?: () => void;
};

export function RuntimeDisplaySettingsMenu({
  columnsPerRow,
  isLoading = false,
  isNavbarHidden = false,
  options,
  placement = "inline",
  onColumnsPerRowChange,
  onOptionChange,
  onReload,
  onReset,
  onToggleNavbar
}: RuntimeDisplaySettingsMenuProps) {
  const { t } = useI18n();
  const isFloating = placement === "floating";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={isFloating ? "icon" : "sm"}
          className={cn(
            isFloating
              ? "fixed right-2 z-[70] h-10 w-10 border bg-background/95 p-0 shadow-md backdrop-blur"
              : "w-full gap-2 sm:w-auto"
          )}
          style={isFloating ? { top: "calc(var(--app-header-height, 0px) + 0.5rem)" } : undefined}
          aria-label={t("runtimeDisplaySettings")}
          title={t("runtimeDisplaySettings")}
        >
          {isFloating ? (
            <AppLogo className="h-8 w-8" imageClassName="h-6 w-6" />
          ) : (
            <>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {t("runtimeDisplaySettings")}
            </>
          )}
          {isFloating ? <span className="sr-only">{t("runtimeDisplaySettings")}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("runtimeDisplaySettings")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="mb-2 text-xs text-muted-foreground">{t("machinesPerRow")}</div>
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={columnsPerRow === value ? "default" : "outline"}
                className="h-7 px-2"
                aria-pressed={columnsPerRow === value}
                onClick={(event) => {
                  event.preventDefault();
                  onColumnsPerRowChange(value);
                }}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        {runtimeDisplayOptionKeys.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={options[key]}
            onCheckedChange={(checked) => onOptionChange(key, Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
          >
            {t(runtimeDisplayOptionLabelKeys[key])}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {onReload ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onReload();
            }}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
            {t("retry")}
          </DropdownMenuItem>
        ) : null}
        {onToggleNavbar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onToggleNavbar();
            }}
          >
            {isNavbarHidden ? t("showNavbar") : t("hideNavbar")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onReset}>{t("showAllRuntimeInfo")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
