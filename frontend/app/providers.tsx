"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/features/auth/auth-gate";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n-provider";
import { ThemeProvider } from "@/lib/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <TooltipProvider delayDuration={250}>
          <AuthProvider>
            <AuthGate>{children}</AuthGate>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
      <Toaster richColors position="top-right" closeButton />
    </I18nProvider>
  );
}
