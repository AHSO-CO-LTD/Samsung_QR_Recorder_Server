"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit p-0", className)}
      classNames={{
        root: cn("relative", defaultClassNames.root),
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex h-9 items-center justify-center px-10",
        caption_label: "text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8"),
        button_next: cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-normal text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "h-9 w-9 rounded-md p-0 font-normal transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&>button]:border [&>button]:border-primary [&>button]:font-semibold",
        outside: "[&>button]:text-muted-foreground [&>button]:opacity-45",
        disabled: "[&>button]:cursor-not-allowed [&>button]:text-muted-foreground [&>button]:opacity-35",
        hidden: "invisible",
        ...classNames
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : orientation === "up"
                  ? ChevronUp
                  : ChevronDown;
          return <Icon className={cn("h-4 w-4", chevronClassName)} aria-hidden="true" />;
        }
      }}
      {...props}
    />
  );
}
