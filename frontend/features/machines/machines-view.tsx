"use client";

import { FormEvent, useMemo, useState } from "react";
import { MessageSquarePlus, Pencil, Plus, Power, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";
import { SelectField, TextAreaField, TextInputField } from "@/features/shared/form-fields";
import { MachineRegistrationRequestsPanel } from "@/features/machines/machine-registration-requests-panel";
import { ConfirmActionDialog } from "@/features/shared/confirm-action-dialog";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { Machine, MachineCommand } from "@/features/shared/types";

type MachineDraft = {
  machine_code: string;
  machine_name: string;
};

type CommandDraft = {
  command_type: MachineCommand["command_type"];
  payload_text: string;
};

const emptyMachineDraft: MachineDraft = {
  machine_code: "",
  machine_name: ""
};

const emptyCommandDraft: CommandDraft = {
  command_type: "SYNC_PROFILE",
  payload_text: ""
};

export function MachinesView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [commandRefreshId, setCommandRefreshId] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<MachineDraft>(emptyMachineDraft);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [target, setTarget] = useState<Machine | null>(null);
  const [commandMachine, setCommandMachine] = useState<Machine | null>(null);
  const [commandDraft, setCommandDraft] = useState<CommandDraft>(emptyCommandDraft);
  const canViewIdentity = user?.role === "DEV";

  const columns = useMemo<Column<Machine>[]>(
    () => [
      { key: "code", header: t("colMachineCode"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={item.machine_code} /> },
      { key: "name", header: t("colMachineName"), className: "min-w-[12rem]", render: (item) => item.machine_name },
      ...(canViewIdentity
        ? [
            { key: "serial", header: t("colSerial"), className: "min-w-[10rem] whitespace-nowrap", render: (item: Machine) => <MonoText value={item.serial} /> },
            { key: "uid", header: t("colUid"), className: "min-w-[10rem] whitespace-nowrap", render: (item: Machine) => <MonoText value={item.uid} /> }
          ]
        : []),
      { key: "license", header: t("colLicense"), className: "w-28 min-w-[7rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.license_activated_at ? "ACTIVATED" : "NOT_ACTIVE"} /> },
      { key: "ip", header: t("colIp"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={item.sync_state?.last_ip_address ?? item.ip_address} /> },
      { key: "connection", header: t("colConnection"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.sync_state?.connection_status || "UNKNOWN"} /> },
      { key: "pending", header: t("colPending"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => item.sync_state?.local_pending_sync ?? 0 },
      { key: "last_seen", header: t("colHeartbeat"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.sync_state?.last_seen_at} /> },
      { key: "active", header: t("colStatus"), className: "w-28 min-w-[7rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.is_active} /> },
      {
        key: "actions",
        header: t("colActions"),
        className: "w-56 text-right",
        render: (item) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openForm(item)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("edit")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openCommandDialog(item)}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              {t("commandButton")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setTarget(item)} disabled={!item.is_active}>
              <Power className="h-4 w-4" aria-hidden="true" />
              {t("deactivate")}
            </Button>
          </div>
        )
      }
    ],
    [canViewIdentity, t]
  );

  const commandColumns: Column<MachineCommand>[] = [
    { key: "type", header: t("colCommand"), render: (item) => <MonoText value={item.command_type} /> },
    { key: "status", header: t("colStatus"), render: (item) => <StatusBadge value={item.status} /> },
    { key: "created", header: t("colCreatedAt"), render: (item) => <DateText value={item.created_at} /> },
    { key: "sent", header: t("colSent"), render: (item) => <DateText value={item.sent_at} /> },
    { key: "ack", header: t("colAck"), render: (item) => <DateText value={item.ack_at} /> },
    { key: "error", header: t("colError"), render: (item) => item.error_message || "-" }
  ];

  const openForm = (machine?: Machine) => {
    setEditingMachine(machine ?? null);
    setDraft(
      machine
        ? {
            machine_code: machine.machine_code,
            machine_name: machine.machine_name
          }
        : emptyMachineDraft
    );
    setIsFormOpen(true);
  };

  const openCommandDialog = (machine: Machine) => {
    setCommandMachine(machine);
    setCommandDraft(emptyCommandDraft);
    setCommandRefreshId((value) => value + 1);
  };

  const saveMachine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (editingMachine) {
        await apiPatch(`/machines/${editingMachine.id}`, {
          machine_name: draft.machine_name
        });
        toast.success(t("machineUpdated"));
      } else {
        await apiPost("/machines", {
          machine_code: draft.machine_code,
          machine_name: draft.machine_name
        });
        toast.success(t("machineCreated"));
      }
      setIsFormOpen(false);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("machineSaveFailed"));
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
      toast.success(t("machineDeactivated"));
      setTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("machineDeactivateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const sendCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commandMachine) {
      return;
    }

    setIsSaving(true);
    try {
      await apiPost(`/machines/${commandMachine.id}/commands`, {
        command_type: commandDraft.command_type,
        payload_json: parsePayload(commandDraft.payload_text)
      });
      toast.success(t("commandSent"));
      setCommandDraft(emptyCommandDraft);
      setCommandRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commandSendFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <DataTablePanel
        title={t("machinesList")}
        endpoint={`/machines?refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
        searchableText={(item) => `${item.machine_code} ${item.machine_name} ${canViewIdentity ? `${item.serial ?? ""} ${item.uid ?? ""}` : ""} ${item.ip_address ?? ""} ${item.sync_state?.last_ip_address ?? ""}`}
        actions={
          <Button type="button" size="sm" onClick={() => openForm()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addMachine")}
          </Button>
        }
      />

      <MachineRegistrationRequestsPanel onChanged={() => setRefreshId((value) => value + 1)} />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMachine ? t("editMachine") : t("createMachine")}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveMachine}>
            <TextInputField required disabled={Boolean(editingMachine)} label={t("fieldMachineCode")} value={draft.machine_code} onChange={(event) => setDraft({ ...draft, machine_code: event.target.value })} />
            <TextInputField required label={t("fieldMachineName")} value={draft.machine_name} onChange={(event) => setDraft({ ...draft, machine_name: event.target.value })} />
            {editingMachine ? (
              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:col-span-2">
                <IdentityValue label={t("colIp")} value={editingMachine.sync_state?.last_ip_address ?? editingMachine.ip_address} />
              </div>
            ) : null}
            {canViewIdentity && editingMachine ? (
              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:col-span-2 sm:grid-cols-2">
                <IdentityValue label={t("fieldSerial")} value={editingMachine.serial} />
                <IdentityValue label={t("fieldUid")} value={editingMachine.uid} />
              </div>
            ) : null}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(commandMachine)} onOpenChange={(open) => !open && setCommandMachine(null)}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("commandDialogTitle", { code: commandMachine?.machine_code })}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3 rounded-md border p-3 sm:grid-cols-[14rem_1fr_auto]" onSubmit={sendCommand}>
            <SelectField label={t("commandType")} value={commandDraft.command_type} onChange={(event) => setCommandDraft({ ...commandDraft, command_type: event.target.value as MachineCommand["command_type"] })}>
              <option value="SYNC_PROFILE">SYNC_PROFILE</option>
              <option value="SYNC_SCAN_DATA">SYNC_SCAN_DATA</option>
              <option value="RELOAD_CONFIG">RELOAD_CONFIG</option>
              <option value="SHOW_MESSAGE">SHOW_MESSAGE</option>
            </SelectField>
            <TextAreaField
              label={t("payloadJson")}
              placeholder={t("payloadPlaceholder")}
              value={commandDraft.payload_text}
              onChange={(event) => setCommandDraft({ ...commandDraft, payload_text: event.target.value })}
            />
            <div className="flex items-end">
              <Button type="submit" disabled={isSaving}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {t("send")}
              </Button>
            </div>
          </form>
          {commandMachine ? (
            <DataTablePanel
              title={t("commandHistory")}
              endpoint={`/machines/${commandMachine.id}/commands?take=50&refresh=${commandRefreshId}`}
              columns={commandColumns}
              getRowKey={(item) => item.id}
              searchableText={(item) => `${item.command_type} ${item.status} ${item.error_message ?? ""}`}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title={t("machineDeactivateTitle")}
        description={t("machineDeactivateDesc", { code: target?.machine_code ?? "" })}
        confirmLabel={t("deactivate")}
        isRunning={isSaving}
        onConfirm={() => void deactivateMachine()}
      />
    </div>
  );
}

function parsePayload(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { message: trimmed };
  }
}

function IdentityValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs" title={value ?? undefined}>
        {value || "-"}
      </div>
    </div>
  );
}
