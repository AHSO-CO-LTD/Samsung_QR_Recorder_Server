"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadGuideCatalog, type InAppGuide } from "@/features/guides/guide-catalog";
import { GuideSlidePanel } from "@/features/guides/guide-slide-panel";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

const copy = {
  vi: {
    title: "Hướng dẫn sử dụng",
    description: "Chọn hướng dẫn phù hợp với màn hình hiện tại.",
    loading: "Đang tải nội dung hướng dẫn...",
    loadFailed: "Không tải được nội dung hướng dẫn.",
    retry: "Tải lại",
    empty: "Chưa có hướng dẫn cho màn hình này.",
    steps: "{count} bước",
    previous: "Trước",
    next: "Tiếp",
    finish: "Hoàn tất",
    completed: "Đã hoàn tất hướng dẫn.",
    imageLoadFailed: "Không tải được ảnh hướng dẫn",
    slidePicker: "Chọn bước hướng dẫn"
  },
  en: {
    title: "User guide",
    description: "Choose a guide for the current screen.",
    loading: "Loading guide content...",
    loadFailed: "Unable to load guide content.",
    retry: "Retry",
    empty: "No guide is available for this screen.",
    steps: "{count} steps",
    previous: "Previous",
    next: "Next",
    finish: "Finish",
    completed: "Guide completed.",
    imageLoadFailed: "Unable to load the guide image",
    slidePicker: "Choose a guide step"
  }
} as const;

export function GuideDialog({
  open,
  guideIds,
  onOpenChange
}: {
  open: boolean;
  guideIds: readonly string[];
  onOpenChange: (open: boolean) => void;
}) {
  const { locale } = useI18n();
  const text = copy[locale];
  const [catalog, setCatalog] = useState<InAppGuide[]>([]);
  const [selectedGuideId, setSelectedGuideId] = useState(guideIds[0] ?? "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadId, setReloadId] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    void loadGuideCatalog(controller.signal)
      .then(setCatalog)
      .catch((currentError) => {
        if (currentError instanceof DOMException && currentError.name === "AbortError") {
          return;
        }
        const message = currentError instanceof Error ? currentError.message : text.loadFailed;
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [open, reloadId, text.loadFailed]);

  const guides = useMemo(
    () => guideIds.map((id) => catalog.find((guide) => guide.id === id)).filter((guide): guide is InAppGuide => Boolean(guide)),
    [catalog, guideIds]
  );
  const selectedGuide = guides.find((guide) => guide.id === selectedGuideId) ?? guides[0] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedGuideId(guideIds[0] ?? "");
    setCurrentIndex(0);
  }, [guideIds, open]);

  useEffect(() => {
    if (selectedGuide && currentIndex >= selectedGuide.slides.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, selectedGuide]);

  const selectGuide = (guideId: string) => {
    setSelectedGuideId(guideId);
    setCurrentIndex(0);
  };

  const completeGuide = () => {
    onOpenChange(false);
    toast.success(text.completed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(90dvh,54rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3 pr-12 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpenCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <DialogTitle className="truncate">{text.title}</DialogTitle>
          </div>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>

        {isLoading ? <GuideLoadingState label={text.loading} /> : null}

        {!isLoading && error ? (
          <div className="flex min-h-0 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-lg text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={() => setReloadId((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {text.retry}
            </Button>
          </div>
        ) : null}

        {!isLoading && !error && guides.length === 0 ? (
          <div className="flex min-h-0 items-center justify-center p-6 text-center text-sm text-muted-foreground">{text.empty}</div>
        ) : null}

        {!isLoading && !error && selectedGuide ? (
          <div
            className={cn(
              "grid min-h-0",
              guides.length > 1
                ? "grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1"
                : "grid-rows-1"
            )}
          >
            {guides.length > 1 ? (
              <aside className="min-h-0 overflow-y-auto border-b bg-muted/20 p-3 lg:border-b-0 lg:border-r" aria-label={text.title}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {guides.map((guide) => (
                    <button
                      key={guide.id}
                      type="button"
                      className={cn(
                        "min-w-0 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        guide.id === selectedGuide.id ? "border-primary bg-primary/10" : "bg-background hover:bg-muted"
                      )}
                      aria-pressed={guide.id === selectedGuide.id}
                      onClick={() => selectGuide(guide.id)}
                    >
                      <span className="block truncate text-sm font-semibold">{guide.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{text.steps.replace("{count}", String(guide.slides.length))}</span>
                    </button>
                  ))}
                </div>
              </aside>
            ) : null}

            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{selectedGuide.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedGuide.description}</p>
                </div>
                <Badge variant="secondary" className="w-fit shrink-0">
                  {text.steps.replace("{count}", String(selectedGuide.slides.length))}
                </Badge>
              </div>

              <GuideSlidePanel
                guide={selectedGuide}
                currentIndex={currentIndex}
                copy={text}
                onIndexChange={setCurrentIndex}
                onComplete={completeGuide}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GuideLoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-0 gap-4 p-4 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-label={label}>
      <div className="hidden rounded-md border bg-muted/30 lg:block" />
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
        <div className="h-12 animate-pulse rounded-md bg-muted" />
        <div className="min-h-64 animate-pulse rounded-md bg-muted" />
        <div className="h-12 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
