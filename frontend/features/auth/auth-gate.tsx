"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { FirstAdminSetupScreen } from "@/features/auth/first-admin-setup-screen";
import { LoginScreen } from "@/features/auth/login-screen";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";

type SetupStatus = {
  initialized: boolean;
  requiresAdminSetup: boolean;
  userCount: number;
  adminCount: number;
  devSupportReady: boolean;
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isBooting } = useAuth();
  const { t } = useI18n();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  const loadSetupStatus = useCallback(async () => {
    setIsCheckingSetup(true);
    setSetupError(null);
    try {
      const result = await apiGet<SetupStatus>("/setup/status");
      setSetupStatus(result.data ?? null);
    } catch (currentError) {
      setSetupError(currentError instanceof Error ? currentError.message : "Không kiểm tra được trạng thái setup.");
    } finally {
      setIsCheckingSetup(false);
    }
  }, []);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  if (isBooting || isCheckingSetup) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-3 py-4 sm:px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <Activity className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold">{t("authChecking")}</p>
              <InfoTooltip content={t("authCheckingDesc")} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (setupError) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-3 py-4 sm:px-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/40 bg-card p-5 text-card-foreground">
          <div>
            <p className="text-sm font-semibold text-destructive">Không kiểm tra được setup</p>
            <p className="mt-2 text-sm text-muted-foreground">{setupError}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadSetupStatus()}>
            {t("retry")}
          </Button>
        </div>
      </main>
    );
  }

  if (setupStatus?.requiresAdminSetup) {
    return <FirstAdminSetupScreen onCreated={() => void loadSetupStatus()} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return children;
}
