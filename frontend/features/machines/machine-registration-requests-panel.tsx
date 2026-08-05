"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Download, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { MachineRegistrationRequest } from "@/features/shared/types";

type LicenseExport = {
  file_name: string;
  content: Record<string, unknown>;
};

type ApprovalDraft = {
  machine_code: string;
  machine_name: string;
};

const emptyApprovalDraft: ApprovalDraft = {
  machine_code: "",
  machine_name: ""
};

export function MachineRegistrationRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [licenseTarget, setLicenseTarget] = useState<MachineRegistrationRequest | null>(null);
  const [licenseText, setLicenseText] = useState("");
  const [approvalTarget, setApprovalTarget] = useState<MachineRegistrationRequest | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>(emptyApprovalDraft);
  const [rejectTarget, setRejectTarget] = useState<MachineRegistrationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const canManageRegistration = user?.role === "DEV";
  const canManageLicense = canManageRegistration;
  const canApprove = canManageRegistration;
  const canViewIdentity = canManageRegistration;

  const columns = useMemo<Column<MachineRegistrationRequest>[]>(
    () => [
      { key: "request", header: t("colRequest"), render: (item) => <MonoText value={item.request_id} /> },
      ...(canViewIdentity
        ? [
            { key: "serial", header: t("colSerial"), render: (item: MachineRegistrationRequest) => <MonoText value={item.serial} /> },
            { key: "uid", header: t("colUid"), render: (item: MachineRegistrationRequest) => <MonoText value={item.uid} /> }
          ]
        : []),
      { key: "ip", header: t("colIp"), render: (item) => <MonoText value={item.ip_address} /> },
      { key: "host", header: t("colHost"), render: (item) => item.hostname || "-" },
      { key: "license", header: t("colLicense"), render: (item) => <StatusBadge value={item.license_activated_at ? "ACTIVATED" : "PENDING"} /> },
      { key: "created", header: t("colCreatedAt"), render: (item) => <DateText value={item.created_at} /> },
      {
        key: "actions",
        header: t("colActions"),
        className: "w-[22rem] text-right",
        render: (item) => (
          <div className="flex flex-wrap justify-end gap-2">
            {canManageLicense ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportInfo(item)}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t("export")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openLicenseDialog(item)} disabled={item.status !== "PENDING"}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {t("import")}
                </Button>
              </>
            ) : null}
            {canApprove ? (
              <Button type="button" size="sm" onClick={() => openApprovalDialog(item)} disabled={!item.license_activated_at || item.status !== "PENDING"}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t("approve")}
              </Button>
            ) : null}
            {canApprove ? (
              <Button type="button" variant="outline" size="sm" onClick={() => openRejectDialog(item)} disabled={item.status !== "PENDING"}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {t("reject")}
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [canApprove, canManageLicense, canViewIdentity, t]
  );

  const refresh = () => {
    setRefreshId((value) => value + 1);
    onChanged();
  };

  const exportInfo = async (item: MachineRegistrationRequest) => {
    setIsSaving(true);
    try {
      const result = await apiGet<LicenseExport>(`/machines/register-requests/${item.id}/license-export`);
      const data = result.data;
      if (!data) {
        throw new Error(t("apiReturnedNoFile"));
      }
      downloadJson(data.file_name, data.content);
      toast.success(t("licenseFileExported"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("licenseFileExportFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const openLicenseDialog = (item: MachineRegistrationRequest) => {
    setLicenseTarget(item);
    setLicenseText("");
  };

  const openApprovalDialog = (item: MachineRegistrationRequest) => {
    setApprovalTarget(item);
    setApprovalDraft({
      machine_code: item.requested_machine_code || "",
      machine_name: item.hostname || item.requested_machine_code || ""
    });
  };

  const openRejectDialog = (item: MachineRegistrationRequest) => {
    setRejectTarget(item);
    setRejectReason("");
  };

  const readLicenseFile = async (file?: File | null) => {
    if (!file) {
      return;
    }

    try {
      setLicenseText(await file.text());
    } catch {
      toast.error(t("licenseFileReadFailed"));
    }
  };

  const importLicense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!licenseTarget) {
      return;
    }

    const trimmedText = licenseText.trim();
    if (!trimmedText) {
      toast.warning(t("licenseMissingContent"));
      return;
    }

    setIsSaving(true);
    try {
      await apiPost(`/machines/register-requests/${licenseTarget.id}/license/import`, buildLicenseImportBody(trimmedText));
      toast.success(t("licenseImported"));
      setLicenseTarget(null);
      setLicenseText("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("licenseInvalid"));
    } finally {
      setIsSaving(false);
    }
  };

  const approveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!approvalTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await apiPost(`/machines/register-requests/${approvalTarget.id}/approve`, {
        machine_code: approvalDraft.machine_code,
        machine_name: approvalDraft.machine_name,
        is_active: true
      });
      toast.success(t("machineIdentified"));
      setApprovalTarget(null);
      setApprovalDraft(emptyApprovalDraft);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("machineIdentifyFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const rejectRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await apiPost(`/machines/register-requests/${rejectTarget.id}/reject`, {
        reason: rejectReason
      });
      toast.success(t("registrationRejected"));
      setRejectTarget(null);
      setRejectReason("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("registrationRejectFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DataTablePanel
        title={t("registrationRequestsTitle")}
        endpoint={`/machines/register-requests?take=50&status=PENDING&refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
      />

      <Dialog open={Boolean(licenseTarget)} onOpenChange={(open) => !open && setLicenseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("importLicenseTitle")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={importLicense}>
            {canViewIdentity ? (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="grid gap-1">
                  <div>
                    <span className="text-muted-foreground">{t("fieldSerial")}:</span> <MonoText value={licenseTarget?.serial} />
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("fieldUid")}:</span> <MonoText value={licenseTarget?.uid} />
                  </div>
                </div>
              </div>
            ) : null}
            <Input type="file" accept=".json,.license,.txt,application/json,text/plain" onChange={(event) => void readLicenseFile(event.currentTarget.files?.[0])} />
            <textarea
              className="min-h-32 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t("licenseTextPlaceholder")}
              value={licenseText}
              onChange={(event) => setLicenseText(event.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLicenseTarget(null)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t("import")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(approvalTarget)} onOpenChange={(open) => !open && setApprovalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("identifyMachineTitle")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={approveRequest}>
            <Input required placeholder={t("machineCodePlaceholder")} value={approvalDraft.machine_code} onChange={(event) => setApprovalDraft({ ...approvalDraft, machine_code: event.target.value })} />
            <Input required placeholder={t("machineNamePlaceholder")} value={approvalDraft.machine_name} onChange={(event) => setApprovalDraft({ ...approvalDraft, machine_name: event.target.value })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApprovalTarget(null)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving || !approvalTarget?.license_activated_at}>
                {t("approve")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectRegistrationTitle")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={rejectRequest}>
            <Input required placeholder={t("rejectReasonPlaceholder")} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={isSaving}>
                {t("reject")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildLicenseImportBody(text: string) {
  try {
    return {
      license_file: JSON.parse(text) as unknown
    };
  } catch {
    return {
      license_key: text,
      license_file_text: text
    };
  }
}

function downloadJson(fileName: string, content: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
