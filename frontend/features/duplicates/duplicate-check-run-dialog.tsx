"use client";

import { FormEvent, useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SelectField, TextInputField } from "@/features/shared/form-fields";
import type { HistoricalDuplicateJob, HistoricalDuplicateResult } from "@/features/shared/types";
import { apiPost } from "@/lib/api";
import { appDatetimeLocalToIso, toAppDatetimeLocal } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";

type CheckScope = "all" | "range";

type CheckDraft = {
  scope: CheckScope;
  fromDate: string;
  toDate: string;
};

export function DuplicateCheckRunDialog({ onCompleted }: { onCompleted: (job: HistoricalDuplicateJob) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [draft, setDraft] = useState<CheckDraft>(() => createDefaultDraft());

  const handleOpenChange = (nextOpen: boolean) => {
    if (isRunning) {
      return;
    }
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(createDefaultDraft());
    }
  };

  const runCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.scope === "range" && new Date(draft.fromDate).getTime() > new Date(draft.toDate).getTime()) {
      toast.error(t("duplicateCheckInvalidRange"));
      return;
    }

    setIsRunning(true);
    const toastId = toast.loading(t("duplicateCheckRunning"));
    try {
      const result =
        draft.scope === "all"
          ? await apiPost<{ job?: HistoricalDuplicateJob; results?: HistoricalDuplicateResult[] }, Record<string, never>>("/duplicates/full-audit/run", {})
          : await apiPost<{ job?: HistoricalDuplicateJob; results?: HistoricalDuplicateResult[] }, { from_date: string; to_date: string }>("/duplicates/historical-jobs/run", {
              from_date: appDatetimeLocalToIso(draft.fromDate),
              to_date: appDatetimeLocalToIso(draft.toDate)
            });

      if (!result.data?.job) {
        throw new Error(t("duplicateCheckMissingResult"));
      }

      onCompleted(result.data.job);
      setOpen(false);
      toast.success(t("duplicateCheckRunDone"), { id: toastId });
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : t("duplicateCheckRunFailed"), { id: toastId });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Play className="h-4 w-4" aria-hidden="true" />
          {t("runDuplicateCheck")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="space-y-4" onSubmit={runCheck}>
          <DialogHeader>
            <DialogTitle>{t("runDuplicateCheck")}</DialogTitle>
            <DialogDescription>{t("runDuplicateCheckDesc")}</DialogDescription>
          </DialogHeader>

          <SelectField label={t("duplicateCheckScope")} value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value as CheckScope })}>
            <option value="all">{t("duplicateCheckAllDatabase")}</option>
            <option value="range">{t("duplicateCheckDateRange")}</option>
          </SelectField>

          {draft.scope === "range" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInputField
                required
                type="datetime-local"
                label={t("fieldFromDate")}
                value={draft.fromDate}
                onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })}
              />
              <TextInputField
                required
                type="datetime-local"
                label={t("fieldToDate")}
                value={draft.toDate}
                onChange={(event) => setDraft({ ...draft, toDate: event.target.value })}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isRunning}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isRunning}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {isRunning ? t("statusRunning") : t("runDuplicateCheck")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function createDefaultDraft(): CheckDraft {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    scope: "all",
    fromDate: toAppDatetimeLocal(sevenDaysAgo),
    toDate: toAppDatetimeLocal(now)
  };
}
