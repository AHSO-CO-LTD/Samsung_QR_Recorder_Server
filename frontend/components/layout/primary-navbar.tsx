"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navGroups, type NavGroupId } from "@/components/layout/navigation-config";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

type PrimaryNavbarProps = {
  selectedGroupId: NavGroupId;
  activeGroupId: NavGroupId;
  onSelectGroup: (groupId: NavGroupId) => void;
  className?: string;
};

export function PrimaryNavbar({ selectedGroupId, activeGroupId, onSelectGroup, className }: PrimaryNavbarProps) {
  const { t } = useI18n();

  return (
    <nav className={cn("min-w-0 overflow-hidden", className)} aria-label={t("primaryNavigation")}>
      <div className="flex flex-nowrap justify-start gap-1 overflow-x-auto [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden">
        {navGroups.map((group) => {
          const Icon = group.icon;
          const isSelected = selectedGroupId === group.id;
          const isActive = activeGroupId === group.id;

          return (
            <Tooltip key={group.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-nav-group={group.id}
                  aria-pressed={isSelected}
                  onClick={() => onSelectGroup(group.id)}
                  className={cn(
                    "inline-flex h-9 min-w-24 shrink-0 items-center justify-center gap-2 rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sky-50 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-w-28 sm:px-3 sm:text-sm dark:hover:bg-sky-950/40 dark:hover:text-sky-300",
                    isSelected && "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200",
                    isActive && !isSelected && "text-sky-700 dark:text-sky-300"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{t(group.key)}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(group.descriptionKey)}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
