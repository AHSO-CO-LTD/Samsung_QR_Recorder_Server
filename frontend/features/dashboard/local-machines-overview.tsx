"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { DateText, MonoText, StatusBadge } from "@/features/shared/data-view";
import type { Machine, MachineRuntimeSession } from "@/features/shared/types";

type MachineRuntimeRow = {
  machine: Machine;
  session?: MachineRuntimeSession;
  isConnected: boolean;
  isRunning: boolean;
  sortScore: number;
};

export function LocalMachinesOverview() {
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<MachineRuntimeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showToast = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const [machineResult, sessionResult] = await Promise.allSettled([
          apiGet<Machine[]>("/machines"),
          apiGet<MachineRuntimeSession[]>("/runtime/sessions?take=200")
        ]);

        if (machineResult.status === "rejected") {
          throw machineResult.reason;
        }

        setMachines(machineResult.value.data ?? []);
        setSessions(sessionResult.status === "fulfilled" ? sessionResult.value.data ?? [] : []);

        if (sessionResult.status === "rejected" && showToast) {
          toast.error(sessionResult.reason instanceof Error ? sessionResult.reason.message : t("error"));
        }
      } catch (currentError) {
        const message = currentError instanceof Error ? currentError.message : t("error");
        setError(message);
        if (showToast) {
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const sessionByMachine = new Map<string, MachineRuntimeSession>();
    for (const session of sessions) {
      if (!sessionByMachine.has(session.machine_code)) {
        sessionByMachine.set(session.machine_code, session);
      }
    }

    return machines
      .map((machine): MachineRuntimeRow => {
        const session = sessionByMachine.get(machine.machine_code);
        const isRunning = session?.status === "RUNNING";
        const isOnline = machine.sync_state?.connection_status === "ONLINE";
        const isConnected = machine.is_active && (isRunning || isOnline);
        const sortScore = isRunning ? 0 : isOnline ? 1 : machine.is_active ? 2 : 3;
        return { machine, session, isConnected, isRunning, sortScore };
      })
      .sort((left, right) => left.sortScore - right.sortScore || left.machine.machine_code.localeCompare(right.machine.machine_code));
  }, [machines, sessions]);

  const connectedCount = rows.filter((row) => row.isConnected).length;

  return (
    <section className="min-w-0 space-y-3" aria-label={t("dashboardLocalMachines")}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold">{t("dashboardLocalMachines")}</h2>
            <InfoTooltip content={t("dashboardLocalMachinesDesc")} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="default">{connectedCount}/{rows.length} {t("connectedMachines")}</Badge>
            <span>{t("activeMachinesFirst")}</span>
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
        <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <MachineRuntimeCard key={row.machine.id} row={row} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MachineRuntimeCard({ row }: { row: MachineRuntimeRow }) {
  const { t } = useI18n();
  const { machine, session, isConnected, isRunning } = row;
  const currentProduct = session?.current_product?.product_code ?? null;
  const connectionStatus = isConnected ? (isRunning ? "RUNNING" : machine.sync_state?.connection_status ?? "ONLINE") : "DISCONNECTED";
  const total = session?.total_count ?? 0;
  const ok = session?.ok_count ?? 0;
  const ng = session?.ng_count ?? 0;

  return (
    <Card className={cn("relative overflow-hidden", !isConnected && "border-muted bg-muted/40 text-muted-foreground")}>
      {!isConnected ? (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t("machineNotConnected")}
        </div>
      ) : null}

      <div className={cn(!isConnected && "pt-6 grayscale")}>
        <CardHeader className="space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{machine.machine_name || machine.machine_code}</CardTitle>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <MonoText value={machine.machine_code} />
                <StatusBadge value={connectionStatus} />
              </div>
            </div>
            <Activity className={cn("h-5 w-5 shrink-0", isConnected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoTile label={t("colCurrentProduct")} value={<MonoText value={currentProduct ?? t("noCurrentProduct")} />} />
            <InfoTile label={t("colDuration")} value={session ? formatDuration(session.started_at, session.ended_at ?? session.last_seen_at) : "-"} />
            <InfoTile label={t("colHeartbeat")} value={<DateText value={machine.sync_state?.last_seen_at ?? session?.last_seen_at} />} />
            <InfoTile label={t("colPending")} value={String(machine.sync_state?.local_pending_sync ?? 0)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{t("sessionOkNgGraph")}</span>
              <span>{t("colTotal")}: {total}</span>
            </div>
            <OkNgBar ok={ok} ng={ng} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">OK {ok}</div>
              <div className="rounded-md border border-destructive/25 bg-destructive/10 px-2 py-1 text-destructive">NG {ng}</div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-background/60 px-2 py-1.5">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function OkNgBar({ ok, ng }: { ok: number; ng: number }) {
  const total = ok + ng;
  const okPercent = total > 0 ? Math.max(0, Math.min(100, (ok / total) * 100)) : 0;
  const ngPercent = total > 0 ? 100 - okPercent : 0;

  return (
    <div className="h-3 w-full overflow-hidden rounded-sm border bg-muted" aria-label={`OK ${ok}, NG ${ng}`}>
      {total > 0 ? (
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-500" style={{ width: `${okPercent}%` }} />
          <div className="h-full bg-destructive" style={{ width: `${ngPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(start: string, end?: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
