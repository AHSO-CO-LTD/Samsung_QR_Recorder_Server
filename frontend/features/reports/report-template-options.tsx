"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReportTemplateId } from "@/features/reports/report-export-templates";

export type ReportTemplateOption = {
  id: ReportTemplateId;
  title: string;
  description: string;
  columnCount: number;
};

type ReportTemplateOptionsProps = {
  options: readonly ReportTemplateOption[];
  selectedId: ReportTemplateId | null;
  onSelect: (id: ReportTemplateId) => void;
};

export function ReportTemplateOptions({ options, selectedId, onSelect }: ReportTemplateOptionsProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3" role="group">
      {options.map((option) => {
        const isSelected = option.id === selectedId;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            className={cn(
              "min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              isSelected ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"
            )}
            onClick={() => onSelect(option.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold">{option.title}</span>
              <Badge variant={isSelected ? "default" : "secondary"}>{option.columnCount}</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}
