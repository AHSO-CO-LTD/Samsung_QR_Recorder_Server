"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  showTopScrollbar?: boolean;
  topScrollbarLabel?: string;
};

export function Table({ className, showTopScrollbar = false, topScrollbarLabel, ...props }: TableProps) {
  const tableRef = React.useRef<HTMLTableElement>(null);
  const topScrollbarRef = React.useRef<HTMLDivElement>(null);
  const bottomScrollbarRef = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = React.useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = React.useState(false);

  React.useEffect(() => {
    if (!showTopScrollbar) {
      return;
    }

    const table = tableRef.current;
    const bottomScrollbar = bottomScrollbarRef.current;
    if (!table || !bottomScrollbar) {
      return;
    }

    const updateScrollMetrics = () => {
      const nextScrollWidth = table.scrollWidth;
      const nextHasOverflow = nextScrollWidth > bottomScrollbar.clientWidth + 1;

      setScrollWidth((current) => (current === nextScrollWidth ? current : nextScrollWidth));
      setHasHorizontalOverflow((current) => (current === nextHasOverflow ? current : nextHasOverflow));
    };

    updateScrollMetrics();

    const resizeObserver = new ResizeObserver(updateScrollMetrics);
    resizeObserver.observe(table);
    resizeObserver.observe(bottomScrollbar);

    return () => resizeObserver.disconnect();
  }, [showTopScrollbar]);

  React.useEffect(() => {
    if (hasHorizontalOverflow && topScrollbarRef.current && bottomScrollbarRef.current) {
      topScrollbarRef.current.scrollLeft = bottomScrollbarRef.current.scrollLeft;
    }
  }, [hasHorizontalOverflow, scrollWidth]);

  const syncScrollPosition = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (target && target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  };

  return (
    <>
      {showTopScrollbar && hasHorizontalOverflow ? (
        <div
          ref={topScrollbarRef}
          className="mb-2 w-full min-w-0 overflow-x-auto overflow-y-hidden"
          role="region"
          aria-label={topScrollbarLabel}
          tabIndex={0}
          onScroll={(event) => syncScrollPosition(event.currentTarget, bottomScrollbarRef.current)}
        >
          <div className="h-px" style={{ width: scrollWidth }} aria-hidden="true" />
        </div>
      ) : null}
      <div
        ref={bottomScrollbarRef}
        className="w-full min-w-0 overflow-x-auto"
        onScroll={(event) => syncScrollPosition(event.currentTarget, topScrollbarRef.current)}
      >
        <table ref={tableRef} className={cn("w-full min-w-[720px] caption-bottom text-sm", className)} {...props} />
      </div>
    </>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/50", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-3 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />;
}
