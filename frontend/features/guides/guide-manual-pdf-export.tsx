"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { InAppGuide } from "@/features/guides/guide-catalog";
import { pairItems } from "@/features/guides/guide-manual-layout";
import { toAppDateInput } from "@/lib/app-time";
import { getDesktopApp } from "@/lib/desktop-app";

export type GuideManualGroup = {
  id: string;
  title: string;
  description: string;
  guides: GuideManualGuide[];
};

export type GuideManualGuide = InAppGuide & {
  manualOrder: number;
};

export type GuideManualPdfCopy = {
  exportButton: string;
  exporting: string;
  exportSuccess: string;
  exportCancelled: string;
  exportFailed: string;
  exportImageLoadFailed: string;
  browserDownloadFallback: string;
  manualTitle: string;
  manualDescription: string;
  tableOfContents: string;
  guideCount: string;
  stepCount: string;
  stepLabel: string;
};

export function GuideManualPdfExport({
  groups,
  guideCount,
  stepCount,
  locale,
  copy
}: {
  groups: GuideManualGroup[];
  guideCount: number;
  stepCount: number;
  locale: "vi" | "en";
  copy: GuideManualPdfCopy;
}) {
  const printDocumentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async () => {
    if (isExporting || guideCount === 0) {
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading(copy.exporting);
    const originalDocumentTitle = document.title;
    document.title = copy.manualTitle;

    try {
      const desktopApp = getDesktopApp();

      if (desktopApp?.guides?.exportPdf) {
        await waitForRender();
        const printDocument = printDocumentRef.current;
        if (!printDocument) {
          throw new Error(copy.exportFailed);
        }

        await waitForPrintableAssets(printDocument, copy.exportImageLoadFailed);
        const result = await desktopApp.guides.exportPdf({
          defaultFileName: buildManualFileName(locale)
        });

        if (result.canceled) {
          toast.info(copy.exportCancelled, { id: toastId });
          return;
        }
        if (!result.success) {
          throw new Error(copy.exportFailed);
        }

        toast.success(copy.exportSuccess, { id: toastId });
        return;
      }

      const { exportGuideManualPdfInBrowser } = await import("@/features/guides/guide-manual-browser-pdf");
      const result = await exportGuideManualPdfInBrowser({
        groups,
        guideCount,
        stepCount,
        fileName: buildManualFileName(locale),
        copy
      });

      if (result === "downloaded") {
        toast.info(copy.browserDownloadFallback, { id: toastId });
        return;
      }

      toast.success(copy.exportSuccess, { id: toastId });
    } catch (error) {
      if (isAbortError(error)) {
        toast.info(copy.exportCancelled, { id: toastId });
        return;
      }
      toast.error(error instanceof Error ? error.message : copy.exportFailed, { id: toastId });
    } finally {
      document.title = originalDocumentTitle;
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" disabled={isExporting || guideCount === 0} onClick={exportPdf}>
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {isExporting ? copy.exporting : copy.exportButton}
      </Button>

      {isExporting ? (
        <GuideManualPrintDocument
          documentRef={printDocumentRef}
          groups={groups}
          guideCount={guideCount}
          stepCount={stepCount}
          locale={locale}
          copy={copy}
        />
      ) : null}
    </>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function GuideManualPrintDocument({
  documentRef,
  groups,
  guideCount,
  stepCount,
  locale,
  copy
}: {
  documentRef: React.Ref<HTMLDivElement>;
  groups: GuideManualGroup[];
  guideCount: number;
  stepCount: number;
  locale: "vi" | "en";
  copy: GuideManualPdfCopy;
}) {
  return (
    <div ref={documentRef} className="guide-manual-print" lang={locale} aria-hidden="true">
      <section className="guide-manual-cover">
        <div className="guide-manual-cover-brand">QR Recorder Server</div>
        <h1>{copy.manualTitle}</h1>
        <p>{copy.manualDescription}</p>
        <div className="guide-manual-summary">
          <span>{copy.guideCount.replace("{count}", String(guideCount))}</span>
          <span>{copy.stepCount.replace("{count}", String(stepCount))}</span>
        </div>

        <div className="guide-manual-toc">
          <h2>{copy.tableOfContents}</h2>
          {groups.map((group) => (
            <section key={group.id}>
              <h3>{group.title}</h3>
              <ol>
                {group.guides.map((guide) => (
                  <li key={guide.id}>
                    <span>{guide.manualOrder.toString().padStart(2, "0")}</span>
                    <span>{guide.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="guide-manual-group">
          <header className="guide-manual-group-cover">
            <span>{group.guides[0]?.manualOrder.toString().padStart(2, "0") ?? ""}</span>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <strong>{copy.guideCount.replace("{count}", String(group.guides.length))}</strong>
          </header>

          {group.guides.flatMap((guide) =>
            pairItems(guide.slides).map((slides, pairIndex) => (
              <section key={`${guide.id}-page-${pairIndex}`} className="guide-manual-step-page">
                <header>
                  <div className="guide-manual-step-context">
                    <span>{group.title}</span>
                    <span>
                      {guide.manualOrder.toString().padStart(2, "0")}. {guide.title}
                    </span>
                  </div>
                  <h2>{guide.title}</h2>
                  {pairIndex === 0 && guide.description ? <p>{guide.description}</p> : null}
                </header>

                <div className={`guide-manual-step-list${slides.length === 1 ? " is-single" : ""}`}>
                  {slides.map((slide, slideOffset) => {
                    const slideIndex = pairIndex * 2 + slideOffset;
                    return (
                      <article key={`${guide.id}-${slide.order}`} className="guide-manual-step">
                        <div className="guide-manual-step-number">
                          {copy.stepLabel.replace("{current}", String(slideIndex + 1)).replace("{total}", String(guide.slides.length))}
                        </div>
                        <h3>{slide.title}</h3>

                        {slide.src ? <img src={slide.src} alt="" loading="eager" /> : null}
                        <p className="guide-manual-step-content">{slide.content}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function buildManualFileName(locale: "vi" | "en") {
  const date = toAppDateInput(new Date());
  return locale === "vi" ? `huong-dan-su-dung-qr-recorder-${date}.pdf` : `qr-recorder-user-manual-${date}.pdf`;
}

async function waitForRender() {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForPrintableAssets(container: HTMLElement, imageLoadFailedMessage: string) {
  await document.fonts.ready;
  const images = Array.from(container.querySelectorAll("img"));

  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => reject(new Error(imageLoadFailedMessage)), { once: true });
        });
      }

      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error(imageLoadFailedMessage);
      }

      await image.decode();
    })
  );
}
