"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, API_BASE_URL } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { MachineRuntimeAdjustmentLog, MachineRuntimeEvent, MachineRuntimeProduct, MachineRuntimeSession, ScanRecord } from "@/features/shared/types";

export function RuntimeView() {
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MachineRuntimeSession | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const socket = io(buildRuntimeSocketUrl(), {
      transports: ["websocket", "polling"]
    });
    socket.on("server:runtime-updated", () => {
      setRefreshId((value) => value + 1);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const openSession = useCallback(
    async (id: number) => {
      setSelectedSession(null);
      setIsDetailsOpen(true);
      setIsLoadingDetails(true);
      try {
        const result = await apiGet<MachineRuntimeSession>(`/runtime/sessions/${id}`);
        setSelectedSession(result.data ?? null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("error"));
        setIsDetailsOpen(false);
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [t]
  );

  const columns = useMemo<Column<MachineRuntimeSession>[]>(
    () => [
      { key: "session", header: t("colSession"), render: (item) => <MonoText value={item.session_code} /> },
      { key: "machine", header: t("colMachine"), render: (item) => <MonoText value={item.machine_code} /> },
      { key: "status", header: t("colStatus"), render: (item) => <StatusBadge value={item.status} /> },
      { key: "product", header: t("colCurrentProduct"), render: (item) => <MonoText value={item.current_product?.product_code} /> },
      { key: "duration", header: t("colDuration"), render: (item) => formatDuration(item.started_at, item.ended_at ?? item.last_seen_at) },
      { key: "total", header: t("colTotal"), render: (item) => item.total_count },
      { key: "ok", header: t("colOk"), render: (item) => item.ok_count },
      { key: "ng", header: t("colNg"), render: (item) => item.ng_count },
      { key: "reconnect", header: t("colReconnect"), render: (item) => item.reconnect_count },
      { key: "last_seen", header: t("colHeartbeat"), render: (item) => <DateText value={item.last_seen_at} /> },
      {
        key: "actions",
        header: t("colActions"),
        className: "w-32 text-right",
        render: (item) => (
          <Button type="button" variant="outline" size="sm" onClick={() => void openSession(item.id)}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            {t("viewDetails")}
          </Button>
        )
      }
    ],
    [openSession, t]
  );

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("runtimeImmutableNotice")}</span>
      </div>
      <DataTablePanel
        title={t("runtimeSessionList")}
        endpoint={`/runtime/sessions?take=100&refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
        emptyText={t("noRuntimeSessions")}
        searchableText={(item) =>
          `${item.session_code} ${item.machine_code} ${item.status} ${item.current_product?.product_code ?? ""} ${item.last_result ?? ""} ${item.last_code ?? ""}`
        }
      />

      <Dialog
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setSelectedSession(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSession ? `${t("colSession")} ${selectedSession.session_code}` : t("viewDetails")}</DialogTitle>
          </DialogHeader>
          {isLoadingDetails ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
          {!isLoadingDetails && selectedSession ? <SessionDetails session={selectedSession} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionDetails({ session }: { session: MachineRuntimeSession }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoLine label={t("colMachine")} value={<MonoText value={session.machine_code} />} />
        <InfoLine label={t("colStatus")} value={<StatusBadge value={session.status} />} />
        <InfoLine label={t("colDuration")} value={formatDuration(session.started_at, session.ended_at ?? session.last_seen_at)} />
        <InfoLine label={t("colTotal")} value={`${session.total_count} / OK ${session.ok_count} / NG ${session.ng_count}`} />
        <InfoLine label={t("colStartedAt")} value={<DateText value={session.started_at} />} />
        <InfoLine label={t("colEndedAt")} value={<DateText value={session.ended_at} />} />
        <InfoLine label={t("colLastResult")} value={<StatusBadge value={session.last_result} />} />
        <InfoLine label={t("colLastCode")} value={<MonoText value={session.last_code} />} />
      </div>

      <SimpleSection title={t("runtimeProducts")} emptyText={t("noRuntimeProducts")} items={session.products ?? []} render={(items) => <ProductTable items={items} />} />
      <SimpleSection title={t("runtimeEvents")} emptyText={t("noRuntimeEvents")} items={session.events ?? []} render={(items) => <EventTable items={items} />} />
      <SimpleSection title={t("runtimeScans")} emptyText={t("noRuntimeScans")} items={session.scan_records ?? []} render={(items) => <ScanTable items={items} />} />
      <SimpleSection
        title={t("runtimeAdjustments")}
        emptyText={t("noRuntimeAdjustments")}
        items={session.adjustments ?? []}
        render={(items) => <AdjustmentTable items={items} />}
      />
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function SimpleSection<T>({ title, emptyText, items, render }: { title: string; emptyText: string; items: T[]; render: (items: T[]) => ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{emptyText}</div> : render(items)}
    </section>
  );
}

function ProductTable({ items }: { items: MachineRuntimeProduct[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colProduct")}</TableHead>
            <TableHead>{t("colProfile")}</TableHead>
            <TableHead>{t("colStartedAt")}</TableHead>
            <TableHead>{t("colEndedAt")}</TableHead>
            <TableHead>{t("colTotal")}</TableHead>
            <TableHead>{t("colOk")}</TableHead>
            <TableHead>{t("colNg")}</TableHead>
            <TableHead>{t("colLastResult")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><MonoText value={item.product_code} /></TableCell>
              <TableCell><MonoText value={item.profile?.chassis_code?.code_full ?? item.profile_id} /></TableCell>
              <TableCell><DateText value={item.started_at} /></TableCell>
              <TableCell><DateText value={item.ended_at} /></TableCell>
              <TableCell>{item.total_count}</TableCell>
              <TableCell>{item.ok_count}</TableCell>
              <TableCell>{item.ng_count}</TableCell>
              <TableCell><StatusBadge value={item.last_result} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EventTable({ items }: { items: MachineRuntimeEvent[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colTime")}</TableHead>
            <TableHead>{t("colEvent")}</TableHead>
            <TableHead>{t("colProduct")}</TableHead>
            <TableHead>{t("colTotal")}</TableHead>
            <TableHead>{t("colOk")}</TableHead>
            <TableHead>{t("colNg")}</TableHead>
            <TableHead>{t("colLastCode")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><DateText value={item.created_at} /></TableCell>
              <TableCell><MonoText value={item.event_type} /></TableCell>
              <TableCell><MonoText value={item.product_code} /></TableCell>
              <TableCell>{item.total_count ?? "-"}</TableCell>
              <TableCell>{item.ok_count ?? "-"}</TableCell>
              <TableCell>{item.ng_count ?? "-"}</TableCell>
              <TableCell><MonoText value={item.last_code} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ScanTable({ items }: { items: ScanRecord[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colScanTime")}</TableHead>
            <TableHead>{t("colLocalId")}</TableHead>
            <TableHead>{t("colProfile")}</TableHead>
            <TableHead>{t("colFullCode")}</TableHead>
            <TableHead>{t("colFinal")}</TableHead>
            <TableHead>{t("colNgReason")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell><DateText value={item.scan_at} /></TableCell>
              <TableCell><MonoText value={item.local_scan_id} /></TableCell>
              <TableCell><MonoText value={item.profile?.chassis_code?.code_full} /></TableCell>
              <TableCell><MonoText value={item.full_code_raw} /></TableCell>
              <TableCell><StatusBadge value={item.final_status} /></TableCell>
              <TableCell>{item.ng_reason || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdjustmentTable({ items }: { items: MachineRuntimeAdjustmentLog[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colTime")}</TableHead>
            <TableHead>{t("colProduct")}</TableHead>
            <TableHead>{t("colUser")}</TableHead>
            <TableHead>{t("colReason")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <DateText value={item.created_at} />
              </TableCell>
              <TableCell>
                <MonoText value={item.product_id} />
              </TableCell>
              <TableCell>{item.adjustedBy?.full_name ?? item.adjustedBy?.username ?? "-"}</TableCell>
              <TableCell>{item.reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function buildRuntimeSocketUrl() {
  return API_BASE_URL.replace(/\/api\/?$/, "") + "/machine-runtime";
}

function formatDuration(start: string, end?: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
