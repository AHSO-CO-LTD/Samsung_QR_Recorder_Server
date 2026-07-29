"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={cn(
      "h-5 cursor-pointer appearance-none bg-transparent accent-primary disabled:cursor-not-allowed disabled:opacity-50",
      "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-sm [&::-moz-range-progress]:bg-primary",
      "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
      "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-sm [&::-moz-range-track]:bg-muted",
      "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-sm [&::-webkit-slider-runnable-track]:bg-muted",
      "[&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      className
    )}
    {...props}
  />
));
Slider.displayName = "Slider";

export { Slider };
