"use client";

import { useCallback, useEffect, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { MachineRuntimeCardDisplayOptions, RuntimeChartTimeAxis } from "@/features/shared/machine-runtime-card";

const COLUMN_STORAGE_KEY = "runtime-monitor-columns-per-row";
const DISPLAY_STORAGE_KEY = "runtime-monitor-display-options";

export const defaultRuntimeDisplayOptions: MachineRuntimeCardDisplayOptions = {
  machineInfo: true,
  currentProduct: true,
  duration: true,
  commonIssue: true,
  serverChart: true
};

export const runtimeDisplayOptionKeys = Object.keys(
  defaultRuntimeDisplayOptions
) as Array<keyof MachineRuntimeCardDisplayOptions>;

export const runtimeDisplayOptionLabelKeys: Record<keyof MachineRuntimeCardDisplayOptions, MessageKey> = {
  machineInfo: "showMachineInfo",
  currentProduct: "showCurrentProduct",
  duration: "showRuntimeDuration",
  commonIssue: "showCommonIssue",
  serverChart: "showServerChart"
};

export function useRuntimeDisplayPreferences() {
  const [columnsPerRow, setColumnsPerRow] = useState(1);
  const [displayOptions, setDisplayOptions] = useState<MachineRuntimeCardDisplayOptions>(defaultRuntimeDisplayOptions);

  useEffect(() => {
    const savedColumns = Number(window.localStorage.getItem(COLUMN_STORAGE_KEY));
    if (Number.isFinite(savedColumns)) {
      setColumnsPerRow(clampRuntimeColumnsPerRow(savedColumns));
    }
    setDisplayOptions(readSavedDisplayOptions());
  }, []);

  const updateColumnsPerRow = useCallback((value: number) => {
    const nextValue = clampRuntimeColumnsPerRow(value);
    setColumnsPerRow(nextValue);
    window.localStorage.setItem(COLUMN_STORAGE_KEY, String(nextValue));
  }, []);

  const updateDisplayOption = useCallback((key: keyof MachineRuntimeCardDisplayOptions, checked: boolean) => {
    setDisplayOptions((currentOptions) => {
      const nextOptions = { ...currentOptions, [key]: checked };
      window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(nextOptions));
      return nextOptions;
    });
  }, []);

  const resetDisplayOptions = useCallback(() => {
    setDisplayOptions(defaultRuntimeDisplayOptions);
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(defaultRuntimeDisplayOptions));
  }, []);

  return {
    columnsPerRow,
    displayOptions,
    updateColumnsPerRow,
    updateDisplayOption,
    resetDisplayOptions
  };
}

export function clampRuntimeColumnsPerRow(value: number) {
  return Math.min(3, Math.max(1, Math.round(value)));
}

export function buildRuntimeChartTimeAxis(columnsPerRow: number, nowMs: number): RuntimeChartTimeAxis {
  const columns = clampRuntimeColumnsPerRow(columnsPerRow);

  if (columns === 1) {
    return {
      bucketMinutes: 30,
      maxBuckets: 25,
      maxTicks: 9,
      nowMs
    };
  }

  if (columns === 2) {
    return {
      bucketMinutes: 30,
      maxBuckets: 25,
      maxTicks: 7,
      nowMs
    };
  }

  return {
    bucketMinutes: 60,
    maxBuckets: 13,
    maxTicks: 5,
    nowMs
  };
}

function readSavedDisplayOptions(): MachineRuntimeCardDisplayOptions {
  const rawValue = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
  if (!rawValue) {
    return defaultRuntimeDisplayOptions;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return defaultRuntimeDisplayOptions;
    }

    return runtimeDisplayOptionKeys.reduce<MachineRuntimeCardDisplayOptions>(
      (currentOptions, key) => ({
        ...currentOptions,
        [key]: typeof parsedValue[key] === "boolean" ? parsedValue[key] : defaultRuntimeDisplayOptions[key]
      }),
      defaultRuntimeDisplayOptions
    );
  } catch {
    return defaultRuntimeDisplayOptions;
  }
}
