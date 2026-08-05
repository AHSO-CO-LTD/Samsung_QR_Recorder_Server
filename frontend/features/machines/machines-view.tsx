"use client";

import { FormEvent, useMemo, useState } from "react";
import { ChevronDown, MessageSquarePlus, Plus, Power, RotateCcw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";
import { CheckboxField, SelectField, TextAreaField, TextInputField } from "@/features/shared/form-fields";
import { MachineRegistrationRequestsPanel } from "@/features/machines/machine-registration-requests-panel";
import { ConfirmActionDialog } from "@/features/shared/confirm-action-dialog";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { Machine, MachineCommand } from "@/features/shared/types";
import { cn } from "@/lib/utils";

type MachineDraft = {
  machine_code: string;
  machine_name: string;
  line_name: string;
  station_name: string;
  ip_address: string;
  is_active: boolean;
};

type CommandDraft = {
  command_type: MachineCommand["command_type"];
  payload_text: string;
};

type MachineStatusTarget = {
  machine: Machine;
  isActive: boolean;
};

type MachineFilter = "ALL" | "ACTIVE" | "DISABLED" | "ONLINE" | "OFFLINE";

const emptyMachineDraft: MachineDraft = {
  machine_code: "",
  machine_name: "",
  line_name: "",
  station_name: "",
  ip_address: "",
  is_active: true
};

const emptyCommandDraft: CommandDraft = {
  command_type: "SYNC_PROFILE",
  payload_text: ""
};

const MACHINE_AUTO_REFRESH_MS = 30 * 1000;

export function MachinesView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [commandRefreshId, setCommandRefreshId] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [machineFilter, setMachineFilter] = useState<MachineFilter>("ALL");
  const [draft, setDraft] = useState<MachineDraft>(emptyMachineDraft);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [target, setTarget] = useState<MachineStatusTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
  const [commandMachine, setCommandMachine] = useState<Machine | null>(null);
  const [commandDraft, setCommandDraft] = useState<CommandDraft>(emptyCommandDraft);
  const isDev = user?.role === "DEV";
  const canViewIdentity = isDev;

  const columns = useMemo<Column<Machine>[]>(
    () => [
      { key: "code", header: t("colMachineCode"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={item.machine_code} /> },
      { key: "name", header: t("colMachineName"), className: "min-w-[12rem]", render: (item) => item.machine_name },
      { key: "line", header: t("fieldLine"), className: "min-w-[7rem] whitespace-nowrap", render: (item) => <MonoText value={item.line_name} /> },
      { key: "station", header: t("fieldStation"), className: "min-w-[7rem] whitespace-nowrap", render: (item) => <MonoText value={item.station_name} /> },
      ...(canViewIdentity
        ? [
            { key: "serial", header: t("colSerial"), className: "min-w-[10rem] whitespace-nowrap", render: (item: Machine) => <MonoText value={item.serial} /> },
            { key: "uid", header: t("colUid"), className: "min-w-[10rem] whitespace-nowrap", render: (item: Machine) => <MonoText value={item.uid} /> }
          ]
        : []),
      { key: "license", header: t("colLicense"), className: "w-28 min-w-[7rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.license_activated_at ? "ACTIVATED" : "NOT_ACTIVE"} /> },
      { key: "scans", header: t("colScanRecords"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => getMachineScanCount(item) },
      { key: "ip", header: t("colIp"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={item.sync_state?.last_ip_address ?? item.ip_address} /> },
      { key: "connection", header: t("colConnection"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.sync_state?.connection_status || "UNKNOWN"} /> },
      { key: "last_seen", header: t("colHeartbeat"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.sync_state?.last_seen_at} /> },
      { key: "active", header: t("colStatus"), className: "w-28 min-w-[7rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.is_active} /> },
      {
        key: "actions",
        header: t("colActions"),
        className: "w-56 text-right",
        render: (item) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                openCommandDialog(item);
              }}
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              {t("commandButton")}
            </Button>
            {item.is_active ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setTarget({ machine: item, isActive: false });
                }}
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {t("deactivate")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                onClick={(event) => {
                  event.stopPropagation();
                  setTarget({ machine: item, isActive: true });
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t("reactivate")}
              </Button>
            )}
            {canHardDeleteMachine(item) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget(item);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t("delete")}
              </Button>
            ) : null}
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
            machine_name: machine.machine_name,
            line_name: machine.line_name ?? "",
            station_name: machine.station_name ?? "",
            ip_address: machine.ip_address ?? "",
            is_active: machine.is_active
          }
        : emptyMachineDraft
    );
    setIsAdvancedOpen(Boolean(machine));
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
          machine_name: draft.machine_name,
          line_name: cleanOptional(draft.line_name),
          station_name: cleanOptional(draft.station_name),
          ip_address: cleanOptional(draft.ip_address),
          is_active: draft.is_active
        });
        toast.success(t("machineUpdated"));
      } else {
        await apiPost("/machines", {
          machine_code: draft.machine_code,
          machine_name: draft.machine_name,
          line_name: cleanOptional(draft.line_name),
          station_name: cleanOptional(draft.station_name),
          ip_address: cleanOptional(draft.ip_address),
          is_active: draft.is_active
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

  const updateMachineStatus = async () => {
    if (!target) {
      return;
    }

    setIsSaving(true);
    try {
      if (target.isActive) {
        await apiPatch(`/machines/${target.machine.id}`, {
          is_active: true
        });
        toast.success(t("machineReactivated"));
      } else {
        await apiDelete(`/machines/${target.machine.id}`);
        toast.success(t("machineDeactivated"));
      }
      setTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : target.isActive ? t("machineReactivateFailed") : t("machineDeactivateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMachine = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await apiDelete(`/machines/${deleteTarget.id}/purge`);
      toast.success(t("machineDeleted"));
      setDeleteTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("machineDeleteFailed"));
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
        autoRefreshMs={MACHINE_AUTO_REFRESH_MS}
        onRowClick={openForm}
        rowClassName={(item) => cn("hover:bg-muted/40", !item.is_active && "bg-muted/20")}
        filterItem={(item) => filterMachine(item, machineFilter)}
        searchableText={(item) =>
          `${item.machine_code} ${item.machine_name} ${item.line_name ?? ""} ${item.station_name ?? ""} ${canViewIdentity ? `${item.serial ?? ""} ${item.uid ?? ""}` : ""} ${item.ip_address ?? ""} ${
            item.sync_state?.last_ip_address ?? ""
          }`
        }
        toolbarContent={<MachineStatusFilter value={machineFilter} onChange={setMachineFilter} />}
        actions={
          isDev ? (
            <Button type="button" size="sm" onClick={() => openForm()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addMachine")}
            </Button>
          ) : undefined
        }
      />

      {isDev ? <MachineRegistrationRequestsPanel onChanged={() => setRefreshId((value) => value + 1)} /> : null}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMachine ? t("editMachine") : t("createMachine")}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveMachine}>
            <TextInputField required disabled={Boolean(editingMachine)} label={t("fieldMachineCode")} value={draft.machine_code} onChange={(event) => setDraft({ ...draft, machine_code: event.target.value })} />
            <TextInputField required label={t("fieldMachineName")} value={draft.machine_name} onChange={(event) => setDraft({ ...draft, machine_name: event.target.value })} />
            <div className="rounded-md border sm:col-span-2">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                aria-expanded={isAdvancedOpen}
                onClick={() => setIsAdvancedOpen((value) => !value)}
              >
                <span>{t("advancedSettings")}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isAdvancedOpen && "rotate-180")} aria-hidden="true" />
              </button>
              <div className={cn("grid gap-3 border-t p-3 sm:grid-cols-2", !isAdvancedOpen && "hidden")}>
                <TextInputField label={t("fieldLine")} value={draft.line_name} onChange={(event) => setDraft({ ...draft, line_name: event.target.value })} />
                <TextInputField label={t("fieldStation")} value={draft.station_name} onChange={(event) => setDraft({ ...draft, station_name: event.target.value })} />
                <TextInputField label={t("fieldConfiguredIp")} value={draft.ip_address} onChange={(event) => setDraft({ ...draft, ip_address: event.target.value })} />
                <CheckboxField label={t("machineActiveField")} checked={draft.is_active} onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })} />
              </div>
            </div>
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
        title={target?.isActive ? t("machineReactivateTitle") : t("machineDeactivateTitle")}
        description={
          target?.isActive
            ? t("machineReactivateDesc", { code: target.machine.machine_code })
            : t("machineDeactivateDesc", { code: target?.machine.machine_code ?? "" })
        }
        confirmLabel={target?.isActive ? t("reactivate") : t("deactivate")}
        isRunning={isSaving}
        onConfirm={() => void updateMachineStatus()}
      />

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("machineDeleteTitle")}
        description={t("machineDeleteDesc", { code: deleteTarget?.machine_code ?? "" })}
        confirmLabel={t("delete")}
        isRunning={isSaving}
        onConfirm={() => void deleteMachine()}
      />
    </div>
  );
}

function MachineStatusFilter({ value, onChange }: { value: MachineFilter; onChange: (value: MachineFilter) => void }) {
  const { t } = useI18n();
  const options: Array<{ value: MachineFilter; label: string }> = [
    { value: "ALL", label: t("machineFilterAll") },
    { value: "ACTIVE", label: t("machineFilterActive") },
    { value: "ONLINE", label: t("machineFilterOnline") },
    { value: "OFFLINE", label: t("machineFilterOffline") },
    { value: "DISABLED", label: t("machineFilterDisabled") }
  ];

  return (
    <div className="flex min-w-0 flex-wrap gap-1 rounded-md bg-muted p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "ghost"}
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function filterMachine(machine: Machine, filter: MachineFilter) {
  if (filter === "ACTIVE") return machine.is_active;
  if (filter === "DISABLED") return !machine.is_active;
  if (filter === "ONLINE") return machine.is_active && isMachineOnline(machine);
  if (filter === "OFFLINE") return machine.is_active && !isMachineOnline(machine);
  return true;
}

function isMachineOnline(machine: Machine) {
  return machine.sync_state?.connection_status === "ONLINE";
}

function getMachineScanCount(machine: Machine) {
  return machine._count?.scan_records ?? 0;
}

function canHardDeleteMachine(machine: Machine) {
  return getMachineScanCount(machine) === 0;
}

function cleanOptional(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
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
