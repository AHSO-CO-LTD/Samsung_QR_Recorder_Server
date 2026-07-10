"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiDelete, apiPost } from "@/lib/api";
import { ConfirmActionDialog } from "@/features/shared/confirm-action-dialog";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { Machine } from "@/features/shared/types";

const emptyMachine = {
  machine_code: "",
  machine_name: "",
  line_name: "",
  station_name: "",
  ip_address: ""
};

export function MachinesView() {
  const [refreshId, setRefreshId] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(emptyMachine);
  const [target, setTarget] = useState<Machine | null>(null);

  const columns: Column<Machine>[] = [
    { key: "code", header: "Mã máy", render: (item) => <MonoText value={item.machine_code} /> },
    { key: "name", header: "Tên máy", render: (item) => item.machine_name },
    { key: "line", header: "Line/Trạm", render: (item) => `${item.line_name || "-"} / ${item.station_name || "-"}` },
    { key: "ip", header: "IP", render: (item) => <MonoText value={item.ip_address} /> },
    { key: "connection", header: "Kết nối", render: (item) => <StatusBadge value={item.sync_state?.connection_status || "UNKNOWN"} /> },
    { key: "pending", header: "Pending", render: (item) => item.sync_state?.local_pending_sync ?? 0 },
    { key: "last_seen", header: "Heartbeat", render: (item) => <DateText value={item.sync_state?.last_seen_at} /> },
    { key: "active", header: "Trạng thái", render: (item) => <StatusBadge value={item.is_active} /> },
    {
      key: "actions",
      header: "Thao tác",
      className: "w-28 text-right",
      render: (item) => (
        <Button type="button" variant="outline" size="sm" onClick={() => setTarget(item)} disabled={!item.is_active}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Tắt
        </Button>
      )
    }
  ];

  const saveMachine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiPost("/machines", draft);
      toast.success("Đã tạo máy local.");
      setDraft(emptyMachine);
      setIsCreateOpen(false);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được máy.");
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateMachine = async () => {
    if (!target) {
      return;
    }

    setIsSaving(true);
    try {
      await apiDelete(`/machines/${target.id}`);
      toast.success("Đã vô hiệu hóa máy local.");
      setTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không vô hiệu hóa được máy.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Máy local" description="Quản lý máy được phép gửi heartbeat, scan và batch sync vào server." />
      <DataTablePanel
        title="Danh sách máy"
        endpoint={`/machines?refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
        actions={
          <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm máy
          </Button>
        }
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm máy local</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveMachine}>
            <Input required placeholder="Mã máy, ví dụ LOCAL01" value={draft.machine_code} onChange={(event) => setDraft({ ...draft, machine_code: event.target.value })} />
            <Input required placeholder="Tên máy" value={draft.machine_name} onChange={(event) => setDraft({ ...draft, machine_name: event.target.value })} />
            <Input placeholder="Line" value={draft.line_name} onChange={(event) => setDraft({ ...draft, line_name: event.target.value })} />
            <Input placeholder="Trạm" value={draft.station_name} onChange={(event) => setDraft({ ...draft, station_name: event.target.value })} />
            <Input placeholder="IP cấu hình" value={draft.ip_address} onChange={(event) => setDraft({ ...draft, ip_address: event.target.value })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSaving}>
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Vô hiệu hóa máy?"
        description={`Máy ${target?.machine_code ?? ""} sẽ không được submit scan hoặc heartbeat nữa.`}
        confirmLabel="Vô hiệu hóa"
        isRunning={isSaving}
        onConfirm={() => void deactivateMachine()}
      />
    </div>
  );
}
