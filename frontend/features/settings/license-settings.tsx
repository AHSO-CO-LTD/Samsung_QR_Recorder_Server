"use client";

import { useCallback, useEffect, useState } from "react";
import { LicenseActivationPanel } from "@/features/license/license-activation-panel";
import { getLicenseCopy } from "@/features/license/license-copy";
import { getDesktopApp, type DesktopLicenseStatus } from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";

export function LicenseSettings() {
  const { locale } = useI18n();
  const copy = getLicenseCopy(locale);
  const [status, setStatus] = useState<DesktopLicenseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp?.license) {
      setStatus(null);
      setError(copy.unavailable);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setStatus(await desktopApp.license.getStatus());
    } catch (currentError) {
      setStatus(null);
      setError(currentError instanceof Error ? currentError.message : copy.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [copy.loadFailed, copy.unavailable]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <LicenseActivationPanel
      mode="settings"
      status={status}
      isLoading={isLoading}
      error={error}
      onRefresh={() => void loadStatus()}
      onActivated={(nextStatus) => {
        setStatus(nextStatus);
        setError(null);
      }}
    />
  );
}
