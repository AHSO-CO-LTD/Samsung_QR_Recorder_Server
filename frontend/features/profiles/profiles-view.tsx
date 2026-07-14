"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Check, ChevronDown, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { NumberInputField, SelectField, TextInputField } from "@/features/shared/form-fields";
import { DataTablePanel, DateText, MonoText, type Column } from "@/features/shared/data-view";
import { LedSlotCell, RuleNumberCell } from "@/features/profiles/profile-table-cells";
import type { ChassisCode, LedCode, Profile, ServerSettings } from "@/features/shared/types";

type LedSlotDraft = {
  key: string;
  led_code_id: string;
  led_slot: number;
  is_required: boolean;
};

type ProfileDraft = {
  chassis_code_id: string;
  factory_code: string;
  full_code_length: number;
  full_vendor_position: number;
  led_scan_length: number;
  led_vendor_position: number;
  is_active: boolean;
  led_codes: LedSlotDraft[];
};

type ProfileStatusTarget = {
  profile: Profile;
  isActive: boolean;
};

type ServerSettingsDraft = Omit<ServerSettings, "id">;

const fallbackSettings = {
  factory_code_default: "DZLV",
  full_code_length_default: 35,
  full_vendor_position_default: 18,
  led_scan_length_default: 22,
  led_vendor_position_default: 16,
  duplicate_days: 31,
  heartbeat_timeout_seconds: 60
} satisfies ServerSettingsDraft;

const MAX_PROFILE_LED_CODES = 2;

function buildEmptyDraft(settings = fallbackSettings): ProfileDraft {
  return {
    chassis_code_id: "",
    factory_code: settings.factory_code_default,
    full_code_length: settings.full_code_length_default,
    full_vendor_position: settings.full_vendor_position_default,
    led_scan_length: settings.led_scan_length_default,
    led_vendor_position: settings.led_vendor_position_default,
    is_active: true,
    led_codes: buildTwoLedSlotDrafts()
  };
}

function buildTwoLedSlotDrafts(source: Profile["profile_led_codes"] = []): LedSlotDraft[] {
  return [1, 2].map((slot) => {
    const matchedSlot = source?.find((item) => item.led_slot === slot);

    return {
      key: crypto.randomUUID(),
      led_code_id: String(matchedSlot?.led_code?.id ?? ""),
      led_slot: slot,
      is_required: matchedSlot?.is_required ?? true
    };
  });
}

export function ProfilesView() {
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSettingsConfirmOpen, setIsSettingsConfirmOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [statusTarget, setStatusTarget] = useState<ProfileStatusTarget | null>(null);
  const [settings, setSettings] = useState<ServerSettingsDraft>(fallbackSettings);
  const [settingsDraft, setSettingsDraft] = useState<ServerSettingsDraft>(fallbackSettings);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [chassisCodes, setChassisCodes] = useState<ChassisCode[]>([]);
  const [ledCodes, setLedCodes] = useState<LedCode[]>([]);
  const [draft, setDraft] = useState<ProfileDraft>(buildEmptyDraft());

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      apiGet<ChassisCode[]>("/master-data/chassis-codes"),
      apiGet<LedCode[]>("/master-data/led-codes"),
      apiGet<ServerSettings>("/settings/server")
    ])
      .then(([chassisResult, ledResult, settingsResult]) => {
        if (!isMounted) {
          return;
        }
        const nextSettings: ServerSettingsDraft = settingsResult.data
          ? {
              factory_code_default: settingsResult.data.factory_code_default,
              full_code_length_default: settingsResult.data.full_code_length_default,
              full_vendor_position_default: settingsResult.data.full_vendor_position_default,
              led_scan_length_default: settingsResult.data.led_scan_length_default,
              led_vendor_position_default: settingsResult.data.led_vendor_position_default,
              duplicate_days: settingsResult.data.duplicate_days,
              heartbeat_timeout_seconds: settingsResult.data.heartbeat_timeout_seconds
            }
          : fallbackSettings;
        setChassisCodes(chassisResult.data ?? []);
        setLedCodes(ledResult.data ?? []);
        setSettings(nextSettings);
        setSettingsDraft(nextSettings);
        setDraft(buildEmptyDraft(nextSettings));
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("profilesLoadFailed"));
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const activeChassis = useMemo(() => chassisCodes.filter((item) => item.is_active), [chassisCodes]);
  const activeLedCodes = useMemo(() => ledCodes.filter((item) => item.is_active), [ledCodes]);
  const usedChassisIds = useMemo(() => {
    return new Set(profiles.map((item) => item.chassis_code_id ?? item.chassis_code?.id).filter((id): id is number => typeof id === "number"));
  }, [profiles]);
  const availableChassis = useMemo(() => {
    return activeChassis.filter((item) => !usedChassisIds.has(item.id) && !item.product_profile);
  }, [activeChassis, usedChassisIds]);
  const chassisOptions = editingProfile ? activeChassis : availableChassis;
  const hasSettingsChanges = useMemo(() => {
    return (
      settingsDraft.factory_code_default !== settings.factory_code_default ||
      settingsDraft.full_code_length_default !== settings.full_code_length_default ||
      settingsDraft.full_vendor_position_default !== settings.full_vendor_position_default ||
      settingsDraft.led_scan_length_default !== settings.led_scan_length_default ||
      settingsDraft.led_vendor_position_default !== settings.led_vendor_position_default
    );
  }, [settings, settingsDraft]);

  const columns: Column<Profile>[] = [
    { key: "no", header: t("colNo"), className: "hidden w-12 min-w-[3rem] text-center 2xl:table-cell", render: (_item, index) => <RuleNumberCell value={index + 1} /> },
    { key: "chassis", header: t("colChassis"), className: "w-32 min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={item.chassis_code?.code_full} /> },
    { key: "factory", header: t("colFactory"), className: "hidden w-20 min-w-[5rem] whitespace-nowrap 2xl:table-cell", render: (item) => <MonoText value={item.factory_code} /> },
    { key: "full_length", header: t("colFullLength"), className: "w-20 min-w-[5rem] whitespace-nowrap", render: (item) => <RuleNumberCell value={item.full_code_length} /> },
    { key: "full_vendor_position", header: t("colFullVendorPosition"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => <RuleNumberCell value={item.full_vendor_position} /> },
    { key: "led_length", header: t("colLedLength"), className: "w-20 min-w-[5rem] whitespace-nowrap", render: (item) => <RuleNumberCell value={item.led_scan_length} /> },
    { key: "led_vendor_position", header: t("colLedVendorPosition"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => <RuleNumberCell value={item.led_vendor_position} /> },
    { key: "led_slot_1", header: t("colLedSlot1"), className: "w-[8.5rem] min-w-[8.5rem]", render: (item) => <LedSlotCell profile={item} slot={1} /> },
    { key: "led_slot_2", header: t("colLedSlot2"), className: "w-[8.5rem] min-w-[8.5rem]", render: (item) => <LedSlotCell profile={item} slot={2} /> },
    { key: "version", header: t("colVersion"), className: "hidden w-16 min-w-[4rem] whitespace-nowrap 2xl:table-cell", render: (item) => <MonoText value={`v${item.version}`} /> },
    {
      key: "active",
      header: t("colStatus"),
      className: "w-32 min-w-[8rem] whitespace-nowrap",
      render: (item) => <ProfileStatusDropdown disabled={isSaving} profile={item} onRequestChange={(isActive) => setStatusTarget({ profile: item, isActive })} />
    },
    { key: "updated", header: t("colUpdated"), className: "hidden w-44 min-w-[11rem] whitespace-nowrap 2xl:table-cell", render: (item) => <DateText value={item.updated_at} /> }
  ];

  const openForm = (profile?: Profile) => {
    setEditingProfile(profile ?? null);
    setDraft(profile ? buildDraftFromProfile(profile) : buildEmptyDraft(settings));
    setIsAdvancedOpen(false);
    setIsFormOpen(true);
  };

  const requestSaveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasSettingsChanges) {
      return;
    }

    setIsSettingsConfirmOpen(true);
  };

  const saveDefaultSettings = async () => {
    setIsSettingsSaving(true);
    try {
      const result = await apiPut<ServerSettings>("/settings/server", settingsDraft);
      const savedSettings: ServerSettingsDraft = result.data
        ? {
            factory_code_default: result.data.factory_code_default,
            full_code_length_default: result.data.full_code_length_default,
            full_vendor_position_default: result.data.full_vendor_position_default,
            led_scan_length_default: result.data.led_scan_length_default,
            led_vendor_position_default: result.data.led_vendor_position_default,
            duplicate_days: result.data.duplicate_days,
            heartbeat_timeout_seconds: result.data.heartbeat_timeout_seconds
          }
        : settingsDraft;
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
      setIsSettingsConfirmOpen(false);
      toast.success(t("profileDefaultsSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profileDefaultsSaveFailed"));
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const updateLedCodeSlot = (key: string, ledCodeId: string) => {
    setDraft((current) => ({
      ...current,
      led_codes: current.led_codes.map((item) => (item.key === key ? { ...item, led_code_id: ledCodeId } : item))
    }));
  };

  const getLedCodeOptions = (slot: LedSlotDraft) => {
    const selectedByOtherSlots = new Set(
      draft.led_codes
        .filter((item) => item.key !== slot.key && item.led_code_id)
        .map((item) => Number(item.led_code_id))
    );

    return activeLedCodes.filter((item) => item.id === Number(slot.led_code_id) || !selectedByOtherSlots.has(item.id));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const ledCodesPayload = draft.led_codes
      .filter((item) => item.led_code_id)
      .map((item) => ({
        led_code_id: Number(item.led_code_id),
        led_slot: Number(item.led_slot),
        is_required: item.is_required
      }));

    const requiredLedCount = editingProfile ? 1 : MAX_PROFILE_LED_CODES;

    if ((!editingProfile && !draft.chassis_code_id) || ledCodesPayload.length < requiredLedCount) {
      toast.warning(t("profileMissingFields"));
      return;
    }

    if (new Set(ledCodesPayload.map((item) => item.led_code_id)).size !== ledCodesPayload.length) {
      toast.warning(t("profileDuplicateLedCode"));
      return;
    }

    if (ledCodesPayload.length > MAX_PROFILE_LED_CODES) {
      toast.warning(t("profileLedLimitReached"));
      return;
    }

    setIsSaving(true);
    try {
      if (editingProfile) {
        await apiPatch(`/profiles/${editingProfile.id}`, {
          factory_code: draft.factory_code,
          full_code_length: Number(draft.full_code_length),
          full_vendor_position: Number(draft.full_vendor_position),
          led_scan_length: Number(draft.led_scan_length),
          led_vendor_position: Number(draft.led_vendor_position),
          led_codes: ledCodesPayload
        });
        toast.success(t("profileUpdated"));
      } else {
        await apiPost("/profiles", {
          chassis_code_id: Number(draft.chassis_code_id),
          factory_code: draft.factory_code,
          full_code_length: Number(draft.full_code_length),
          full_vendor_position: Number(draft.full_vendor_position),
          led_scan_length: Number(draft.led_scan_length),
          led_vendor_position: Number(draft.led_vendor_position),
          led_codes: ledCodesPayload
        });
        toast.success(t("profileCreated"));
      }
      setIsFormOpen(false);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profileSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateProfileStatus = async () => {
    if (!statusTarget || statusTarget.profile.is_active === statusTarget.isActive) {
      return;
    }

    const target = statusTarget;
    setIsSaving(true);
    try {
      if (target.isActive) {
        await apiPatch(`/profiles/${target.profile.id}`, {
          is_active: true
        });
        toast.success(t("profileReactivated"));
      } else {
        await apiDelete(`/profiles/${target.profile.id}`);
        toast.success(t("profileDeactivated"));
      }
      setStatusTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : target.isActive ? t("profileReactivateFailed") : t("profileDeactivateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <DataTablePanel
        title={t("profilesList")}
        endpoint={`/profiles?refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
        onData={setProfiles}
        onRowClick={openForm}
        toolbarContent={
          <ProfileDefaultSettingsBar
            disabled={isSettingsSaving}
            hasChanges={hasSettingsChanges}
            settings={settingsDraft}
            onChange={setSettingsDraft}
            onSubmit={requestSaveSettings}
          />
        }
        searchableText={(item) =>
          `${item.chassis_code?.code_full ?? ""} ${item.factory_code} ${item.version} ${
            item.profile_led_codes?.map((slot) => `${slot.led_slot} ${slot.led_code?.code_full ?? ""} ${slot.led_code?.suffix_check ?? ""}`).join(" ") ?? ""
          }`
        }
        actions={
          <Button type="button" size="sm" onClick={() => openForm()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addProfile")}
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? t("editProfile") : t("addProfile")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label={t("fieldChassis")} value={draft.chassis_code_id} disabled={Boolean(editingProfile)} onChange={(event) => setDraft({ ...draft, chassis_code_id: event.target.value })}>
                <option value="">{t("selectChassis")}</option>
                {chassisOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code_full}
                  </option>
                ))}
              </SelectField>
              {draft.led_codes.map((slot) => (
                <SelectField
                  key={slot.key}
                  required={!editingProfile}
                  label={slot.led_slot === 1 ? t("colLedSlot1") : t("colLedSlot2")}
                  value={slot.led_code_id}
                  onChange={(event) => updateLedCodeSlot(slot.key, event.target.value)}
                >
                  <option value="">{t("selectLed")}</option>
                  {getLedCodeOptions(slot).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code_full} ({item.suffix_check})
                    </option>
                  ))}
                </SelectField>
              ))}
            </div>

            <div className="rounded-md border">
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
                <TextInputField required label={t("fieldFactoryCode")} value={draft.factory_code} onChange={(event) => setDraft({ ...draft, factory_code: event.target.value })} />
                <NumberInputField required label={t("fieldFullCodeLength")} value={draft.full_code_length} onChange={(event) => setDraft({ ...draft, full_code_length: Number(event.target.value) })} />
                <NumberInputField required label={t("fieldFullVendorPosition")} value={draft.full_vendor_position} onChange={(event) => setDraft({ ...draft, full_vendor_position: Number(event.target.value) })} />
                <NumberInputField required label={t("fieldLedScanLength")} value={draft.led_scan_length} onChange={(event) => setDraft({ ...draft, led_scan_length: Number(event.target.value) })} />
                <NumberInputField required label={t("fieldLedVendorPosition")} value={draft.led_vendor_position} onChange={(event) => setDraft({ ...draft, led_vendor_position: Number(event.target.value) })} />
              </div>
            </div>

            <DialogFooter>
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

      <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusTarget?.isActive ? t("profileReactivateTitle") : t("profileDeactivateTitle")}</DialogTitle>
            <DialogDescription>
              {statusTarget?.isActive
                ? t("profileReactivateDesc", { name: statusTarget.profile.chassis_code?.code_full ?? "" })
                : t("profileDeactivateDesc", { name: statusTarget?.profile.chassis_code?.code_full ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant={statusTarget?.isActive ? "default" : "destructive"}
              className={cn(statusTarget?.isActive && "bg-emerald-600 text-white hover:bg-emerald-700")}
              onClick={() => void updateProfileStatus()}
              disabled={isSaving}
            >
              {statusTarget?.isActive ? t("reactivate") : t("deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsConfirmOpen} onOpenChange={(open) => !open && setIsSettingsConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profileDefaultsConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("profileDefaultsConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSettingsConfirmOpen(false)} disabled={isSettingsSaving}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={() => void saveDefaultSettings()} disabled={isSettingsSaving}>
              {isSettingsSaving ? t("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileDefaultSettingsBar({
  disabled,
  hasChanges,
  settings,
  onChange,
  onSubmit
}: {
  disabled: boolean;
  hasChanges: boolean;
  settings: ServerSettingsDraft;
  onChange: (settings: ServerSettingsDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();

  const updateNumber = (key: keyof Pick<ServerSettingsDraft, "full_code_length_default" | "full_vendor_position_default" | "led_scan_length_default" | "led_vendor_position_default">, value: string) => {
    onChange({ ...settings, [key]: Math.max(1, Number(value) || 1) });
  };

  return (
    <form className="flex min-w-0 flex-wrap items-end gap-2 xl:flex-nowrap xl:justify-end" onSubmit={onSubmit}>
      <ProfileDefaultField label={t("colFactory")} className="w-20">
        <Input
          value={settings.factory_code_default}
          disabled={disabled}
          className="h-8 px-2 text-xs"
          onChange={(event) => onChange({ ...settings, factory_code_default: event.target.value })}
        />
      </ProfileDefaultField>
      <ProfileDefaultField label={t("colFullLength")} className="w-20">
        <Input
          type="number"
          min={1}
          value={settings.full_code_length_default}
          disabled={disabled}
          className="h-8 px-2 text-xs"
          onChange={(event) => updateNumber("full_code_length_default", event.target.value)}
        />
      </ProfileDefaultField>
      <ProfileDefaultField label={t("colFullVendorPosition")} className="w-24">
        <Input
          type="number"
          min={1}
          value={settings.full_vendor_position_default}
          disabled={disabled}
          className="h-8 px-2 text-xs"
          onChange={(event) => updateNumber("full_vendor_position_default", event.target.value)}
        />
      </ProfileDefaultField>
      <ProfileDefaultField label={t("colLedLength")} className="w-20">
        <Input
          type="number"
          min={1}
          value={settings.led_scan_length_default}
          disabled={disabled}
          className="h-8 px-2 text-xs"
          onChange={(event) => updateNumber("led_scan_length_default", event.target.value)}
        />
      </ProfileDefaultField>
      <ProfileDefaultField label={t("colLedVendorPosition")} className="w-24">
        <Input
          type="number"
          min={1}
          value={settings.led_vendor_position_default}
          disabled={disabled}
          className="h-8 px-2 text-xs"
          onChange={(event) => updateNumber("led_vendor_position_default", event.target.value)}
        />
      </ProfileDefaultField>
      <Button type="submit" variant="outline" size="sm" disabled={disabled || !hasChanges} className="shrink-0">
        <Save className="h-4 w-4" aria-hidden="true" />
        {t("profileDefaultsSave")}
      </Button>
    </form>
  );
}

function ProfileDefaultField({ children, className, label }: { children: React.ReactNode; className: string; label: string }) {
  return (
    <label className={cn("min-w-0 space-y-1 text-[11px] font-medium leading-none text-muted-foreground", className)}>
      <span className="block truncate">{label}</span>
      {children}
    </label>
  );
}

function ProfileStatusDropdown({
  disabled,
  profile,
  onRequestChange
}: {
  disabled: boolean;
  profile: Profile;
  onRequestChange: (isActive: boolean) => void;
}) {
  const { t } = useI18n();

  const options = [
    { isActive: true, label: t("active"), dotClassName: "bg-emerald-500" },
    { isActive: false, label: t("inactive"), dotClassName: "bg-destructive" }
  ];

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
          <ProfileStatusPill isActive={profile.is_active} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t("colStatus")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40" onClick={(event) => event.stopPropagation()}>
        {options.map((option) => {
          const isCurrent = option.isActive === profile.is_active;

          return (
            <DropdownMenuItem
              key={String(option.isActive)}
              disabled={isCurrent}
              onSelect={(event) => {
                event.preventDefault();
                if (!isCurrent) {
                  onRequestChange(option.isActive);
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

function ProfileStatusPill({ isActive }: { isActive: boolean }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "inline-flex min-w-20 items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-semibold",
        isActive
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/35 bg-destructive/10 text-destructive"
      )}
    >
      {isActive ? t("active") : t("inactive")}
    </span>
  );
}

function buildDraftFromProfile(profile: Profile): ProfileDraft {
  return {
    chassis_code_id: String(profile.chassis_code?.id ?? profile.chassis_code_id ?? ""),
    factory_code: profile.factory_code,
    full_code_length: profile.full_code_length,
    full_vendor_position: profile.full_vendor_position,
    led_scan_length: profile.led_scan_length,
    led_vendor_position: profile.led_vendor_position,
    is_active: profile.is_active,
    led_codes: buildTwoLedSlotDrafts(profile.profile_led_codes)
  };
}
