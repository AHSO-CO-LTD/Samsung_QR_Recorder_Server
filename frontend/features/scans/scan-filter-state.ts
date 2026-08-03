export type ScanFilters = {
  line_name: string;
  profile_id: string;
  vendor_char: string;
  final_status: string;
  ng_reason: string;
  from: string;
  to: string;
};

export const emptyScanFilters: ScanFilters = {
  line_name: "",
  profile_id: "",
  vendor_char: "",
  final_status: "",
  ng_reason: "",
  from: "",
  to: ""
};

export function selectScanResultFilter(filters: ScanFilters, finalStatus: string): ScanFilters {
  return {
    ...filters,
    final_status: finalStatus,
    ng_reason: finalStatus === "NG" ? filters.ng_reason : ""
  };
}

export function selectScanErrorFilter(filters: ScanFilters, ngReason: string): ScanFilters {
  return {
    ...filters,
    final_status: ngReason ? "NG" : filters.final_status,
    ng_reason: ngReason
  };
}

export function getScanErrorOptionLabel(
  option: {
    code: string;
    definition?: { name_vi?: string | null; name_en?: string | null } | null;
  },
  locale: "vi" | "en"
) {
  const name = locale === "en" ? option.definition?.name_en?.trim() : option.definition?.name_vi?.trim();
  return name || option.code;
}

export function getScanLineOptions(machines: Array<{ line_name?: string | null }>) {
  return [...new Set(machines.map((machine) => machine.line_name?.trim()).filter((line): line is string => Boolean(line)))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}
