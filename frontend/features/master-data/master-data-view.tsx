"use client";

import { FormEvent, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPatch, apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { CheckboxField, SelectField, TextInputField } from "@/features/shared/form-fields";
import { DataTablePanel, DateText, MonoText, type Column } from "@/features/shared/data-view";
import { ProfilesView } from "@/features/profiles/profiles-view";
import type { ChassisCode, LedCode, Vendor } from "@/features/shared/types";

type VendorDraft = {
  vendor_name: string;
  vendor_char: string;
  status: "ACTIVE" | "PENDING" | "DISABLED";
};

type ChassisDraft = {
  code_input: string;
  is_active: boolean;
};

type LedDraft = {
  code_input: string;
  is_active: boolean;
};

type StatusChangeTarget =
  | { kind: "vendor"; id: number; label: string; nextStatus: VendorDraft["status"] }
  | { kind: "chassis"; id: number; label: string; nextActive: boolean }
  | { kind: "led"; id: number; label: string; nextActive: boolean };

const emptyVendorDraft: VendorDraft = {
  vendor_name: "",
  vendor_char: "",
  status: "ACTIVE"
};

const emptyChassisDraft: ChassisDraft = {
  code_input: "",
  is_active: true
};

const emptyLedDraft: LedDraft = {
  code_input: "",
  is_active: true
};

const MASTER_CODE_INPUT_LENGTH = 6;

export function MasterDataView() {
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [vendorDraft, setVendorDraft] = useState<VendorDraft>(emptyVendorDraft);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isVendorOpen, setIsVendorOpen] = useState(false);
  const [chassisDraft, setChassisDraft] = useState<ChassisDraft>(emptyChassisDraft);
  const [editingChassis, setEditingChassis] = useState<ChassisCode | null>(null);
  const [isChassisOpen, setIsChassisOpen] = useState(false);
  const [ledDraft, setLedDraft] = useState<LedDraft>(emptyLedDraft);
  const [editingLed, setEditingLed] = useState<LedCode | null>(null);
  const [isLedOpen, setIsLedOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<StatusChangeTarget | null>(null);

  const refresh = () => setRefreshId((value) => value + 1);

  const vendorColumns: Column<Vendor>[] = [
    { key: "no", header: t("colNo"), className: "hidden w-12 min-w-[3rem] text-center lg:table-cell", render: (_item, index) => <MonoText value={index + 1} /> },
    { key: "char", header: t("colVendorChar"), className: "w-28 min-w-[7rem] whitespace-nowrap", render: (item) => <MonoText value={item.vendor_char} /> },
    { key: "name", header: t("colVendorName"), className: "min-w-[12rem]", render: (item) => <span className="line-clamp-1">{item.vendor_name}</span> },
    {
      key: "status",
      header: t("colStatus"),
      className: "w-36 min-w-[9rem] whitespace-nowrap",
      render: (item) => <VendorStatusDropdown disabled={isSaving} status={item.status} onRequestChange={(nextStatus) => setStatusTarget({ kind: "vendor", id: item.id, label: item.vendor_char, nextStatus })} />
    },
    { key: "updated", header: t("colUpdated"), className: "hidden w-44 min-w-[11rem] whitespace-nowrap xl:table-cell", render: (item) => <DateText value={item.updated_at} /> }
  ];

  const chassisColumns: Column<ChassisCode>[] = [
    { key: "no", header: t("colNo"), className: "hidden w-12 min-w-[3rem] text-center lg:table-cell", render: (_item, index) => <MonoText value={index + 1} /> },
    { key: "full", header: t("colCodeFull"), className: "w-40 min-w-[10rem] whitespace-nowrap", render: (item) => <MonoText value={item.code_full} /> },
    { key: "input", header: t("colCodeInput"), className: "hidden w-36 min-w-[9rem] whitespace-nowrap md:table-cell", render: (item) => <MonoText value={item.code_input} /> },
    { key: "profile", header: t("colHasProfile"), className: "hidden w-28 min-w-[7rem] whitespace-nowrap xl:table-cell", render: (item) => <MasterStatusPill value={item.product_profile ? "YES" : "NO"} label={item.product_profile ? t("yes") : t("no")} /> },
    {
      key: "active",
      header: t("colStatus"),
      className: "w-36 min-w-[9rem] whitespace-nowrap",
      render: (item) => <ActiveStatusDropdown disabled={isSaving} isActive={item.is_active} onRequestChange={(nextActive) => setStatusTarget({ kind: "chassis", id: item.id, label: item.code_full, nextActive })} />
    },
    { key: "updated", header: t("colUpdated"), className: "hidden w-44 min-w-[11rem] whitespace-nowrap xl:table-cell", render: (item) => <DateText value={item.updated_at} /> }
  ];

  const ledColumns: Column<LedCode>[] = [
    { key: "no", header: t("colNo"), className: "hidden w-12 min-w-[3rem] text-center lg:table-cell", render: (_item, index) => <MonoText value={index + 1} /> },
    { key: "full", header: t("colLedCode"), className: "w-40 min-w-[10rem] whitespace-nowrap", render: (item) => <MonoText value={item.code_full} /> },
    { key: "input", header: t("colInput"), className: "hidden w-36 min-w-[9rem] whitespace-nowrap md:table-cell", render: (item) => <MonoText value={item.code_input} /> },
    { key: "suffix", header: t("colSuffixCheck"), className: "w-32 min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={item.suffix_check} /> },
    {
      key: "active",
      header: t("colStatus"),
      className: "w-36 min-w-[9rem] whitespace-nowrap",
      render: (item) => <ActiveStatusDropdown disabled={isSaving} isActive={item.is_active} onRequestChange={(nextActive) => setStatusTarget({ kind: "led", id: item.id, label: item.code_full, nextActive })} />
    },
    { key: "updated", header: t("colUpdated"), className: "hidden w-44 min-w-[11rem] whitespace-nowrap xl:table-cell", render: (item) => <DateText value={item.updated_at} /> }
  ];

  const openVendorDialog = (vendor?: Vendor) => {
    setEditingVendor(vendor ?? null);
    setVendorDraft(
      vendor
        ? {
            vendor_name: vendor.vendor_name,
            vendor_char: vendor.vendor_char,
            status: vendor.status as VendorDraft["status"]
          }
        : emptyVendorDraft
    );
    setIsVendorOpen(true);
  };

  const openChassisDialog = (chassis?: ChassisCode) => {
    setEditingChassis(chassis ?? null);
    setChassisDraft(
      chassis
        ? {
            code_input: normalizeMasterCodeInput(chassis.code_input),
            is_active: chassis.is_active
          }
        : emptyChassisDraft
    );
    setIsChassisOpen(true);
  };

  const openLedDialog = (led?: LedCode) => {
    setEditingLed(led ?? null);
    setLedDraft(
      led
        ? {
            code_input: normalizeMasterCodeInput(led.code_input),
            is_active: led.is_active
          }
        : emptyLedDraft
    );
    setIsLedOpen(true);
  };

  const saveVendor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (editingVendor) {
        await apiPatch(`/master-data/vendors/${editingVendor.id}`, vendorDraft);
        toast.success(t("vendorUpdated"));
      } else {
        await apiPost("/master-data/vendors", vendorDraft);
        toast.success(t("vendorCreated"));
      }
      setIsVendorOpen(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("vendorSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const saveChassis = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isMasterCodeInputValid(chassisDraft.code_input)) {
      toast.warning(t("codeInputLengthRequired"));
      return;
    }

    setIsSaving(true);
    try {
      if (editingChassis) {
        await apiPatch(`/master-data/chassis-codes/${editingChassis.id}`, chassisDraft);
        toast.success(t("chassisUpdated"));
      } else {
        await apiPost("/master-data/chassis-codes", chassisDraft);
        toast.success(t("chassisCreated"));
      }
      setIsChassisOpen(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chassisSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const saveLed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isMasterCodeInputValid(ledDraft.code_input)) {
      toast.warning(t("codeInputLengthRequired"));
      return;
    }

    setIsSaving(true);
    try {
      if (editingLed) {
        await apiPatch(`/master-data/led-codes/${editingLed.id}`, ledDraft);
        toast.success(t("ledCodeUpdated"));
      } else {
        await apiPost("/master-data/led-codes", ledDraft);
        toast.success(t("ledCodeCreated"));
      }
      setIsLedOpen(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ledCodeSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!statusTarget) {
      return;
    }

    const target = statusTarget;
    setIsSaving(true);
    try {
      if (target.kind === "vendor") {
        await apiPatch(`/master-data/vendors/${target.id}`, { status: target.nextStatus });
        toast.success(t("vendorUpdated"));
      } else if (target.kind === "chassis") {
        await apiPatch(`/master-data/chassis-codes/${target.id}`, { is_active: target.nextActive });
        toast.success(t("chassisUpdated"));
      } else {
        await apiPatch(`/master-data/led-codes/${target.id}`, { is_active: target.nextActive });
        toast.success(t("ledCodeUpdated"));
      }
      setStatusTarget(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dataDeactivateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <Tabs defaultValue="profiles" className="min-w-0 space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="profiles">{t("profilesTitle")}</TabsTrigger>
          <TabsTrigger value="vendors">{t("vendorsTitle")}</TabsTrigger>
          <TabsTrigger value="chassis">{t("chassisCodesTitle")}</TabsTrigger>
          <TabsTrigger value="led">{t("ledCodesTitle")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles">
          <ProfilesView />
        </TabsContent>
        <TabsContent value="vendors">
          <DataTablePanel
            title={t("vendorsTitle")}
            endpoint={`/master-data/vendors?refresh=${refreshId}`}
            columns={vendorColumns}
            getRowKey={(item) => item.id}
            onRowClick={openVendorDialog}
            searchableText={(item) => `${item.vendor_name} ${item.vendor_char} ${item.status}`}
            actions={
              <Button type="button" size="sm" onClick={() => openVendorDialog()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("add")}
              </Button>
            }
          />
        </TabsContent>
        <TabsContent value="chassis">
          <DataTablePanel
            title={t("chassisCodesTitle")}
            endpoint={`/master-data/chassis-codes?refresh=${refreshId}`}
            columns={chassisColumns}
            getRowKey={(item) => item.id}
            onRowClick={openChassisDialog}
            searchableText={(item) => `${item.code_full} ${item.code_input} ${item.is_active}`}
            actions={
              <Button type="button" size="sm" onClick={() => openChassisDialog()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("add")}
              </Button>
            }
          />
        </TabsContent>
        <TabsContent value="led">
          <DataTablePanel
            title={t("ledCodesTitle")}
            endpoint={`/master-data/led-codes?refresh=${refreshId}`}
            columns={ledColumns}
            getRowKey={(item) => item.id}
            onRowClick={openLedDialog}
            searchableText={(item) => `${item.code_full} ${item.code_input} ${item.suffix_check} ${item.is_active}`}
            actions={
              <Button type="button" size="sm" onClick={() => openLedDialog()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("add")}
              </Button>
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isVendorOpen} onOpenChange={setIsVendorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVendor ? t("editVendor") : t("addVendor")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveVendor}>
            <TextInputField required label={t("fieldVendorName")} value={vendorDraft.vendor_name} onChange={(event) => setVendorDraft({ ...vendorDraft, vendor_name: event.target.value })} />
            <TextInputField required label={t("fieldVendorChar")} maxLength={8} value={vendorDraft.vendor_char} onChange={(event) => setVendorDraft({ ...vendorDraft, vendor_char: event.target.value })} />
            <SelectField label={t("colStatus")} value={vendorDraft.status} onChange={(event) => setVendorDraft({ ...vendorDraft, status: event.target.value as VendorDraft["status"] })}>
              <option value="ACTIVE">{t("active")}</option>
              <option value="PENDING">{t("pending")}</option>
              <option value="DISABLED">{t("inactive")}</option>
            </SelectField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsVendorOpen(false)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isChassisOpen} onOpenChange={setIsChassisOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChassis ? t("editChassis") : t("addChassis")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveChassis} noValidate>
            <TextInputField
              required
              label={t("fieldCodeInput")}
              minLength={MASTER_CODE_INPUT_LENGTH}
              maxLength={MASTER_CODE_INPUT_LENGTH}
              value={chassisDraft.code_input}
              onChange={(event) => setChassisDraft({ ...chassisDraft, code_input: normalizeMasterCodeInput(event.target.value) })}
            />
            <DerivedCodeField label={t("fieldCodeFull")} value={buildMasterCodeFull(chassisDraft.code_input)} />
            <CheckboxField label={t("fieldIsActive")} checked={chassisDraft.is_active} onCheckedChange={(checked) => setChassisDraft({ ...chassisDraft, is_active: checked })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsChassisOpen(false)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLedOpen} onOpenChange={setIsLedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLed ? t("editLedCode") : t("addLedCode")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveLed} noValidate>
            <TextInputField
              required
              label={t("fieldCodeInput")}
              minLength={MASTER_CODE_INPUT_LENGTH}
              maxLength={MASTER_CODE_INPUT_LENGTH}
              value={ledDraft.code_input}
              onChange={(event) => setLedDraft({ ...ledDraft, code_input: normalizeMasterCodeInput(event.target.value) })}
            />
            <DerivedCodeField label={t("fieldLedCodeFull")} value={buildMasterCodeFull(ledDraft.code_input)} />
            <DerivedCodeField label={t("fieldSuffixCheck")} value={buildLedSuffixCheck(ledDraft.code_input)} />
            <CheckboxField label={t("fieldIsActive")} checked={ledDraft.is_active} onCheckedChange={(checked) => setLedDraft({ ...ledDraft, is_active: checked })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLedOpen(false)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("colStatus")}</DialogTitle>
            <DialogDescription>
              {statusTarget ? `${statusTarget.label} -> ${getStatusTargetLabel(statusTarget, t)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant={isStatusTargetInactive(statusTarget) ? "destructive" : "default"}
              className={cn(!isStatusTargetInactive(statusTarget) && "bg-emerald-600 text-white hover:bg-emerald-700")}
              onClick={() => void updateStatus()}
              disabled={isSaving}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VendorStatusDropdown({
  disabled,
  status,
  onRequestChange
}: {
  disabled: boolean;
  status: string;
  onRequestChange: (status: VendorDraft["status"]) => void;
}) {
  const { t } = useI18n();
  const normalizedStatus = normalizeVendorStatus(status);

  return (
    <MasterStatusDropdown
      disabled={disabled}
      value={normalizedStatus}
      options={[
        { value: "ACTIVE", label: t("active"), dotClassName: "bg-emerald-500" },
        { value: "PENDING", label: t("pending"), dotClassName: "bg-amber-500" },
        { value: "DISABLED", label: t("inactive"), dotClassName: "bg-destructive" }
      ]}
      onRequestChange={(value) => onRequestChange(normalizeVendorStatus(value))}
    />
  );
}

function ActiveStatusDropdown({
  disabled,
  isActive,
  onRequestChange
}: {
  disabled: boolean;
  isActive: boolean;
  onRequestChange: (isActive: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <MasterStatusDropdown
      disabled={disabled}
      value={isActive ? "ACTIVE" : "INACTIVE"}
      options={[
        { value: "ACTIVE", label: t("active"), dotClassName: "bg-emerald-500" },
        { value: "INACTIVE", label: t("inactive"), dotClassName: "bg-destructive" }
      ]}
      onRequestChange={(value) => onRequestChange(value === "ACTIVE")}
    />
  );
}

function MasterStatusDropdown({
  disabled,
  options,
  value,
  onRequestChange
}: {
  disabled: boolean;
  options: Array<{ value: string; label: string; dotClassName: string }>;
  value: string;
  onRequestChange: (value: string) => void;
}) {
  const currentOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 min-w-28 items-center justify-between gap-2 rounded-md border bg-background px-2 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MasterStatusPill value={currentOption.value} label={currentOption.label} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40" onClick={(event) => event.stopPropagation()}>
        {options.map((option) => {
          const isCurrent = option.value === value;

          return (
            <DropdownMenuItem
              key={option.value}
              disabled={isCurrent}
              onSelect={(event) => {
                event.preventDefault();
                if (!isCurrent) {
                  onRequestChange(option.value);
                }
              }}
            >
              <span className={cn("h-2 w-2 rounded-full", option.dotClassName)} aria-hidden="true" />
              <span>{option.label}</span>
              {isCurrent ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MasterStatusPill({ label, value }: { label: string; value: string }) {
  const normalized = value.toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex min-w-20 items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-semibold",
        normalized === "ACTIVE" || normalized === "YES"
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : normalized === "PENDING"
            ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-destructive/35 bg-destructive/10 text-destructive"
      )}
    >
      {label}
    </span>
  );
}

function DerivedCodeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <div className="flex h-10 items-center rounded-md border bg-muted/45 px-3 font-mono text-sm text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

function normalizeMasterCodeInput(value: string) {
  let normalized = value.trim().toUpperCase();
  if (normalized.startsWith("BN96-")) {
    normalized = normalized.slice(5);
  }

  return normalized.replace(/[^A-Z0-9]/g, "").slice(0, MASTER_CODE_INPUT_LENGTH);
}

function isMasterCodeInputValid(value: string) {
  return value.length === MASTER_CODE_INPUT_LENGTH;
}

function buildMasterCodeFull(codeInput: string) {
  return codeInput ? `BN96-${codeInput}` : "BN96-";
}

function buildLedSuffixCheck(codeInput: string) {
  return codeInput.slice(-5);
}

function normalizeVendorStatus(status: string): VendorDraft["status"] {
  return status === "PENDING" || status === "DISABLED" ? status : "ACTIVE";
}

function getStatusTargetLabel(target: StatusChangeTarget, t: ReturnType<typeof useI18n>["t"]) {
  if (target.kind === "vendor") {
    if (target.nextStatus === "PENDING") {
      return t("pending");
    }
    return target.nextStatus === "ACTIVE" ? t("active") : t("inactive");
  }

  return target.nextActive ? t("active") : t("inactive");
}

function isStatusTargetInactive(target: StatusChangeTarget | null) {
  if (!target) {
    return false;
  }

  return target.kind === "vendor" ? target.nextStatus === "DISABLED" : !target.nextActive;
}
