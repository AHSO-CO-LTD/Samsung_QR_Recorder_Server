"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FilterX, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { SelectField, TextInputField } from "@/features/shared/form-fields";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { DuplicateKey, HistoricalDuplicateResult, Machine, Profile, ScanRecord, Vendor } from "@/features/shared/types";

type ScanFilters = {
  machine_code: string;
  profile_id: string;
  vendor_char: string;
  final_status: string;
  from: string;
  to: string;
};

type HistoricalJobDraft = {
  profile_id: string;
  from_date: string;
  to_date: string;
};

const emptyFilters: ScanFilters = {
  machine_code: "",
  profile_id: "",
  vendor_char: "",
  final_status: "",
  from: "",
  to: ""
};

const now = new Date();
const defaultFromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const defaultDraft: HistoricalJobDraft = {
  profile_id: "",
  from_date: toDatetimeLocal(defaultFromDate),
  to_date: toDatetimeLocal(now)
};

export function ScansView() {
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filters, setFilters] = useState<ScanFilters>(emptyFilters);
  const [activeTab, setActiveTab] = useState("all-scans");
  const [duplicateRefreshId, setDuplicateRefreshId] = useState(0);
  const [isHistoricalJobSaving, setIsHistoricalJobSaving] = useState(false);
  const [historicalDraft, setHistoricalDraft] = useState(defaultDraft);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([apiGet<Machine[]>("/machines"), apiGet<Profile[]>("/profiles"), apiGet<Vendor[]>("/master-data/vendors")])
      .then(([machineResult, profileResult, vendorResult]) => {
        if (isMounted) {
          setMachines(machineResult.data ?? []);
          setProfiles(profileResult.data ?? []);
          setVendors(vendorResult.data ?? []);
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("scanFilterLoadFailed"));
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const vendorByChar = useMemo(() => new Map(vendors.map((vendor) => [vendor.vendor_char, vendor])), [vendors]);
  const getVendorLabel = (vendorChar?: string | null) => {
    if (!vendorChar) {
      return "-";
    }

    const vendor = vendorByChar.get(vendorChar);
    return vendor ? `${vendor.vendor_name} (${vendor.vendor_char})` : vendorChar;
  };

  const allScansEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.machine_code) params.set("machine_code", filters.machine_code);
    if (filters.profile_id) params.set("profile_id", filters.profile_id);
    if (filters.vendor_char) params.set("vendor_char", filters.vendor_char);
    if (filters.final_status) params.set("final_status", filters.final_status);
    if (filters.from) params.set("from", new Date(filters.from).toISOString());
    if (filters.to) params.set("to", new Date(filters.to).toISOString());
    return `/scans?${params.toString()}`;
  }, [filters]);

  const duplicateScansEndpoint = useMemo(() => {
    const params = new URLSearchParams({ ng_reason: "SERVER_DUPLICATE" });
    if (filters.machine_code) params.set("machine_code", filters.machine_code);
    if (filters.profile_id) params.set("profile_id", filters.profile_id);
    if (filters.vendor_char) params.set("vendor_char", filters.vendor_char);
    if (filters.from) params.set("from", new Date(filters.from).toISOString());
    if (filters.to) params.set("to", new Date(filters.to).toISOString());
    return `/scans?${params.toString()}`;
  }, [filters]);

  const columns: Column<ScanRecord>[] = [
    { key: "time", header: t("colScanTime"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.scan_at} /> },
    { key: "machine", header: t("colMachine"), className: "min-w-[7rem] whitespace-nowrap", render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "chassis", header: t("colChassis"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <MonoText value={getChassisCode(item)} /> },
    { key: "vendor", header: t("colVendor"), className: "min-w-[8rem] whitespace-nowrap", render: (item) => <span className="text-sm">{getVendorLabel(item.full_vendor_char)}</span> },
    { key: "local_id", header: t("colLocalId"), className: "min-w-[9rem] whitespace-nowrap", render: (item) => <MonoText value={item.local_scan_id} /> },
    { key: "full", header: t("colFullCode"), className: "min-w-[18rem]", render: (item) => <MonoText value={item.full_code_raw} /> },
    { key: "duplicate", header: t("colDuplicateKey"), className: "min-w-[9rem] whitespace-nowrap", render: (item) => <MonoText value={item.duplicate_key} /> },
    { key: "local", header: t("colLocal"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.local_status} /> },
    { key: "server", header: t("colServer"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.server_status} /> },
    { key: "final", header: t("colFinal"), className: "w-24 min-w-[6rem] whitespace-nowrap", render: (item) => <StatusBadge value={item.final_status} /> },
    { key: "reason", header: t("colNgReason"), className: "min-w-[10rem]", render: (item) => item.ng_reason || "-" }
  ];

  const recentColumns: Column<DuplicateKey>[] = [
    { key: "key", header: t("colDuplicateKey"), render: (item) => <MonoText value={item.duplicate_key} /> },
    { key: "profile", header: t("colProfile"), render: (item) => <MonoText value={item.profile?.chassis_code?.code_full} /> },
    { key: "machine", header: t("colFirstMachine"), render: (item) => <MonoText value={item.first_machine?.machine_code} /> },
    { key: "first", header: t("colFirstScan"), render: (item) => <DateText value={item.first_scan_at} /> },
    { key: "expires", header: t("colExpires"), render: (item) => <DateText value={item.expires_at} /> },
    { key: "scan", header: t("colScanId"), render: (item) => <MonoText value={item.first_scan_record_id} /> }
  ];

  const historicalColumns: Column<HistoricalDuplicateResult>[] = [
    { key: "key", header: t("colDuplicateKey"), render: (item) => <MonoText value={item.duplicate_key} /> },
    { key: "profile", header: t("colProfile"), render: (item) => <MonoText value={item.profile?.chassis_code?.code_full} /> },
    { key: "count", header: t("colCount"), render: (item) => item.total_count },
    { key: "first", header: t("colFirst"), render: (item) => <DateText value={item.first_scan_at} /> },
    { key: "latest", header: t("colLatest"), render: (item) => <DateText value={item.latest_scan_at} /> },
    { key: "job", header: t("colJob"), render: (item) => <StatusBadge value={item.job?.status || "-"} /> }
  ];

  const runHistoricalJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsHistoricalJobSaving(true);
    try {
      await apiPost("/duplicates/historical-jobs/run", {
        profile_id: historicalDraft.profile_id ? Number(historicalDraft.profile_id) : undefined,
        from_date: new Date(historicalDraft.from_date).toISOString(),
        to_date: new Date(historicalDraft.to_date).toISOString()
      });
      toast.success(t("historicalJobDone"));
      setDuplicateRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("historicalJobFailed"));
    } finally {
      setIsHistoricalJobSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sticky top-[var(--app-header-height,4rem)] z-30 rounded-md border bg-background p-3 shadow-sm">
          <TabsList className="w-full justify-start overflow-x-auto bg-muted [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="all-scans">{t("scanTabAll")}</TabsTrigger>
            <TabsTrigger value="duplicate-scans">{t("scanTabDuplicates")}</TabsTrigger>
            <TabsTrigger value="active-duplicate-keys">{t("scanTabActiveDuplicateKeys")}</TabsTrigger>
            <TabsTrigger value="historical-duplicate-check">{t("scanTabHistoricalDuplicateCheck")}</TabsTrigger>
          </TabsList>

          {activeTab === "all-scans" || activeTab === "duplicate-scans" ? (
            <div className="mt-3">
              <ScanFiltersCard filters={filters} machines={machines} profiles={profiles} vendors={vendors} onFiltersChange={setFilters} hideFinalStatus={activeTab === "duplicate-scans"} />
            </div>
          ) : null}
        </div>

        <TabsContent value="all-scans">
          <div className="space-y-4">
            <DataTablePanel
              title={t("scanLatest")}
              endpoint={allScansEndpoint}
              columns={columns}
              getRowKey={(item) => item.id}
              singleExpandedRow
              pagination={{ pageSize: 100, mode: "server" }}
              renderExpandedRow={(item) => <ScanLedDetails scan={item} vendorLabel={getVendorLabel(item.full_vendor_char)} />}
              searchableText={getScanSearchableText(getVendorLabel)}
            />
          </div>
        </TabsContent>

        <TabsContent value="duplicate-scans">
          <div className="space-y-4">
            <DataTablePanel
              title={t("scanDuplicateLatest")}
              endpoint={duplicateScansEndpoint}
              columns={columns}
              getRowKey={(item) => item.id}
              singleExpandedRow
              pagination={{ pageSize: 100, mode: "server" }}
              renderExpandedRow={(item) => <ScanLedDetails scan={item} vendorLabel={getVendorLabel(item.full_vendor_char)} />}
              searchableText={getScanSearchableText(getVendorLabel)}
            />
          </div>
        </TabsContent>

        <TabsContent value="active-duplicate-keys">
          <DataTablePanel
            title={t("recentDuplicateKeys")}
            endpoint={`/duplicates/recent-keys?take=100&refresh=${duplicateRefreshId}`}
            columns={recentColumns}
            getRowKey={(item) => item.id}
            searchableText={(item) => `${item.duplicate_key} ${item.profile?.chassis_code?.code_full ?? ""} ${item.first_machine?.machine_code ?? ""}`}
          />
        </TabsContent>

        <TabsContent value="historical-duplicate-check">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("historicalDuplicateJobTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={runHistoricalJob}>
                  <SelectField label={t("colProfile")} value={historicalDraft.profile_id} onChange={(event) => setHistoricalDraft({ ...historicalDraft, profile_id: event.target.value })}>
                    <option value="">{t("allProfiles")}</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.chassis_code?.code_full ?? t("profileFallbackName", { id: profile.id })}
                      </option>
                    ))}
                  </SelectField>
                  <TextInputField required type="datetime-local" label={t("fieldFromDate")} value={historicalDraft.from_date} onChange={(event) => setHistoricalDraft({ ...historicalDraft, from_date: event.target.value })} />
                  <TextInputField required type="datetime-local" label={t("fieldToDate")} value={historicalDraft.to_date} onChange={(event) => setHistoricalDraft({ ...historicalDraft, to_date: event.target.value })} />
                  <div className="flex items-end">
                    <Button type="submit" disabled={isHistoricalJobSaving}>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      {t("run")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <DataTablePanel
              title={t("historicalDuplicateResults")}
              endpoint={`/duplicates/historical-results?take=100&refresh=${duplicateRefreshId}`}
              columns={historicalColumns}
              getRowKey={(item) => item.id}
              searchableText={(item) => `${item.duplicate_key} ${item.profile?.chassis_code?.code_full ?? ""} ${item.total_count} ${item.job?.status ?? ""}`}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScanFiltersCard({
  filters,
  machines,
  profiles,
  vendors,
  hideFinalStatus,
  onFiltersChange
}: {
  filters: ScanFilters;
  machines: Machine[];
  profiles: Profile[];
  vendors: Vendor[];
  hideFinalStatus?: boolean;
  onFiltersChange: (filters: ScanFilters) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto]">
        <SelectField label={t("colMachine")} value={filters.machine_code} onChange={(event) => onFiltersChange({ ...filters, machine_code: event.target.value })}>
          <option value="">{t("allMachines")}</option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.machine_code}>
              {machine.machine_code}
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
        {hideFinalStatus ? null : (
          <SelectField label={t("colFinal")} value={filters.final_status} onChange={(event) => onFiltersChange({ ...filters, final_status: event.target.value })}>
            <option value="">{t("allStatuses")}</option>
            <option value="OK">OK</option>
            <option value="NG">NG</option>
            <option value="PENDING">{t("pending")}</option>
          </SelectField>
        )}
        <TextInputField type="datetime-local" label={t("fieldFromDate")} value={filters.from} onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })} />
        <TextInputField type="datetime-local" label={t("fieldToDate")} value={filters.to} onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })} />
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={() => onFiltersChange(emptyFilters)}>
            <FilterX className="h-4 w-4" aria-hidden="true" />
            {t("clearFilter")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getScanSearchableText(getVendorLabel: (vendorChar?: string | null) => string) {
  return (item: ScanRecord) =>
    `${item.local_scan_id} ${item.full_code_raw} ${item.full_led_code ?? ""} ${item.full_vendor_char} ${getVendorLabel(item.full_vendor_char)} ${item.duplicate_key} ${item.machine?.machine_code ?? ""} ${item.profile?.chassis_code?.code_full ?? ""} ${item.ng_reason ?? ""} ${
      item.led_items
        ?.map((ledItem) => `${ledItem.led_slot} ${ledItem.led_index} ${getLedCodeForSlot(item, ledItem.led_slot)} ${ledItem.led_scan_raw} ${ledItem.led_lot_no ?? ""} ${ledItem.vendor_char} ${ledItem.led_suffix} ${ledItem.local_status} ${ledItem.ng_reason ?? ""}`)
        .join(" ") ?? ""
    }`;
}

function ScanLedDetails({ scan, vendorLabel }: { scan: ScanRecord; vendorLabel: string }) {
  const { t } = useI18n();
  const ledItems = [...(scan.led_items ?? [])].sort((first, second) => first.led_slot - second.led_slot || first.led_index - second.led_index || first.id - second.id);

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-7">
        <DetailValue label={t("colChassis")} value={getChassisCode(scan)} mono />
        <DetailValue label={t("colVendor")} value={vendorLabel} />
        <DetailValue label={t("scanFullLedCode")} value={scan.full_led_code ?? "-"} mono />
        <DetailValue label={t("scanLedSlot1")} value={getLedCodeForSlot(scan, 1)} mono />
        <DetailValue label={t("scanLedSlot2")} value={getLedCodeForSlot(scan, 2)} mono />
        <DetailValue label={t("colFactory")} value={scan.full_factory_code ?? "-"} mono />
        <DetailValue label={t("colDuplicateKey")} value={scan.duplicate_key} mono />
      </div>

      {ledItems.length === 0 ? (
        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">{t("scanLedDetailsEmpty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 whitespace-nowrap">{t("colLedSlot")}</TableHead>
                <TableHead className="w-20 whitespace-nowrap">{t("colLedIndex")}</TableHead>
                <TableHead className="min-w-[9rem] whitespace-nowrap">{t("colLedCode")}</TableHead>
                <TableHead className="min-w-[18rem]">{t("colRawScan")}</TableHead>
                <TableHead className="min-w-[8rem] whitespace-nowrap">{t("colLotNo")}</TableHead>
                <TableHead className="w-28 whitespace-nowrap">{t("colVendorChar")}</TableHead>
                <TableHead className="min-w-[8rem] whitespace-nowrap">{t("colSuffixCheck")}</TableHead>
                <TableHead className="w-24 whitespace-nowrap">{t("colLocal")}</TableHead>
                <TableHead className="min-w-[10rem]">{t("colNgReason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledItems.map((ledItem) => (
                <TableRow key={ledItem.id}>
                  <TableCell>
                    <MonoText value={ledItem.led_slot} />
                  </TableCell>
                  <TableCell>
                    <MonoText value={ledItem.led_index} />
                  </TableCell>
                  <TableCell>
                    <MonoText value={getLedCodeForSlot(scan, ledItem.led_slot)} />
                  </TableCell>
                  <TableCell>
                    <MonoText value={ledItem.led_scan_raw} />
                  </TableCell>
                  <TableCell>
                    <MonoText value={ledItem.led_lot_no ?? "-"} />
                  </TableCell>
                  <TableCell>
                    <MonoText value={ledItem.vendor_char} />
                  </TableCell>
                  <TableCell>
                    <MonoText value={ledItem.led_suffix} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={ledItem.local_status} />
                  </TableCell>
                  <TableCell>{ledItem.ng_reason || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function getChassisCode(scan: ScanRecord) {
  return scan.full_chassis_code ?? scan.profile?.chassis_code?.code_full ?? "-";
}

function getLedCodeForSlot(scan: ScanRecord, slot: number) {
  return scan.profile?.profile_led_codes?.find((item) => item.led_slot === slot)?.led_code?.code_full ?? "-";
}

function DetailValue({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={mono ? "mt-1 font-mono text-xs" : "mt-1 text-sm font-medium"}>{value}</div>
    </div>
  );
}

function toDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
