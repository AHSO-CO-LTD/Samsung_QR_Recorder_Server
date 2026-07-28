"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPut } from "@/lib/api";
import { formatAppDateTime } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { CheckboxField, NumberInputField, SelectField, TextInputField } from "@/features/shared/form-fields";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import { DuplicateCheckRunDialog } from "@/features/duplicates/duplicate-check-run-dialog";
import type { FullAuditJobDetail, HistoricalDuplicateJob, HistoricalDuplicateResult, HistoricalDuplicateSchedule, HistoricalDuplicateScheduleOverview } from "@/features/shared/types";

const defaultSchedule: HistoricalDuplicateSchedule = {
  enabled: false,
  frequency: "DAILY",
  run_time: "00:00",
  day_of_week: 1,
  day_of_month: 1,
  last_run_at: null,
  next_run_at: null
};

export function DuplicateAuditView() {
  const { t } = useI18n();
  const [schedule, setSchedule] = useState<HistoricalDuplicateSchedule>(defaultSchedule);
  const [latestJob, setLatestJob] = useState<HistoricalDuplicateJob | null>(null);
  const [selectedJob, setSelectedJob] = useState<HistoricalDuplicateJob | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<FullAuditJobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJobDetailLoading, setIsJobDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobDetailError, setJobDetailError] = useState<string | null>(null);
  const [refreshId, setRefreshId] = useState(0);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<HistoricalDuplicateScheduleOverview>("/duplicates/full-audit/schedule");
      const nextLatestJob = result.data?.latest_job ?? null;
      setSchedule(result.data?.schedule ?? defaultSchedule);
      setLatestJob(nextLatestJob);
      setSelectedJob((current) => current ?? nextLatestJob);
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : t("fullAuditScheduleLoadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedJob) {
      setSelectedJobDetail(null);
      setJobDetailError(null);
      return;
    }

    let isMounted = true;
    setIsJobDetailLoading(true);
    setJobDetailError(null);
    void apiGet<FullAuditJobDetail>(`/duplicates/full-audit/jobs/${selectedJob.id}/detail`)
      .then((result) => {
        if (isMounted) {
          setSelectedJobDetail(result.data ?? null);
        }
      })
      .catch((currentError) => {
        const message = currentError instanceof Error ? currentError.message : t("fullAuditDetailLoadFailed");
        if (isMounted) {
          setJobDetailError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsJobDetailLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedJob, refreshId, t]);

  const jobColumns = useMemo<Column<HistoricalDuplicateJob>[]>(
    () => [
      { key: "id", header: t("colJob"), className: "w-24 whitespace-nowrap", render: (item) => <MonoText value={item.id} /> },
      { key: "created", header: t("colRunAt"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.created_at} /> },
      { key: "trigger", header: t("colTrigger"), className: "min-w-[9rem] whitespace-nowrap", render: (item) => getJobTriggerLabel(item.trigger_type, t) },
      { key: "status", header: t("colStatus"), className: "w-28 whitespace-nowrap", render: (item) => <StatusBadge value={item.status} /> },
      { key: "count", header: t("colDuplicateGroups"), className: "w-28 whitespace-nowrap", render: (item) => item._count?.results ?? 0 },
      { key: "from", header: t("fieldFromDate"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.from_date} /> },
      { key: "to", header: t("fieldToDate"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.to_date} /> },
      { key: "finished", header: t("colFinishedAt"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.finished_at} /> }
    ],
    [t]
  );

  const resultColumns = useMemo<Column<HistoricalDuplicateResult>[]>(
    () => [
      { key: "duplicate_key", header: t("colDuplicateKey"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <MonoText value={item.duplicate_key} /> },
      { key: "profile", header: t("colProfile"), className: "min-w-[9rem] whitespace-nowrap", render: (item) => <MonoText value={item.profile?.chassis_code?.code_full} /> },
      { key: "count", header: t("colCount"), className: "w-24 whitespace-nowrap", render: (item) => item.total_count },
      { key: "first", header: t("colFirst"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.first_scan_at} /> },
      { key: "latest", header: t("colLatest"), className: "min-w-[10rem] whitespace-nowrap", render: (item) => <DateText value={item.latest_scan_at} /> },
      { key: "scan_ids", header: t("colScanCount"), className: "w-28 whitespace-nowrap", render: (item) => getScanRecordIds(item).length },
      { key: "job", header: t("colJob"), className: "w-28 whitespace-nowrap", render: (item) => <StatusBadge value={item.job?.status || "-"} /> }
    ],
    [t]
  );

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await apiPut<HistoricalDuplicateSchedule, Pick<HistoricalDuplicateSchedule, "enabled" | "frequency" | "run_time" | "day_of_week" | "day_of_month">>("/duplicates/full-audit/schedule", {
        enabled: schedule.enabled,
        frequency: schedule.frequency,
        run_time: schedule.run_time,
        day_of_week: Number(schedule.day_of_week || 1),
        day_of_month: Number(schedule.day_of_month || 1)
      });
      setSchedule(result.data ?? schedule);
      toast.success(schedule.enabled ? t("fullAuditScheduleSaved") : t("fullAuditScheduleDisabled"));
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : t("fullAuditScheduleSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckCompleted = (job: HistoricalDuplicateJob) => {
    setLatestJob(job);
    setSelectedJob(job);
    setRefreshId((value) => value + 1);
    void loadOverview();
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <Card>
              <CardHeader>
                <CardTitle>{t("fullAuditScheduleTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
                {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
                {!isLoading ? (
                  <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" onSubmit={saveSchedule}>
                    <CheckboxField
                      label={t("fullAuditScheduleEnabled")}
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => setSchedule({ ...schedule, enabled: checked })}
                    />
                    <SelectField label={t("fullAuditFrequency")} value={schedule.frequency} onChange={(event) => setSchedule({ ...schedule, frequency: event.target.value as HistoricalDuplicateSchedule["frequency"] })}>
                      <option value="DAILY">{t("frequencyDaily")}</option>
                      <option value="WEEKLY">{t("frequencyWeekly")}</option>
                      <option value="MONTHLY">{t("frequencyMonthly")}</option>
                    </SelectField>
                    <TextInputField type="time" label={t("fullAuditRunTime")} value={schedule.run_time} onChange={(event) => setSchedule({ ...schedule, run_time: event.target.value })} />
                    {schedule.frequency === "WEEKLY" ? (
                      <SelectField label={t("fullAuditWeekday")} value={schedule.day_of_week} onChange={(event) => setSchedule({ ...schedule, day_of_week: Number(event.target.value) })}>
                        {getWeekdayOptions(t).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    ) : (
                      <NumberInputField
                        label={t("fullAuditMonthDay")}
                        min={1}
                        max={31}
                        value={schedule.day_of_month}
                        disabled={schedule.frequency !== "MONTHLY"}
                        onChange={(event) => setSchedule({ ...schedule, day_of_month: Number(event.target.value) })}
                      />
                    )}
                    <div className="flex items-end">
                      <Button type="submit" disabled={isSaving} className="w-full whitespace-nowrap md:w-auto">
                        <Save className="h-4 w-4" aria-hidden="true" />
                        {isSaving ? t("saving") : t("saveSettings")}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("fullAuditStatusTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <SummaryValue label={t("fullAuditScheduleStatus")} value={schedule.enabled ? t("active") : t("inactive")} />
                <SummaryValue label={t("fullAuditNextRun")} value={<DateText value={schedule.next_run_at} />} />
                <SummaryValue label={t("fullAuditLastRun")} value={<DateText value={schedule.last_run_at} />} />
                <SummaryValue label={t("fullAuditLatestJob")} value={latestJob ? <StatusBadge value={latestJob.status} /> : "-"} />
              </CardContent>
            </Card>
      </div>

      <DataTablePanel
            title={t("fullAuditRunsTitle")}
            endpoint={`/duplicates/full-audit/jobs?refresh=${refreshId}`}
            columns={jobColumns}
            getRowKey={(item) => item.id}
            actions={<DuplicateCheckRunDialog onCompleted={handleCheckCompleted} />}
            emptyText={t("fullAuditNoRuns")}
            pagination={{ pageSize: 10, mode: "server" }}
            onData={(jobs) => {
              setSelectedJob((current) => current ?? jobs[0] ?? null);
            }}
            onRowClick={setSelectedJob}
            rowClassName={(item) => (item.id === selectedJob?.id ? "bg-muted/50" : "")}
      />

      <FullAuditJobDetailPanel job={selectedJob} detail={selectedJobDetail} isLoading={isJobDetailLoading} error={jobDetailError} />

      <DataTablePanel
            title={selectedJob ? t("fullAuditResultForSelectedRun", { id: selectedJob.id }) : t("fullAuditReportTitle")}
            endpoint={selectedJob ? `/duplicates/full-audit/results?job_id=${selectedJob.id}&refresh=${refreshId}` : `/duplicates/full-audit/results?refresh=${refreshId}`}
            columns={resultColumns}
            getRowKey={(item) => item.id}
            emptyText={selectedJob ? t("fullAuditNoResultsForRun") : t("fullAuditSelectRun")}
            pagination={{ pageSize: 10, mode: "server" }}
            singleExpandedRow
            renderExpandedRow={(item) => <FullAuditResultDetails result={item} />}
      />
    </div>
  );
}

function FullAuditJobDetailPanel({
  job,
  detail,
  isLoading,
  error
}: {
  job: HistoricalDuplicateJob | null;
  detail: FullAuditJobDetail | null;
  isLoading: boolean;
  error: string | null;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{job ? t("fullAuditSelectedDetailTitle", { id: job.id }) : t("fullAuditSelectedDetailEmptyTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!job ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("fullAuditSelectRun")}</div> : null}
        {job && isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
        {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
        {detail && !isLoading && !error ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryValue label={t("fullAuditTotalScannedCodes")} value={<MonoText value={detail.total_scanned_codes} />} />
              <SummaryValue label={t("fullAuditProfileCount")} value={<MonoText value={detail.profile_count} />} />
              <SummaryValue label={t("fullAuditDuplicateGroupCount")} value={<MonoText value={detail.duplicate_group_count} />} />
              <SummaryValue label={t("fullAuditDuplicateScanCount")} value={<MonoText value={detail.duplicate_scan_count} />} />
              <SummaryValue label={t("fullAuditDuplicateExtraCount")} value={<MonoText value={detail.duplicate_extra_count} />} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <DetailTableShell title={t("fullAuditCodesPerProfile")}>
                {detail.profile_counts.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{t("fullAuditNoProfileCounts")}</div>
                ) : (
                  <Table showTopScrollbar topScrollbarLabel={t("tableTopScrollbar")}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("colProfile")}</TableHead>
                        <TableHead className="w-32 text-right">{t("colProfileScanCount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.profile_counts.map((item) => (
                        <TableRow key={item.profile_id}>
                          <TableCell>
                            <MonoText value={item.profile_label} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MonoText value={item.total_codes} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DetailTableShell>

              <DetailTableShell title={t("fullAuditDuplicateProfiles")}>
                {detail.duplicate_profiles.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{t("fullAuditNoDuplicateProfiles")}</div>
                ) : (
                  <Table showTopScrollbar topScrollbarLabel={t("tableTopScrollbar")}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("colProfile")}</TableHead>
                        <TableHead className="w-28 text-right">{t("colDuplicateGroups")}</TableHead>
                        <TableHead className="w-28 text-right">{t("colDuplicateScanCount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.duplicate_profiles.map((item) => (
                        <TableRow key={item.profile_id}>
                          <TableCell>
                            <div className="grid gap-1">
                              <MonoText value={item.profile_label} />
                              <span className="text-xs text-muted-foreground">{item.duplicate_keys.join(", ")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <MonoText value={item.duplicate_group_count} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MonoText value={item.duplicate_scan_count} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DetailTableShell>
            </div>

            <DetailTableShell title={t("fullAuditDuplicateKeys")}>
              {detail.duplicate_keys.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">{t("fullAuditNoDuplicateKeys")}</div>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <Table showTopScrollbar topScrollbarLabel={t("tableTopScrollbar")}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[9rem]">{t("colProfile")}</TableHead>
                        <TableHead className="min-w-[10rem]">{t("colDuplicateKey")}</TableHead>
                        <TableHead className="w-24 text-right">{t("colCount")}</TableHead>
                        <TableHead className="min-w-[10rem]">{t("colFirst")}</TableHead>
                        <TableHead className="min-w-[10rem]">{t("colLatest")}</TableHead>
                        <TableHead className="min-w-[12rem]">{t("colScanIds")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.duplicate_keys.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <MonoText value={item.profile_label} />
                          </TableCell>
                          <TableCell>
                            <MonoText value={item.duplicate_key} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MonoText value={item.total_count} />
                          </TableCell>
                          <TableCell>
                            <DateText value={item.first_scan_at} />
                          </TableCell>
                          <TableCell>
                            <DateText value={item.latest_scan_at} />
                          </TableCell>
                          <TableCell>
                            <MonoText value={Array.isArray(item.scan_record_ids_json) ? item.scan_record_ids_json.join(", ") : "-"} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DetailTableShell>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FullAuditResultDetails({ result }: { result: HistoricalDuplicateResult }) {
  const { locale, t } = useI18n();
  const scanIds = getScanRecordIds(result);

  return (
    <div className="grid gap-2 p-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
      <DetailValue label={t("colDuplicateKey")} value={result.duplicate_key} mono />
      <DetailValue label={t("colProfile")} value={result.profile?.chassis_code?.code_full ?? "-"} mono />
      <DetailValue label={t("colScanIds")} value={scanIds.length > 0 ? scanIds.join(", ") : "-"} mono />
      <DetailValue
        label={t("fullAuditJobWindow")}
        value={`${formatAppDateTime(result.job?.from_date ?? result.first_scan_at, locale)} - ${formatAppDateTime(result.job?.to_date ?? result.latest_scan_at, locale)}`}
      />
    </div>
  );
}

function DetailTableShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border bg-background">
      <div className="border-b px-3 py-2 text-sm font-medium">{title}</div>
      {children}
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function DetailValue({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 text-sm font-medium"}>{value}</div>
    </div>
  );
}

function getScanRecordIds(result: HistoricalDuplicateResult) {
  return Array.isArray(result.scan_record_ids_json) ? result.scan_record_ids_json : [];
}

function getJobTriggerLabel(triggerType: HistoricalDuplicateJob["trigger_type"], t: ReturnType<typeof useI18n>["t"]) {
  if (triggerType === "SCHEDULED_FULL") {
    return t("fullAuditTriggerScheduled");
  }

  if (triggerType === "MANUAL_FULL") {
    return t("fullAuditTriggerManual");
  }

  if (triggerType === "MANUAL_RANGE") {
    return t("fullAuditTriggerManualRange");
  }

  return triggerType;
}

function getWeekdayOptions(t: ReturnType<typeof useI18n>["t"]) {
  return [
    { value: 1, label: t("weekdayMonday") },
    { value: 2, label: t("weekdayTuesday") },
    { value: 3, label: t("weekdayWednesday") },
    { value: 4, label: t("weekdayThursday") },
    { value: 5, label: t("weekdayFriday") },
    { value: 6, label: t("weekdaySaturday") },
    { value: 7, label: t("weekdaySunday") }
  ];
}
