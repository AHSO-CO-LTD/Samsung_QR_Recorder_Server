"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Download, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UpdateRelease = {
  version: string;
  tagName: string;
  name: string;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
  assetName: string;
  assetSize: number;
};

type UpdateState = {
  success: boolean;
  currentVersion: string;
  repository: string;
  packaged: boolean;
  releases: UpdateRelease[];
  message: string;
};

export function UpdateSettings() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [installingTag, setInstallingTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkUpdates = useCallback(async () => {
    if (!window.serverApp?.updates) {
      setState(null);
      setError("Chức năng cập nhật chỉ hoạt động trong Electron desktop.");
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      const result = await window.serverApp.updates.check();
      setState(result);
      if (!result.success) {
        setError(result.message);
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Không kiểm tra được bản cập nhật.");
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkUpdates();
  }, [checkUpdates]);

  const installUpdate = async (release: UpdateRelease) => {
    if (!window.serverApp?.updates) {
      toast.error("Chức năng cập nhật chỉ hoạt động trong Electron desktop.");
      return;
    }

    setInstallingTag(release.tagName);
    const toastId = toast.loading(`Đang tải ${release.tagName}...`);
    try {
      await window.serverApp.updates.install(release.tagName);
      toast.success("Đã mở bộ cài cập nhật. App sẽ đóng để tiếp tục.", { id: toastId });
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : "Không cài được bản cập nhật.", { id: toastId });
    } finally {
      setInstallingTag(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>Cập nhật ứng dụng</CardTitle>
            <CardDescription>Kiểm tra GitHub Releases và chỉ cho phép cài bản mới hơn bản hiện tại.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void checkUpdates()} disabled={isChecking}>
            {isChecking ? <Activity className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Kiểm tra
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <StatusCell label="Phiên bản hiện tại" value={state?.currentVersion ?? "Đang kiểm tra"} />
          <StatusCell label="Nguồn cập nhật" value={state?.repository || "Chưa cấu hình"} />
          <StatusCell label="Chế độ" value={state?.packaged ? "Bản cài đặt" : "Dev runtime"} />
        </div>

        {isChecking ? <div className="rounded-md border p-4 text-sm text-muted-foreground">Đang kiểm tra bản cập nhật...</div> : null}

        {error ? (
          <div className="flex min-w-0 gap-3 rounded-md border border-destructive/40 p-4 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}

        {!isChecking && !error && state?.releases.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Chưa có bản mới hơn bản hiện tại.</div>
        ) : null}

        {state?.releases.length ? (
          <div className="space-y-3">
            {state.releases.map((release) => (
              <div key={release.tagName} className="grid min-w-0 gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{release.name}</p>
                    <span className="rounded-sm border px-2 py-0.5 text-xs text-muted-foreground">{release.tagName}</span>
                    {release.prerelease ? <span className="rounded-sm border border-amber-500/40 px-2 py-0.5 text-xs">Pre-release</span> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {release.assetName} · {formatFileSize(release.assetSize)}
                    {release.publishedAt ? ` · ${new Date(release.publishedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex min-w-0 gap-2 sm:justify-end">
                  <a href={release.url} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Release
                    </Button>
                  </a>
                  <Button type="button" size="sm" onClick={() => void installUpdate(release)} disabled={!state.packaged || installingTag !== null}>
                    {installingTag === release.tagName ? <Activity className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    Update
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
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

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 MB";
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
