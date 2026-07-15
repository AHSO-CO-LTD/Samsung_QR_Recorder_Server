"use client";

import { useEffect, useState } from "react";
import { Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDesktopApp } from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";

export function DesktopCloseRequestDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);

  useEffect(() => {
    const desktopApp = getDesktopApp();
    if (!desktopApp?.onCloseRequest) {
      return;
    }

    return desktopApp.onCloseRequest(() => setOpen(true));
  }, []);

  const quitApp = async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp) {
      toast.warning(t("desktopActionUnavailable"));
      return;
    }

    setIsQuitting(true);
    const toastId = toast.loading(t("exitAppLoading"));
    try {
      await desktopApp.quit();
      toast.success(t("exitAppSent"), { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("desktopActionFailed");
      toast.error(message, { id: toastId });
      setIsQuitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isQuitting && setOpen(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <Power className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>{t("confirmExitTitle")}</DialogTitle>
          <DialogDescription>{t("confirmExitDesc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isQuitting}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void quitApp()} disabled={isQuitting}>
            <Power className="h-4 w-4" aria-hidden="true" />
            {t("exitApp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
