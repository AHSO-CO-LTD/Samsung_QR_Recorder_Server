"use client";

import { useMemo } from "react";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePickerField } from "@/features/shared/date-time-picker";
import { SelectField } from "@/features/shared/form-fields";
import type { Machine, Profile, ScanErrorDefinition, Vendor } from "@/features/shared/types";
import { useI18n } from "@/lib/i18n-provider";
import { emptyScanFilters, getScanErrorOptionLabel, getScanLineOptions, selectScanErrorFilter, selectScanResultFilter, type ScanFilters } from "./scan-filter-state";

export type ScanErrorFilterOption = {
  code: string;
  definition: ScanErrorDefinition | null;
};

export function ScanFiltersCard({
  filters,
  machines,
  profiles,
  vendors,
  errorOptions,
  onFiltersChange
}: {
  filters: ScanFilters;
  machines: Machine[];
  profiles: Profile[];
  vendors: Vendor[];
  errorOptions: ScanErrorFilterOption[];
  onFiltersChange: (filters: ScanFilters) => void;
}) {
  const { locale, t } = useI18n();
  const lines = useMemo(() => getScanLineOptions(machines), [machines]);

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
        <SelectField label={t("colLine")} value={filters.line_name} onChange={(event) => onFiltersChange({ ...filters, line_name: event.target.value })}>
          <option value="">{t("allLines")}</option>
          {lines.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("colProfile")} value={filters.profile_id} onChange={(event) => onFiltersChange({ ...filters, profile_id: event.target.value })}>
          <option value="">{t("allProfiles")}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.chassis_code?.code_full ?? t("profileFallbackName", { id: profile.id })}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("colVendor")} value={filters.vendor_char} onChange={(event) => onFiltersChange({ ...filters, vendor_char: event.target.value })}>
          <option value="">{t("allVendors")}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.vendor_char}>
              {vendor.vendor_name} ({vendor.vendor_char})
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("scanResultFilter")}
          value={filters.final_status}
          onChange={(event) => onFiltersChange(selectScanResultFilter(filters, event.target.value))}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="OK">OK</option>
          <option value="NG">NG</option>
          <option value="PENDING">{t("pending")}</option>
        </SelectField>
        <SelectField
          label={t("scanErrorTypeFilter")}
          value={filters.ng_reason}
          onChange={(event) => onFiltersChange(selectScanErrorFilter(filters, event.target.value))}
        >
          <option value="">{t("allErrorTypes")}</option>
          {errorOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {getScanErrorOptionLabel(option, locale)}
            </option>
          ))}
        </SelectField>
        <DateTimePickerField label={t("fieldFromDate")} value={filters.from} onChange={(from) => onFiltersChange({ ...filters, from })} />
        <DateTimePickerField label={t("fieldToDate")} value={filters.to} onChange={(to) => onFiltersChange({ ...filters, to })} />
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={() => onFiltersChange(emptyScanFilters)}>
            <FilterX className="h-4 w-4" aria-hidden="true" />
            {t("clearFilter")}
          </Button>
        </div>
      </div>
    </div>
  );
}
