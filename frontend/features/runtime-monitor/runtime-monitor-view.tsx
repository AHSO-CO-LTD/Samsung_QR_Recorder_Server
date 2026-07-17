"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
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
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import {
  MachineRuntimeCard,
  buildMachineRows,
  buildRuntimeSocketUrl,
  buildSessionLocalTrendData,
  buildSessionServerTrendData,
  type MachineRuntimeCardDisplayOptions,
  type RuntimeChartTimeAxis
} from "@/features/shared/machine-runtime-card";
import type { Machine, MachineRuntimeSession } from "@/features/shared/types";
import type { MessageKey } from "@/lib/i18n";

const RUNTIME_REFRESH_MS = 5000;
const TIME_AXIS_REFRESH_MS = 30000;
const COLUMN_STORAGE_KEY = "runtime-monitor-columns-per-row";
const DISPLAY_STORAGE_KEY = "runtime-monitor-display-options";

const defaultDisplayOptions: MachineRuntimeCardDisplayOptions = {
  machineInfo: true,
  currentProduct: true,
  duration: true,
  commonIssue: true,
  localChart: true,
  serverChart: true
};

const displayOptionKeys = Object.keys(defaultDisplayOptions) as Array<keyof MachineRuntimeCardDisplayOptions>;
const displayOptionLabelKeys: Record<keyof MachineRuntimeCardDisplayOptions, MessageKey> = {
  machineInfo: "showMachineInfo",
  currentProduct: "showCurrentProduct",
  duration: "showRuntimeDuration",
  commonIssue: "showCommonIssue",
  localChart: "showLocalChart",
  serverChart: "showServerChart"
};

export function RuntimeMonitorView() {
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
  const [columnsPerRow, setColumnsPerRow] = useState(1);
  const [displayOptions, setDisplayOptions] = useState<MachineRuntimeCardDisplayOptions>(defaultDisplayOptions);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [timeAxisNowMs, setTimeAxisNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showToast = false, background = false) => {
      if (!background) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const [machineResult, sessionResult] = await Promise.allSettled([
          apiGet<Machine[]>("/machines"),
          apiGet<MachineRuntimeSession[]>("/runtime/sessions?take=200&include_scans=true")
        ]);

        if (machineResult.status === "rejected") {
          throw machineResult.reason;
        }

        const nextMachines = (machineResult.value.data ?? []).filter((machine) => machine.is_active);
        const nextSessions = sessionResult.status === "fulfilled" ? sessionResult.value.data ?? [] : [];
        setMachines(nextMachines);
        setSessions(nextSessions);
        setTimeAxisNowMs(Date.now());
        setError(null);

        if (sessionResult.status === "rejected" && showToast) {
          toast.error(sessionResult.reason instanceof Error ? sessionResult.reason.message : t("error"));
        }
      } catch (currentError) {
        const message = currentError instanceof Error ? currentError.message : t("error");
        if (!background) {
          setError(message);
        }
        if (showToast) {
          toast.error(message);
        }
      } finally {
        if (!background) {
          setIsLoading(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    const savedValue = Number(window.localStorage.getItem(COLUMN_STORAGE_KEY));
    if (Number.isFinite(savedValue)) {
      setColumnsPerRow(clampColumnsPerRow(savedValue));
    }

    setDisplayOptions(readSavedDisplayOptions());
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("runtime-monitor:navigation-visibility", { detail: { hidden: isNavbarHidden } }));

    return () => {
      window.dispatchEvent(new CustomEvent("runtime-monitor:navigation-visibility", { detail: { hidden: false } }));
    };
  }, [isNavbarHidden]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load(false, true);
    }, RUNTIME_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeAxisNowMs(Date.now());
    }, TIME_AXIS_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const socket = io(buildRuntimeSocketUrl(), {
      transports: ["websocket", "polling"]
    });

    socket.on("server:runtime-updated", () => {
      void load(false, true);
    });

    return () => {
      socket.disconnect();
    };
  }, [load]);

  const rows = useMemo(() => {
    return buildMachineRows(machines, sessions);
  }, [machines, sessions]);

  const gridStyle = { "--machine-columns": columnsPerRow } as CSSProperties;

  const updateColumnsPerRow = (value: number) => {
    const nextValue = clampColumnsPerRow(value);
    setColumnsPerRow(nextValue);
    window.localStorage.setItem(COLUMN_STORAGE_KEY, String(nextValue));
  };

  const updateDisplayOption = (key: keyof MachineRuntimeCardDisplayOptions, checked: boolean) => {
    const nextOptions = {
      ...displayOptions,
      [key]: checked
    };
    setDisplayOptions(nextOptions);
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(nextOptions));
  };

  const resetDisplayOptions = () => {
    setDisplayOptions(defaultDisplayOptions);
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(defaultDisplayOptions));
  };

  return (
    <section className="min-w-0 space-y-1" aria-label={t("runtimeMonitor")}>
      <RuntimeDisplaySettingsMenu
        columnsPerRow={columnsPerRow}
        isLoading={isLoading}
        isNavbarHidden={isNavbarHidden}
        options={displayOptions}
        onColumnsPerRowChange={updateColumnsPerRow}
        onOptionChange={updateDisplayOption}
        onReload={() => void load(true)}
        onReset={resetDisplayOptions}
        onToggleNavbar={() => setIsNavbarHidden((current) => !current)}
      />

      {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:[grid-template-columns:repeat(var(--machine-columns),minmax(0,1fr))]" style={gridStyle}>
          {rows.map((row) => (
            <MachineRuntimeCard
              key={row.machine.id}
              row={row}
              liveData={[]}
              localTrendData={buildSessionLocalTrendData(row.session)}
              trendData={buildSessionServerTrendData(row.session)}
              timeAxis={buildRuntimeChartTimeAxis(columnsPerRow, timeAxisNowMs)}
              displayOptions={displayOptions}
              showCommonLocalNgReason
              localChartTitleKey="currentSessionOkNgGraph"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RuntimeDisplaySettingsMenu({
  columnsPerRow,
  isLoading,
  isNavbarHidden,
  options,
  onColumnsPerRowChange,
  onOptionChange,
  onReload,
  onReset,
  onToggleNavbar
}: {
  columnsPerRow: number;
  isLoading: boolean;
  isNavbarHidden: boolean;
  options: MachineRuntimeCardDisplayOptions;
  onColumnsPerRowChange: (value: number) => void;
  onOptionChange: (key: keyof MachineRuntimeCardDisplayOptions, checked: boolean) => void;
  onReload: () => void;
  onReset: () => void;
  onToggleNavbar: () => void;
}) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed right-2 z-[70] h-10 w-10 border bg-background/95 p-0 shadow-md backdrop-blur"
          style={{ top: "calc(var(--app-header-height, 0px) + 0.5rem)" }}
          aria-label={t("runtimeDisplaySettings")}
          title={t("runtimeDisplaySettings")}
        >
          <AppLogo className="h-8 w-8" imageClassName="h-6 w-6" />
          <span className="sr-only">{t("runtimeDisplaySettings")}</span>
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
        {displayOptionKeys.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={options[key]}
            onCheckedChange={(checked) => onOptionChange(key, Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
          >
            {t(displayOptionLabelKeys[key])}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          onReload();
        }}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
          {t("retry")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          onToggleNavbar();
        }}>
          {isNavbarHidden ? t("showNavbar") : t("hideNavbar")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onReset}>{t("showAllRuntimeInfo")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function readSavedDisplayOptions() {
  const rawValue = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
  if (!rawValue) {
    return defaultDisplayOptions;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return defaultDisplayOptions;
    }

    return displayOptionKeys.reduce<MachineRuntimeCardDisplayOptions>(
      (currentOptions, key) => ({
        ...currentOptions,
        [key]: typeof parsedValue[key] === "boolean" ? parsedValue[key] : defaultDisplayOptions[key]
      }),
      defaultDisplayOptions
    );
  } catch {
    return defaultDisplayOptions;
  }
}

function clampColumnsPerRow(value: number) {
  return Math.min(3, Math.max(1, Math.round(value)));
}

function buildRuntimeChartTimeAxis(columnsPerRow: number, nowMs: number): RuntimeChartTimeAxis {
  const columns = clampColumnsPerRow(columnsPerRow);

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
