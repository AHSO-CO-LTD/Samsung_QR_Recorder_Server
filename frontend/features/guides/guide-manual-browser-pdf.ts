import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pairItems } from "@/features/guides/guide-manual-layout";
import type { GuideManualGroup, GuideManualPdfCopy } from "@/features/guides/guide-manual-pdf-export";

type BrowserPdfExportOptions = {
  groups: GuideManualGroup[];
  guideCount: number;
  stepCount: number;
  fileName: string;
  copy: GuideManualPdfCopy;
};

type SaveFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SaveFileHandle>;
};

export type BrowserPdfExportResult = "saved" | "downloaded";

export async function exportGuideManualPdfInBrowser({
  groups,
  guideCount,
  stepCount,
  fileName,
  copy
}: BrowserPdfExportOptions): Promise<BrowserPdfExportResult> {
  const pickerWindow = window as SaveFilePickerWindow;
  const fileHandle = pickerWindow.showSaveFilePicker
    ? await pickerWindow.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "PDF",
            accept: { "application/pdf": [".pdf"] }
          }
        ]
      })
    : null;
  const [pdfMakeModule, vfsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);
  const pdfMake = pdfMakeModule.default;
  const vfs = vfsModule.default;

  pdfMake.addVirtualFileSystem(vfs);

  const images = await loadGuideImages(groups, copy.exportImageLoadFailed);
  const documentDefinition = buildDocumentDefinition({
    groups,
    guideCount,
    stepCount,
    copy,
    images
  });
  const pdfBlob = await pdfMake.createPdf(documentDefinition).getBlob();

  if (fileHandle) {
    const writable = await fileHandle.createWritable();

    try {
      await writable.write(pdfBlob);
    } finally {
      await writable.close();
    }

    return "saved";
  }

  downloadBlob(pdfBlob, fileName);
  return "downloaded";
}

function buildDocumentDefinition({
  groups,
  guideCount,
  stepCount,
  copy,
  images
}: Omit<BrowserPdfExportOptions, "fileName"> & { images: Record<string, string> }): TDocumentDefinitions {
  const content: Content[] = [
    {
      text: "QR RECORDER SERVER",
      color: "#1A51DB",
      bold: true,
      fontSize: 12,
      characterSpacing: 1.2,
      margin: [0, 40, 0, 12]
    },
    {
      text: copy.manualTitle,
      bold: true,
      fontSize: 30,
      color: "#111827",
      margin: [0, 0, 0, 12]
    },
    {
      text: copy.manualDescription,
      fontSize: 12,
      lineHeight: 1.35,
      color: "#4B5563",
      margin: [0, 0, 0, 22]
    },
    {
      columns: [
        {
          text: copy.guideCount.replace("{count}", String(guideCount)),
          bold: true,
          color: "#1A51DB",
          fillColor: "#EAF1FF",
          margin: [10, 8, 10, 8]
        },
        {
          text: copy.stepCount.replace("{count}", String(stepCount)),
          bold: true,
          color: "#1A51DB",
          fillColor: "#EAF1FF",
          margin: [10, 8, 10, 8]
        }
      ],
      columnGap: 8,
      margin: [0, 0, 0, 28]
    },
    {
      text: copy.tableOfContents,
      bold: true,
      fontSize: 18,
      color: "#111827",
      margin: [0, 0, 0, 12]
    },
    ...buildTableOfContents(groups)
  ];

  for (const group of groups) {
    content.push({
      text: group.title,
      bold: true,
      fontSize: 26,
      color: "#111827",
      pageBreak: "before",
      margin: [0, 150, 0, 12]
    });
    content.push({
      text: group.description,
      fontSize: 12,
      lineHeight: 1.35,
      color: "#4B5563",
      margin: [0, 0, 0, 18]
    });
    content.push({
      text: copy.guideCount.replace("{count}", String(group.guides.length)),
      bold: true,
      color: "#1A51DB"
    });

    for (const guide of group.guides) {
      pairItems(guide.slides).forEach((slides, pairIndex) => {
        const pageContent: Content[] = [
          {
            text: `${group.title}  /  ${guide.manualOrder.toString().padStart(2, "0")}. ${guide.title}`,
            color: "#6B7280",
            fontSize: 8,
            margin: [0, 0, 0, 8]
          },
          {
            text: guide.title,
            bold: true,
            fontSize: 18,
            color: "#111827",
            margin: [0, 0, 0, 5]
          }
        ];

        if (pairIndex === 0 && guide.description) {
          pageContent.push({
            text: guide.description,
            color: "#4B5563",
            fontSize: 9,
            lineHeight: 1.2,
            margin: [0, 0, 0, 8]
          });
        }

        slides.forEach((slide, slideOffset) => {
          const slideIndex = pairIndex * 2 + slideOffset;
          const imageKey = imageKeyFor(guide.id, slide.order);
          pageContent.push({
            columns: [
              {
                text: copy.stepLabel
                  .replace("{current}", String(slideIndex + 1))
                  .replace("{total}", String(guide.slides.length)),
                bold: true,
                fontSize: 8,
                color: "#FFFFFF",
                fillColor: "#1A51DB",
                margin: [7, 4, 7, 4],
                width: "auto"
              },
              {
                text: slide.title,
                bold: true,
                fontSize: 11,
                color: "#111827",
                margin: [0, 3, 0, 0],
                width: "*"
              }
            ],
            columnGap: 8,
            margin: [0, slideOffset === 0 ? 0 : 10, 0, 6]
          });

          if (slide.src) {
            pageContent.push({
              image: imageKey,
              fit: [520, slides.length === 1 ? 430 : 205],
              alignment: "center",
              margin: [0, 0, 0, 6]
            });
          }

          pageContent.push({
            text: slide.content,
            fontSize: 9,
            lineHeight: 1.2,
            color: "#374151",
            margin: [0, 0, 0, 2]
          });
        });

        content.push({
          stack: pageContent,
          pageBreak: "before",
          unbreakable: true
        });
      });
    }
  }

  return {
    pageSize: "A4",
    pageMargins: [34, 34, 34, 30],
    content,
    images,
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: "#111827"
    },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "right",
      color: "#6B7280",
      fontSize: 8,
      margin: [34, 0, 34, 10]
    }),
    info: {
      title: copy.manualTitle,
      subject: copy.manualDescription,
      creator: "QR Recorder Server"
    }
  };
}

function buildTableOfContents(groups: GuideManualGroup[]): Content[] {
  return groups.flatMap((group) => [
    {
      text: group.title,
      bold: true,
      fontSize: 11,
      color: "#1A51DB",
      margin: [0, 8, 0, 4]
    },
    {
      ul: group.guides.map((guide) => `${guide.manualOrder.toString().padStart(2, "0")}. ${guide.title}`),
      fontSize: 9,
      color: "#374151",
      lineHeight: 1.25,
      margin: [8, 0, 0, 4]
    }
  ]);
}

async function loadGuideImages(groups: GuideManualGroup[], errorMessage: string) {
  const slides = groups.flatMap((group) =>
    group.guides.flatMap((guide) =>
      guide.slides.flatMap((slide) =>
        slide.src
          ? [
              {
                key: imageKeyFor(guide.id, slide.order),
                src: slide.src
              }
            ]
          : []
      )
    )
  );
  const entries = await Promise.all(
    slides.map(async ({ key, src }) => {
      const response = await fetch(src, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      return [key, await toPdfImageDataUrl(blob, errorMessage)] as const;
    })
  );

  return Object.fromEntries(entries);
}

function imageKeyFor(guideId: string, slideOrder: number) {
  return `guide_${guideId.replace(/[^a-zA-Z0-9_]/g, "_")}_${slideOrder}`;
}

async function toPdfImageDataUrl(blob: Blob, errorMessage: string) {
  if (blob.type === "image/png" || blob.type === "image/jpeg") {
    return readBlobAsDataUrl(blob, errorMessage);
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error(errorMessage);
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(errorMessage);
    }

    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error(errorMessage);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readBlobAsDataUrl(blob: Blob, errorMessage: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error(errorMessage));
    });
    reader.addEventListener("error", () => reject(new Error(errorMessage)));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
