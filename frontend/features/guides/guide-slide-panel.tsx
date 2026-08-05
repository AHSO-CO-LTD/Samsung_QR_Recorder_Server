"use client";

import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InAppGuide } from "@/features/guides/guide-catalog";
import { cn } from "@/lib/utils";

type GuideSlideCopy = {
  previous: string;
  next: string;
  finish: string;
  imageLoadFailed: string;
  slidePicker: string;
};

export function GuideSlidePanel({
  guide,
  currentIndex,
  copy,
  onIndexChange,
  onComplete
}: {
  guide: InAppGuide;
  currentIndex: number;
  copy: GuideSlideCopy;
  onIndexChange: (index: number) => void;
  onComplete: () => void;
}) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const slide = guide.slides[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === guide.slides.length - 1;
  const hasUsableImage = Boolean(slide?.src && !failedImages.has(slide.src));

  const move = (direction: -1 | 1) => {
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < guide.slides.length) {
      onIndexChange(nextIndex);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft" && !isFirst) {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight" && !isLast) {
      event.preventDefault();
      move(1);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) {
      return;
    }
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 50) {
      return;
    }
    move(distance > 0 ? -1 : 1);
  };

  if (!slide) {
    return null;
  }

  return (
    <section
      className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
      aria-label={guide.title}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto max-w-5xl">
          <div
            className={cn(
              "border-l-2 border-primary pl-4",
              slide.src ? "mb-4" : "flex min-h-[18rem] flex-col justify-center rounded-md border border-l-2 bg-muted/20 p-6 sm:p-8"
            )}
            aria-live="polite"
          >
            <Badge variant="outline" className="mb-3 w-fit">
              {currentIndex + 1}/{guide.slides.length}
            </Badge>
            <h3 className="text-base font-semibold sm:text-lg">{slide.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{slide.content}</p>
          </div>

          {slide.src ? (
            <div className="flex min-h-[15rem] items-center justify-center overflow-hidden rounded-md border bg-muted/25 sm:min-h-[22rem]">
              {hasUsableImage ? (
                <img
                  key={slide.src}
                  src={slide.src}
                  alt={`${guide.title}: ${slide.title}`}
                  className="max-h-[55dvh] w-full object-contain"
                  onError={() => {
                    setFailedImages((current) => new Set(current).add(slide.src!));
                  }}
                />
              ) : (
                <div className="flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center text-muted-foreground">
                  <span className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                    <ImageOff className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">{copy.imageLoadFailed}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="grid gap-3 border-t bg-card px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-4">
        <Badge variant="outline" className="w-fit">
          {currentIndex + 1}/{guide.slides.length}
        </Badge>

        <div className="flex min-w-0 flex-wrap justify-center gap-1" role="group" aria-label={copy.slidePicker}>
          {guide.slides.map((item, index) => (
            <Button
              key={item.order}
              type="button"
              variant={index === currentIndex ? "default" : "outline"}
              size="icon"
              className="h-7 w-7 text-xs"
              aria-label={`${item.order}. ${item.title}`}
              aria-pressed={index === currentIndex}
              onClick={() => onIndexChange(index)}
            >
              {item.order}
            </Button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isFirst} onClick={() => move(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {copy.previous}
          </Button>
          <Button type="button" size="sm" onClick={() => (isLast ? onComplete() : move(1))}>
            {isLast ? copy.finish : copy.next}
            {!isLast ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>
        </div>
      </footer>
    </section>
  );
}
