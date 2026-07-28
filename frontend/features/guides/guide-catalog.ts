export type GuideSlide = {
  order: number;
  image: string | null;
  src: string | null;
  title: string;
  content: string;
};

export type InAppGuide = {
  id: string;
  order: number;
  title: string;
  description: string;
  slides: GuideSlide[];
};

type GuideManifest = {
  version: number;
  guides: InAppGuide[];
};

const SHOW_GUIDES_WITHOUT_IMAGES = false;

export function hasGuideImage(guide: InAppGuide) {
  return guide.slides.some((slide) => Boolean(slide.src));
}

export async function loadGuideCatalog(signal?: AbortSignal): Promise<InAppGuide[]> {
  const response = await fetch("/guides/manifest.json", {
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(`Unable to load guide catalog (${response.status}).`);
  }

  const manifest = (await response.json()) as Partial<GuideManifest>;
  if (!Array.isArray(manifest.guides)) {
    throw new Error("Guide catalog is invalid.");
  }

  return manifest.guides
    .map((guide) => ({
      ...guide,
      slides: Array.isArray(guide.slides) ? [...guide.slides].sort((first, second) => first.order - second.order) : []
    }))
    .filter((guide) => SHOW_GUIDES_WITHOUT_IMAGES || hasGuideImage(guide))
    .sort((first, second) => first.order - second.order);
}
