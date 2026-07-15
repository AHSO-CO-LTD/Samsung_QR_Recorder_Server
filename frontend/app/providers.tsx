"use client";

import { Toaster } from "sonner";
import { DesktopCloseRequestDialog } from "@/components/layout/desktop-close-request-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/features/auth/auth-gate";
import { LicenseGate } from "@/features/license/license-gate";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n-provider";
import { PermissionsProvider } from "@/lib/permissions";
import { ThemeProvider } from "@/lib/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <TooltipProvider delayDuration={250}>
          <DesktopCloseRequestDialog />
          <LicenseGate>
            <AuthProvider>
              <PermissionsProvider>
                <AuthGate>{children}</AuthGate>
              </PermissionsProvider>
            </AuthProvider>
          </LicenseGate>
        </TooltipProvider>
      </ThemeProvider>
      <Toaster richColors position="top-right" closeButton />
    </I18nProvider>
  );
}
