"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadGuideCatalog } from "@/features/guides/guide-catalog";
import { GuideDialog } from "@/features/guides/guide-dialog";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

type GuideLauncherProps = {
  guideIds: readonly string[];
  mode?: "page" | "login";
  className?: string;
};

export function GuideLauncher({ guideIds, mode = "page", className }: GuideLauncherProps) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [availableGuideIds, setAvailableGuideIds] = useState<readonly string[]>([]);
  const [catalogLoadFailed, setCatalogLoadFailed] = useState(false);
  const guideIdsKey = guideIds.join("|");
  const requestedGuideIds = useMemo(() => (guideIdsKey ? guideIdsKey.split("|") : []), [guideIdsKey]);
  const isLoginMode = mode === "login";
  const label = isLoginMode
    ? locale === "vi"
      ? "Hướng dẫn đăng nhập"
      : "Login guide"
    : locale === "vi"
      ? "Hướng dẫn trang này"
      : "Page guide";

  useEffect(() => {
    if (requestedGuideIds.length === 0) {
      setAvailableGuideIds([]);
      setCatalogLoadFailed(false);
      return;
    }

    const controller = new AbortController();
    setAvailableGuideIds([]);
    setCatalogLoadFailed(false);

    void loadGuideCatalog(controller.signal)
      .then((catalog) => {
        const availableIds = new Set(catalog.map((guide) => guide.id));
        setAvailableGuideIds(requestedGuideIds.filter((guideId) => availableIds.has(guideId)));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setCatalogLoadFailed(true);
      });

    return () => controller.abort();
  }, [requestedGuideIds]);

  const visibleGuideIds = catalogLoadFailed ? requestedGuideIds : availableGuideIds;

  if (visibleGuideIds.length === 0) {
    return null;
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size={isLoginMode ? "default" : "sm"}
      className={cn(isLoginMode && "w-full", className)}
      aria-label={label}
      data-guide-launcher
      onClick={() => setOpen(true)}
    >
      <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );

  return (
    <>
      {trigger}
      <GuideDialog open={open} guideIds={visibleGuideIds} onOpenChange={setOpen} />
    </>
  );
}

export function PageGuideToolbar({ guideIds, className }: { guideIds: readonly string[]; className?: string }) {
  if (guideIds.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex min-w-0 justify-end", className)}>
      <GuideLauncher guideIds={guideIds} />
    </div>
  );
}
