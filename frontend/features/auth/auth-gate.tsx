"use client";

import { Activity } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { LoginScreen } from "@/features/auth/login-screen";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isBooting } = useAuth();
  const { t } = useI18n();

  if (isBooting) {
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

  if (!user) {
    return <LoginScreen />;
  }

  return children;
}
