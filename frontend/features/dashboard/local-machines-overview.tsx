"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import {
  MachineRuntimeCard,
  SERVER_TREND_BUCKET_MINUTES,
  SERVER_TREND_HOURS,
  appendLiveSample,
  appendRuntimeSnapshotSamples,
  buildLiveSample,
  buildMachineRows,
  buildRuntimeSocketUrl,
  emptyTrendData,
  getLiveSampleKey,
  type RuntimeUpdatedPayload,
  type ScanTrendPoint,
  type TrendByMachine
} from "@/features/shared/machine-runtime-card";
import type { Machine, MachineRuntimeSession } from "@/features/shared/types";

const RUNTIME_REFRESH_MS = 5000;
const TREND_REFRESH_MS = 30000;

export function LocalMachinesOverview() {
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
  const [trendByMachine, setTrendByMachine] = useState<TrendByMachine>({});
  const [liveByMachine, setLiveByMachine] = useState<TrendByMachine>({});
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
          apiGet<MachineRuntimeSession[]>("/runtime/sessions?take=200")
        ]);

        if (machineResult.status === "rejected") {
          throw machineResult.reason;
        }

        const nextMachines = (machineResult.value.data ?? []).filter((machine) => machine.is_active);
        const nextSessions = sessionResult.status === "fulfilled" ? sessionResult.value.data ?? [] : [];
        setMachines(nextMachines);
        setSessions(nextSessions);
        setLiveByMachine((current) => appendRuntimeSnapshotSamples(current, nextMachines, nextSessions));
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

  const machineCodesKey = useMemo(() => machines.map((machine) => machine.machine_code).sort().join("|"), [machines]);

  const loadTrendData = useCallback(
    async (showToast = false) => {
      const machineCodes = machineCodesKey ? machineCodesKey.split("|") : [];
      if (machineCodes.length === 0) {
        setTrendByMachine({});
        return;
      }

      try {
        const entries = await Promise.all(
          machineCodes.map(async (machineCode) => {
            const result = await apiGet<ScanTrendPoint[]>(
              `/scans/trend?hours=${SERVER_TREND_HOURS}&bucket_minutes=${SERVER_TREND_BUCKET_MINUTES}&machine_code=${encodeURIComponent(machineCode)}`
            );
            return [machineCode, result.data ?? emptyTrendData] as const;
          })
        );
        setTrendByMachine(Object.fromEntries(entries));
      } catch (trendError) {
        if (showToast) {
          toast.error(trendError instanceof Error ? trendError.message : t("error"));
        }
      }
    },
    [machineCodesKey, t]
  );

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
    const socket = io(buildRuntimeSocketUrl(), {
      transports: ["websocket", "polling"]
    });

    socket.on("server:runtime-updated", (payload: RuntimeUpdatedPayload) => {
      void load(false, true);
      void loadTrendData();
      const liveSample = buildLiveSample(payload);
      if (liveSample) {
        setLiveByMachine((current) => appendLiveSample(current, getLiveSampleKey(liveSample), liveSample.point));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [load, loadTrendData]);

  useEffect(() => {
    void loadTrendData();
    const interval = window.setInterval(() => {
      void loadTrendData();
    }, TREND_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadTrendData]);

  const rows = useMemo(() => {
    return buildMachineRows(machines, sessions);
  }, [machines, sessions]);

  const connectedCount = rows.filter((row) => row.isConnected).length;

  return (
    <section className="min-w-0 space-y-3" aria-label={t("dashboardLocalMachines")}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{t("dashboardLocalMachines")}</h2>
            <Badge variant="default" className="shrink-0">{connectedCount}/{rows.length} {t("connectedMachines")}</Badge>
            <InfoTooltip content={t("dashboardLocalMachinesDesc")} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={isLoading} className="w-full sm:w-auto">
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>

      {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
      {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 34rem), 1fr))" }}>
          {rows.map((row) => (
            <MachineRuntimeCard
              key={row.machine.id}
              row={row}
              trendData={trendByMachine[row.machine.machine_code] ?? emptyTrendData}
              liveData={liveByMachine[row.machine.machine_code] ?? []}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
