"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NumberInputField, SelectField } from "@/features/shared/form-fields";
import { useI18n } from "@/lib/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

export const scanColumnKeys = [
  "time",
  "machine",
  "machine_name",
  "line",
  "chassis",
  "vendor",
  "local_id",
  "full",
  "duplicate",
  "local",
  "server",
  "final",
  "reason"
] as const;

export type ScanColumnKey = (typeof scanColumnKeys)[number];
export type ScanRefreshMode = "realtime" | "automatic" | "manual";

export type ScanDisplaySettings = {
  version: number;
  refreshMode: ScanRefreshMode;
  autoRefreshSeconds: number;
  visibleColumns: ScanColumnKey[];
};

export const defaultScanDisplaySettings: ScanDisplaySettings = {
  version: 2,
  refreshMode: "realtime",
  autoRefreshSeconds: 5,
  visibleColumns: [...scanColumnKeys]
};

const STORAGE_KEY = "all-scans-display-settings";

const columnLabelKeys: Record<ScanColumnKey, MessageKey> = {
  time: "colScanTime",
  machine: "colMachineCode",
  machine_name: "colMachineName",
  line: "colLine",
  chassis: "colChassis",
  vendor: "colVendor",
  local_id: "colLocalId",
  full: "colFullCode",
  duplicate: "colDuplicateKey",
  local: "colLocal",
  server: "colServer",
  final: "colFinal",
  reason: "colNgReason"
};

export function ScanDisplaySettingsDialog({
  settings,
  onSave
}: {
  settings: ScanDisplaySettings;
  onSave: (settings: ScanDisplaySettings) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(settings);
    }
  };

  const toggleColumn = (key: ScanColumnKey, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      visibleColumns: checked ? [...new Set([...current.visibleColumns, key])] : current.visibleColumns.filter((item) => item !== key)
    }));
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.visibleColumns.length === 0) {
      toast.error(t("scanDisplayColumnsRequired"));
      return;
    }

    const nextSettings: ScanDisplaySettings = {
      version: defaultScanDisplaySettings.version,
      refreshMode: draft.refreshMode,
      autoRefreshSeconds: clampAutoRefreshSeconds(draft.autoRefreshSeconds),
      visibleColumns: scanColumnKeys.filter((key) => draft.visibleColumns.includes(key))
    };
    writeScanDisplaySettings(nextSettings);
    onSave(nextSettings);
    setOpen(false);
    toast.success(t("scanDisplaySettingsSaved"));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 p-0" aria-label={t("scanDisplaySettings")} title={t("scanDisplaySettings")}>
          <AppLogo className="h-8 w-8" imageClassName="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form className="space-y-4" onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{t("scanDisplaySettings")}</DialogTitle>
            <DialogDescription>{t("scanDisplaySettingsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <SelectField
              label={t("scanRefreshMode")}
              value={draft.refreshMode}
              onChange={(event) => setDraft({ ...draft, refreshMode: event.target.value as ScanRefreshMode })}
            >
              <option value="realtime">{t("scanRefreshRealtime")}</option>
              <option value="automatic">{t("scanRefreshAutomatic")}</option>
              <option value="manual">{t("scanRefreshManual")}</option>
            </SelectField>
            <NumberInputField
              label={t("scanAutoRefreshSeconds")}
              min={5}
              max={30}
              value={draft.autoRefreshSeconds}
              disabled={draft.refreshMode !== "automatic"}
              onChange={(event) => setDraft({ ...draft, autoRefreshSeconds: Number(event.target.value) })}
            />
          </div>

          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{t("scanVisibleColumns")}</legend>
            <div className="grid gap-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
              {scanColumnKeys.map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox checked={draft.visibleColumns.includes(key)} onChange={(event) => toggleColumn(key, event.target.checked)} />
                  <span>{t(columnLabelKeys[key])}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(defaultScanDisplaySettings)}>
              {t("restoreDefaults")}
            </Button>
            <Button type="submit">{t("saveSettings")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function readScanDisplaySettings(): ScanDisplaySettings {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return defaultScanDisplaySettings;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<ScanDisplaySettings>;
    const refreshMode: ScanRefreshMode =
      parsedValue.refreshMode === "automatic" || parsedValue.refreshMode === "manual" || parsedValue.refreshMode === "realtime"
        ? parsedValue.refreshMode
        : defaultScanDisplaySettings.refreshMode;
    const storedVisibleColumns = Array.isArray(parsedValue.visibleColumns) ? parsedValue.visibleColumns : defaultScanDisplaySettings.visibleColumns;
    const migratedVisibleColumns =
      Number(parsedValue.version ?? 1) < defaultScanDisplaySettings.version
        ? [...storedVisibleColumns, "machine_name" as const, "line" as const]
        : storedVisibleColumns;
    const visibleColumns = scanColumnKeys.filter((key) => migratedVisibleColumns.includes(key));

    return {
      version: defaultScanDisplaySettings.version,
      refreshMode,
      autoRefreshSeconds: clampAutoRefreshSeconds(Number(parsedValue.autoRefreshSeconds)),
      visibleColumns: visibleColumns.length > 0 ? visibleColumns : defaultScanDisplaySettings.visibleColumns
    };
  } catch {
    return defaultScanDisplaySettings;
  }
}

function writeScanDisplaySettings(settings: ScanDisplaySettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clampAutoRefreshSeconds(value: number) {
  return Math.min(30, Math.max(5, Number.isFinite(value) ? Math.round(value) : 5));
}
