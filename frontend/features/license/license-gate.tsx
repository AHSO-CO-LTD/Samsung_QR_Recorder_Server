"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Languages } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getDesktopApp, type DesktopLicenseStatus } from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";
import { LicenseActivationPanel } from "./license-activation-panel";
import { getLicenseCopy } from "./license-copy";

const LICENSE_RECHECK_INTERVAL_MS = 60_000;

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useI18n();
  const copy = getLicenseCopy(locale);
  const [status, setStatus] = useState<DesktopLicenseStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wasActiveRef = useRef(false);

  const loadStatus = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const desktopApp = getDesktopApp();
      if (!desktopApp?.license) {
        if (!options.silent) {
          setIsChecking(false);
        }
        setStatus(null);
        setError(copy.unavailable);
        if (wasActiveRef.current) {
          toast.error(copy.returnedToActivation);
        }
        wasActiveRef.current = false;
        return;
      }

      if (!options.silent) {
        setIsChecking(true);
      }

      try {
        const nextStatus = await desktopApp.license.getStatus();
        setStatus(nextStatus);
        setError(null);

        if (wasActiveRef.current && !nextStatus.ok) {
          toast.error(copy.returnedToActivation);
        }
        wasActiveRef.current = nextStatus.ok;
      } catch (currentError) {
        setStatus(null);
        setError(currentError instanceof Error ? currentError.message : copy.loadFailed);
        if (wasActiveRef.current) {
          toast.error(copy.returnedToActivation);
        }
        wasActiveRef.current = false;
      } finally {
        if (!options.silent) {
          setIsChecking(false);
        }
      }
    },
    [copy.loadFailed, copy.returnedToActivation, copy.unavailable]
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const applyLocale = (nextLocale: "vi" | "en") => {
    if (nextLocale === locale) {
      return;
    }

    setLocale(nextLocale);
    toast.success(nextLocale === "vi" ? t("vietnamese") : t("english"));
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadStatus({ silent: true });
    }, LICENSE_RECHECK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadStatus]);

  useEffect(() => {
    const onFocus = () => void loadStatus({ silent: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadStatus({ silent: true });
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadStatus]);

  if (isChecking && !status && !error) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-3 py-4 sm:px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <Activity className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold">{copy.checkingTitle}</p>
              <InfoTooltip content={copy.checkingDesc} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!status?.ok || error) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-3 py-6 sm:px-4 lg:py-8">
        <section className="flex w-full max-w-3xl flex-col items-center gap-4">
          <div className="flex w-full min-w-0 flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex max-w-full min-w-0 items-center gap-3">
              <AppLogo />
              <h1 className="max-w-full truncate text-center text-2xl font-semibold tracking-normal sm:text-left">{t("appName")}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-md border bg-card p-1">
              <Languages className="ml-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Button
                type="button"
                size="sm"
                variant={locale === "vi" ? "default" : "ghost"}
                className="h-8 px-3 text-xs"
                onClick={() => applyLocale("vi")}
                aria-pressed={locale === "vi"}
              >
                Tiếng Việt
              </Button>
              <Button
                type="button"
                size="sm"
                variant={locale === "en" ? "default" : "ghost"}
                className="h-8 px-3 text-xs"
                onClick={() => applyLocale("en")}
                aria-pressed={locale === "en"}
              >
                English
              </Button>
            </div>
          </div>
          <LicenseActivationPanel
            mode="gate"
            status={status}
            isLoading={isChecking}
            error={error}
            onRefresh={() => void loadStatus()}
            onActivated={(nextStatus) => {
              setStatus(nextStatus);
              setError(null);
              wasActiveRef.current = nextStatus.ok;
            }}
          />
        </section>
      </main>
    );
  }

  return children;
}
