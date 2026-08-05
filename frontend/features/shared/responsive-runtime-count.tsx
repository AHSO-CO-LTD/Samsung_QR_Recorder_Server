"use client";

import { useEffect, useRef, useState } from "react";
import { formatRuntimeCount, formatRuntimeCountFull } from "@/features/shared/runtime-count";
import { useI18n } from "@/lib/i18n-provider";

export function ResponsiveRuntimeCount({ value }: { value: number }) {
  const { locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLSpanElement>(null);
  const [shouldCompact, setShouldCompact] = useState(false);
  const fullValue = formatRuntimeCountFull(value, locale);
  const compactValue = formatRuntimeCount(value, locale);

  useEffect(() => {
    const container = containerRef.current;
    const measurement = measurementRef.current;
    if (!container || !measurement) {
      return;
    }

    const updateDisplayMode = () => {
      const styles = window.getComputedStyle(container);
      const availableWidth =
        container.clientWidth -
        Number.parseFloat(styles.paddingLeft || "0") -
        Number.parseFloat(styles.paddingRight || "0");
      const nextShouldCompact = measurement.getBoundingClientRect().width > availableWidth;
      setShouldCompact((current) => (current === nextShouldCompact ? current : nextShouldCompact));
    };

    updateDisplayMode();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateDisplayMode);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [fullValue]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 items-center justify-end border-l px-3 py-2 text-right font-mono font-semibold tabular-nums"
      title={fullValue}
      aria-label={fullValue}
    >
      <span ref={measurementRef} className="pointer-events-none absolute invisible whitespace-nowrap" aria-hidden="true">
        {fullValue}
      </span>
      <span className="min-w-0 truncate">{shouldCompact ? compactValue : fullValue}</span>
    </div>
  );
}
