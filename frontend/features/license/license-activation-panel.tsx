"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { BadgeCheck, Clipboard, FileJson, KeyRound, RefreshCw, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDesktopApp, type DesktopLicenseRequestInfo, type DesktopLicenseStatus } from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import { getLicenseCopy } from "./license-copy";

type LicenseActivationPanelProps = {
  status: DesktopLicenseStatus | null;
  isLoading: boolean;
  error?: string | null;
  mode?: "gate" | "settings";
  onRefresh: () => void | Promise<void>;
  onActivated?: (status: DesktopLicenseStatus) => void;
};

export function LicenseActivationPanel({
  status,
  isLoading,
  error,
  mode = "settings",
  onRefresh,
  onActivated
}: LicenseActivationPanelProps) {
  const { locale } = useI18n();
  const copy = getLicenseCopy(locale);
  const [licenseText, setLicenseText] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const isGateMode = mode === "gate";

  const statusLabel = useMemo(() => {
    if (!status) {
      return "-";
    }
    if (status.state === "active") {
      return copy.active;
    }
    if (status.state === "invalid") {
      return copy.invalid;
    }
    return copy.unactivated;
  }, [copy.active, copy.invalid, copy.unactivated, status]);

  const copyMachineId = async () => {
    if (!status?.machineId) {
      return;
    }

    await navigator.clipboard.writeText(status.machineId);
    toast.success(copy.copied);
  };

  const exportRequestInfo = async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp?.license) {
      toast.warning(copy.unavailable);
      return;
    }

    try {
      const requestInfo = await desktopApp.license.getRequestInfo();
      downloadJson(buildLicenseRequestFileName(requestInfo), requestInfo);
      toast.success(copy.exported);
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : copy.loadFailed);
    }
  };

  const readLicenseFile = async (file?: File | null) => {
    if (!file) {
      return;
    }

    try {
      setLicenseText(await file.text());
    } catch {
      toast.error(copy.fileReadFailed);
    }
  };

  const activateLicense = async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp?.license) {
      toast.warning(copy.unavailable);
      return;
    }

    const trimmed = licenseText.trim();
    if (!trimmed) {
      toast.warning(copy.missingLicense);
      return;
    }

    setIsActivating(true);
    try {
      const result = await desktopApp.license.activate(trimmed);
      onActivated?.(result);
      if (result.ok) {
        setLicenseText("");
        toast.success(copy.activated);
        return;
      }
      toast.error(result.why ? `${copy.activateFailed}: ${result.why}` : copy.activateFailed);
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : copy.activateFailed);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Card className={cn("w-full", isGateMode ? "max-w-3xl" : "")}>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex min-w-0 items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{isGateMode ? copy.activationTitle : copy.title}</span>
            </CardTitle>
            <CardDescription>{isGateMode ? copy.activationDesc : copy.desc}</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void onRefresh()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading ? "animate-spin" : "")} aria-hidden="true" />
              {copy.refresh}
            </Button>
            <Button type="button" variant="outline" onClick={() => void exportRequestInfo()}>
              <FileJson className="h-4 w-4" aria-hidden="true" />
              {copy.exportInfo}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex min-w-0 items-start gap-3 rounded-md border px-3 py-3 text-sm",
            status?.state === "active" ? "border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" : "",
            status?.state === "invalid" || error ? "border-destructive/50 bg-destructive/5 text-destructive" : ""
          )}
        >
          {status?.state === "active" ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-semibold">{statusLabel}</span>
              {isGateMode && status?.state !== "active" ? <Badge variant="outline">{copy.requiredTitle}</Badge> : null}
            </div>
            {isGateMode && status?.state !== "active" ? <p className="mt-1 text-xs opacity-80">{copy.requiredDesc}</p> : null}
            {status?.why ? <p className="mt-1 break-words text-xs opacity-80">{status.why}</p> : null}
            {error ? <p className="mt-1 break-words text-xs opacity-80">{error}</p> : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <InfoCell label={copy.machineId} value={status?.machineId ?? "-"} mono action={<IconButton label={copy.copyMachine} icon={Clipboard} onClick={() => void copyMachineId()} disabled={!status?.machineId} />} />
              <InfoCell label={copy.product} value={status?.product ?? "-"} mono />
              <InfoCell label={copy.version} value={status?.version ?? "-"} mono />
              <InfoCell label={copy.releaseDate} value={status?.releaseDate ?? "-"} mono />
              {!isGateMode ? <InfoCell label={copy.customer} value={asText(status?.lic?.customer_id)} /> : null}
              {!isGateMode ? <InfoCell label={copy.project} value={asText(status?.lic?.project)} /> : null}
              {!isGateMode ? <InfoCell label={copy.updateUntil} value={asText(status?.lic?.update_until)} /> : null}
              {!isGateMode ? <InfoCell label={copy.expiresAt} value={asText(status?.lic?.expires_at)} /> : null}
              {!isGateMode ? <InfoCell label={copy.sdkSource} value={copy.sdkSourceValue} mono /> : null}
              {!isGateMode ? <InfoCell label={copy.licensePath} value={status?.licensePath ?? "-"} mono /> : null}
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-3 space-y-1">
                <p className="text-sm font-semibold">{copy.exportStepTitle}</p>
                <p className="text-xs text-muted-foreground">{copy.exportStepDesc}</p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => void exportRequestInfo()}>
                <FileJson className="h-4 w-4" aria-hidden="true" />
                {copy.exportInfo}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{copy.importStepTitle}</p>
              <p className="text-xs text-muted-foreground">{copy.importStepDesc}</p>
            </div>
            <Input aria-label={copy.importFile} type="file" accept=".license,.txt,.dat,text/plain,application/octet-stream" onChange={(event) => void readLicenseFile(event.currentTarget.files?.[0])} />
            <textarea
              className="min-h-36 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={copy.placeholder}
              value={licenseText}
              onChange={(event) => setLicenseText(event.target.value)}
            />
            <Button type="button" className="w-full" onClick={() => void activateLicense()} disabled={isActivating}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {isActivating ? copy.activating : copy.activate}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCell({ label, value, mono = false, action }: { label: string; value: string; mono?: boolean; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-semibold", mono ? "font-mono" : "")}>{value || "-"}</p>
      </div>
      {action}
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "-";
}

function buildLicenseRequestFileName(requestInfo: DesktopLicenseRequestInfo) {
  return `server-license-request-${requestInfo.machine_id}.json`;
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
