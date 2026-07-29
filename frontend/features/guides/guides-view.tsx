"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, ChevronRight, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideDialog } from "@/features/guides/guide-dialog";
import { loadGuideCatalog, type InAppGuide } from "@/features/guides/guide-catalog";
import { GuideManualPdfExport } from "@/features/guides/guide-manual-pdf-export";
import { useI18n } from "@/lib/i18n-provider";

const copy = {
  vi: {
    title: "Hướng dẫn sử dụng",
    description: "Tra cứu toàn bộ quy trình thao tác và mở hướng dẫn chi tiết cho từng chức năng.",
    searchLabel: "Tìm hướng dẫn",
    searchPlaceholder: "Tìm theo tên, nội dung hoặc thao tác...",
    guideCount: "{count} hướng dẫn",
    stepCount: "{count} bước",
    loading: "Đang tải danh sách hướng dẫn...",
    loadFailed: "Không tải được danh sách hướng dẫn.",
    retry: "Tải lại",
    empty: "Chưa có nội dung hướng dẫn.",
    noResults: "Không tìm thấy hướng dẫn phù hợp.",
    openGuide: "Mở hướng dẫn {title}",
    exportButton: "Xuất PDF",
    exporting: "Đang tạo PDF...",
    exportSuccess: "Đã xuất file hướng dẫn PDF.",
    exportCancelled: "Đã hủy xuất PDF.",
    exportFailed: "Không thể xuất file hướng dẫn PDF.",
    exportImageLoadFailed: "Không tải được đầy đủ ảnh hướng dẫn để xuất PDF.",
    browserDownloadFallback: "Trình duyệt không hỗ trợ chọn thư mục. File PDF đã được tải xuống thư mục mặc định.",
    manualTitle: "Hướng dẫn sử dụng",
    manualDescription: "Tài liệu thao tác tổng hợp cho ứng dụng QR Recorder Server.",
    tableOfContents: "Mục lục",
    stepLabel: "Bước {current}/{total}",
    groups: [
      { id: "getting-started", title: "Bắt đầu sử dụng", description: "Đăng nhập, điều hướng và đọc màn hình tổng quan.", from: 1, to: 4 },
      { id: "monitoring", title: "Giám sát vận hành", description: "Theo dõi phiên chạy, máy và lịch sử hoạt động.", from: 5, to: 8 },
      { id: "operation", title: "Nghiệp vụ sản xuất", description: "Quản lý mã, dữ liệu quét, báo cáo và đồng bộ.", from: 9, to: 15 },
      { id: "system", title: "Quản trị hệ thống", description: "Người dùng, thông báo, nhật ký và cài đặt.", from: 16, to: 19 }
    ]
  },
  en: {
    title: "User guides",
    description: "Browse every operating procedure and open detailed instructions for each feature.",
    searchLabel: "Search guides",
    searchPlaceholder: "Search by name, content, or action...",
    guideCount: "{count} guides",
    stepCount: "{count} steps",
    loading: "Loading guides...",
    loadFailed: "Unable to load the guide catalog.",
    retry: "Retry",
    empty: "No guide content is available.",
    noResults: "No matching guide was found.",
    openGuide: "Open {title}",
    exportButton: "Export PDF",
    exporting: "Creating PDF...",
    exportSuccess: "The PDF manual was exported.",
    exportCancelled: "PDF export was cancelled.",
    exportFailed: "Unable to export the PDF manual.",
    exportImageLoadFailed: "Not all guide images could be loaded for PDF export.",
    browserDownloadFallback: "This browser cannot choose a folder. The PDF was saved to the default download folder.",
    manualTitle: "User manual",
    manualDescription: "Combined operating instructions for QR Recorder Server.",
    tableOfContents: "Table of contents",
    stepLabel: "Step {current}/{total}",
    groups: [
      { id: "getting-started", title: "Getting started", description: "Sign in, navigate, and read the overview screen.", from: 1, to: 4 },
      { id: "monitoring", title: "Operation monitoring", description: "Monitor runtime sessions, machines, and activity history.", from: 5, to: 8 },
      { id: "operation", title: "Production workflows", description: "Manage codes, scans, reports, and synchronization.", from: 9, to: 15 },
      { id: "system", title: "System administration", description: "Users, notifications, audit logs, and settings.", from: 16, to: 19 }
    ]
  }
} as const;

export function GuidesView() {
  const { locale } = useI18n();
  const text = copy[locale];
  const [catalog, setCatalog] = useState<InAppGuide[]>([]);
  const [query, setQuery] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadId, setReloadId] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void loadGuideCatalog(controller.signal)
      .then(setCatalog)
      .catch((currentError) => {
        if (currentError instanceof DOMException && currentError.name === "AbortError") {
          return;
        }
        setError(text.loadFailed);
        toast.error(text.loadFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadId, text.loadFailed]);

  const normalizedQuery = query.trim().toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
  const filteredGuides = useMemo(() => {
    if (!normalizedQuery) {
      return catalog;
    }

    return catalog.filter((guide) => {
      const searchableText = [guide.title, guide.description, ...guide.slides.flatMap((slide) => [slide.title, slide.content])]
        .join(" ")
        .toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
      return searchableText.includes(normalizedQuery);
    });
  }, [catalog, locale, normalizedQuery]);

  const guideGroups = useMemo(
    () =>
      text.groups
        .map((group) => ({
          ...group,
          guides: filteredGuides.filter((guide) => guide.order >= group.from && guide.order <= group.to)
        }))
        .filter((group) => group.guides.length > 0),
    [filteredGuides, text.groups]
  );
  const manualGroups = useMemo(
    () => {
      const numberedGuides = catalog.map((guide, index) => ({
        ...guide,
        manualOrder: index + 1
      }));

      return text.groups
        .map((group) => ({
          ...group,
          guides: numberedGuides.filter((guide) => guide.order >= group.from && guide.order <= group.to)
        }))
        .filter((group) => group.guides.length > 0);
    },
    [catalog, text.groups]
  );

  const totalSteps = catalog.reduce((total, guide) => total + guide.slides.length, 0);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4" aria-labelledby="guides-title">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 id="guides-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
            {text.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p>
        </div>
        {!isLoading && !error ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <GuideManualPdfExport
              groups={manualGroups}
              guideCount={catalog.length}
              stepCount={totalSteps}
              locale={locale}
              copy={text}
            />
            <Badge variant="secondary">{text.guideCount.replace("{count}", String(catalog.length))}</Badge>
            <Badge variant="outline">{text.stepCount.replace("{count}", String(totalSteps))}</Badge>
          </div>
        ) : null}
      </header>

      <div className="relative max-w-xl">
        <label htmlFor="guide-search" className="sr-only">
          {text.searchLabel}
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="guide-search"
          type="search"
          value={query}
          className="pl-9"
          placeholder={text.searchPlaceholder}
          disabled={isLoading || Boolean(error)}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading ? <GuideCatalogLoading label={text.loading} /> : null}

      {!isLoading && error ? (
        <GuideCatalogState
          message={error}
          action={
            <Button type="button" variant="outline" onClick={() => setReloadId((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {text.retry}
            </Button>
          }
        />
      ) : null}

      {!isLoading && !error && catalog.length === 0 ? <GuideCatalogState message={text.empty} /> : null}
      {!isLoading && !error && catalog.length > 0 && guideGroups.length === 0 ? <GuideCatalogState message={text.noResults} /> : null}

      {!isLoading && !error && guideGroups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {guideGroups.map((group) => (
            <section key={group.id} className="overflow-hidden rounded-md border bg-card" aria-labelledby={`guide-group-${group.id}`}>
              <header className="border-b bg-muted/25 px-4 py-3">
                <h2 id={`guide-group-${group.id}`} className="text-sm font-semibold">
                  {group.title}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{group.description}</p>
              </header>
              <div className="divide-y">
                {group.guides.map((guide) => (
                  <button
                    key={guide.id}
                    type="button"
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring active:bg-muted/60"
                    aria-label={text.openGuide.replace("{title}", guide.title)}
                    onClick={() => setSelectedGuideId(guide.id)}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-primary">
                      <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{guide.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{guide.description}</span>
                      <span className="mt-1 block text-xs font-medium text-muted-foreground">
                        {text.stepCount.replace("{count}", String(guide.slides.length))}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <GuideDialog
        open={Boolean(selectedGuideId)}
        guideIds={selectedGuideId ? [selectedGuideId] : []}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedGuideId(null);
          }
        }}
      />
    </section>
  );
}

function GuideCatalogLoading({ label }: { label: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-label={label} aria-busy="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="overflow-hidden rounded-md border bg-card">
          <div className="h-16 animate-pulse border-b bg-muted/50" />
          <div className="space-y-px bg-border">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex h-20 items-center gap-3 bg-card px-4">
                <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 animate-pulse rounded-sm bg-muted" />
                  <div className="h-3 w-4/5 animate-pulse rounded-sm bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GuideCatalogState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-md border bg-card p-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
