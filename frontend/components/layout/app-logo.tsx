import { cn } from "@/lib/utils";

type AppLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
};

export function AppLogo({ alt = "", className, imageClassName }: AppLogoProps) {
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary", className)}>
      <img src="/favicon.ico" alt={alt} className={cn("h-7 w-7 object-contain", imageClassName)} />
    </span>
  );
}
