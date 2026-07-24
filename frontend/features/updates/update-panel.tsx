"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Download, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDesktopApp, type DesktopUpdateRelease, type DesktopUpdateState } from "@/lib/desktop-app";
import { formatAppDateTime } from "@/lib/app-time";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

type UpdatePanelMode = "login" | "settings";

const copy = {
  vi: {
    title: "Cập nhật ứng dụng",
    loginTitle: "Kiểm tra cập nhật",
    desc: "Kiểm tra GitHub Releases và chỉ cho phép cài bản mới hơn bản hiện tại.",
    loginDesc: "Kiểm tra bản mới trước khi đăng nhập.",
    check: "Kiểm tra",
    checking: "Đang kiểm tra...",
    release: "Bản phát hành",
    preRelease: "Bản thử nghiệm",
    update: "Cập nhật",
    currentVersion: "Phiên bản hiện tại",
    source: "Nguồn cập nhật",
    mode: "Chế độ",
    packaged: "Bản cài đặt",
    devRuntime: "Môi trường dev",
    noSource: "Chưa cấu hình",
    noUpdate: "Chưa có bản mới hơn bản hiện tại.",
    notChecked: "Chưa kiểm tra cập nhật.",
    unavailable: "Chức năng cập nhật chỉ hoạt động trong ứng dụng desktop Electron.",
    checkFailed: "Không kiểm tra được bản cập nhật.",
    installUnavailable: "Chức năng cập nhật chỉ hoạt động trong ứng dụng desktop Electron.",
    installing: "Đang tải {tag}...",
    installStarted: "Cập nhật đã bắt đầu. Ứng dụng sẽ đóng; mở lại ứng dụng sau khi trình cài đặt chạy xong.",
    installFailed: "Không cài được bản cập nhật.",
    updateDisabledInDev: "Cài cập nhật chỉ khả dụng trong bản đã đóng gói."
  },
  en: {
    title: "Application updates",
    loginTitle: "Check for updates",
    desc: "Check GitHub Releases and only allow versions newer than the current build.",
    loginDesc: "Check for a newer build before signing in.",
    check: "Check",
    checking: "Checking...",
    release: "Release",
    preRelease: "Pre-release",
    update: "Update",
    currentVersion: "Current version",
    source: "Update source",
    mode: "Mode",
    packaged: "Installed build",
    devRuntime: "Dev runtime",
    noSource: "Not configured",
    noUpdate: "No newer build is available.",
    notChecked: "Updates have not been checked.",
    unavailable: "Updates are only available in the Electron desktop app.",
    checkFailed: "Unable to check for updates.",
    installUnavailable: "Updates are only available in the Electron desktop app.",
    installing: "Downloading {tag}...",
    installStarted: "Update started. The app will close; reopen it after the installer finishes.",
    installFailed: "Unable to install update.",
    updateDisabledInDev: "Installing updates is only available in packaged builds."
  }
} as const;

type UpdateCopy = { [Key in keyof (typeof copy)["vi"]]: string };

export function UpdatePanel({ mode = "settings", autoCheck = mode === "settings" }: { mode?: UpdatePanelMode; autoCheck?: boolean }) {
  const { locale } = useI18n();
  const text: UpdateCopy = copy[locale];
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [isChecking, setIsChecking] = useState(autoCheck);
  const [installingTag, setInstallingTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLoginMode = mode === "login";

  const releases = useMemo(() => state?.releases ?? [], [state?.releases]);

  const checkUpdates = useCallback(async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp?.updates) {
      setState(null);
      setError(text.unavailable);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      const result = await desktopApp.updates.check();
      setState(result);
      if (!result.success) {
        setError(result.message);
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : text.checkFailed);
    } finally {
      setIsChecking(false);
    }
  }, [text.checkFailed, text.unavailable]);

  useEffect(() => {
    if (autoCheck) {
      void checkUpdates();
    }
  }, [autoCheck, checkUpdates]);

  const installUpdate = async (release: DesktopUpdateRelease) => {
    const desktopApp = getDesktopApp();
    if (!desktopApp?.updates) {
      toast.error(text.installUnavailable);
      return;
    }

    setInstallingTag(release.tagName);
    const toastId = toast.loading(text.installing.replace("{tag}", release.tagName));
    try {
      const result = await desktopApp.updates.install(release.tagName);
      if (!result.success) {
        throw new Error(result.message);
      }
      toast.success(text.installStarted, { id: toastId });
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : text.installFailed, { id: toastId });
    } finally {
      setInstallingTag(null);
    }
  };

  return (
    <Card className={cn("w-full", isLoginMode ? "border-dashed" : "")}>
      <CardHeader className={cn(isLoginMode ? "p-4 pb-3" : undefined)}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className={cn("truncate", isLoginMode ? "text-base" : undefined)}>{isLoginMode ? text.loginTitle : text.title}</CardTitle>
            <CardDescription>{isLoginMode ? text.loginDesc : text.desc}</CardDescription>
          </div>
          <Button type="button" variant="outline" size={isLoginMode ? "sm" : "default"} onClick={() => void checkUpdates()} disabled={isChecking}>
            {isChecking ? <Activity className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            {isChecking ? text.checking : text.check}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-3", isLoginMode ? "p-4 pt-0" : "space-y-4")}>
        {isLoginMode ? <LoginUpdateSummary state={state} isChecking={isChecking} text={text} /> : <SettingsUpdateSummary state={state} text={text} />}

        {error ? (
          <div className="flex min-w-0 gap-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}

        {!isChecking && !error && state && releases.length === 0 ? (
          <div className="rounded-md border p-3 text-sm text-muted-foreground">{text.noUpdate}</div>
        ) : null}

        {releases.length ? (
          <div className={cn("space-y-3", isLoginMode ? "max-h-56 overflow-y-auto pr-1" : "")}>
            {releases.map((release) => (
              <UpdateReleaseRow
                key={release.tagName}
                release={release}
                locale={locale}
                canInstall={Boolean(state?.packaged)}
                installingTag={installingTag}
                text={text}
                compact={isLoginMode}
                onInstall={installUpdate}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LoginUpdateSummary({ state, isChecking, text }: { state: DesktopUpdateState | null; isChecking: boolean; text: UpdateCopy }) {
  if (isChecking) {
    return <div className="rounded-md border p-3 text-sm text-muted-foreground">{text.checking}</div>;
  }

  if (!state) {
    return <div className="rounded-md border p-3 text-sm text-muted-foreground">{text.notChecked}</div>;
  }

  return (
    <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
      <StatusCell label={text.currentVersion} value={state.currentVersion} />
      <StatusCell label={text.mode} value={state.packaged ? text.packaged : text.devRuntime} />
    </div>
  );
}

function SettingsUpdateSummary({ state, text }: { state: DesktopUpdateState | null; text: UpdateCopy }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      <StatusCell label={text.currentVersion} value={state?.currentVersion ?? text.checking} />
      <StatusCell label={text.source} value={state?.repository || text.noSource} />
      <StatusCell label={text.mode} value={state?.packaged ? text.packaged : text.devRuntime} />
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function UpdateReleaseRow({
  release,
  locale,
  canInstall,
  installingTag,
  text,
  compact,
  onInstall
}: {
  release: DesktopUpdateRelease;
  locale: "vi" | "en";
  canInstall: boolean;
  installingTag: string | null;
  text: UpdateCopy;
  compact: boolean;
  onInstall: (release: DesktopUpdateRelease) => Promise<void>;
}) {
  return (
    <div className={cn("grid min-w-0 gap-3 rounded-md border p-3", compact ? "" : "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center")}>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{release.name}</p>
          <span className="rounded-sm border px-2 py-0.5 text-xs text-muted-foreground">{release.tagName}</span>
          {release.prerelease ? <span className="rounded-sm border border-amber-500/40 px-2 py-0.5 text-xs">{text.preRelease}</span> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {release.assetName} | {formatFileSize(release.assetSize)}
          {release.publishedAt ? ` | ${formatAppDateTime(release.publishedAt, locale)}` : ""}
        </p>
      </div>
      <div className="flex min-w-0 gap-2 sm:justify-end">
        <a href={release.url} target="_blank" rel="noreferrer">
          <Button type="button" variant="outline" size="sm">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {text.release}
          </Button>
        </a>
        <Button type="button" size="sm" onClick={() => void onInstall(release)} disabled={!canInstall || installingTag !== null} title={canInstall ? undefined : text.updateDisabledInDev}>
          {installingTag === release.tagName ? <Activity className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {text.update}
        </Button>
      </div>
    </div>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 MB";
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
