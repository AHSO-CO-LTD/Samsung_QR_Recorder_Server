import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardSectionHeaderProps = {
  title: string;
  description?: string;
  headingId?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DashboardSectionHeader({
  title,
  description,
  headingId,
  metadata,
  actions,
  className
}: DashboardSectionHeaderProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {metadata}
        </div>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
