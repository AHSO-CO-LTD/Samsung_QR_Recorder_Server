"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isActivePath, type NavGroup } from "@/components/layout/navigation-config";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

type SecondaryNavbarProps = {
  group: NavGroup;
  pathname: string;
  onItemSelect?: () => void;
};

export function SecondaryNavbar({ group, pathname, onItemSelect }: SecondaryNavbarProps) {
  const { t } = useI18n();

  return (
    <nav className="absolute left-0 right-0 top-full z-30 bg-background" aria-label={t("secondaryNavigation")} data-app-header-overlay>
      <div className="w-full overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:px-4 lg:px-5 2xl:px-6 [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-max min-w-full items-center justify-center gap-2">
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = !item.external && isActivePath(pathname, item.href);
            const className = cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:border-sky-900 dark:hover:bg-sky-950/40 dark:hover:text-sky-300",
              isActive && "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-900 dark:bg-sky-950/70 dark:text-sky-200"
            );
            const content = (
              <>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{t(item.key)}</span>
                {item.external ? <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </>
            );

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  {item.external ? (
                    <a
                      className={className}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      data-nav-item={item.key}
                      onClick={onItemSelect}
                    >
                      {content}
                    </a>
                  ) : (
                    <Link
                      className={className}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      data-nav-item={item.key}
                      onClick={onItemSelect}
                    >
                      {content}
                    </Link>
                  )}
                </TooltipTrigger>
                <TooltipContent>{t(item.descriptionKey)}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
