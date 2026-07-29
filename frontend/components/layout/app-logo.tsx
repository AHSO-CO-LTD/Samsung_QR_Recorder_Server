import { cn } from "@/lib/utils";

type AppLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  src?: string;
};

export function AppLogo({ alt = "", className, imageClassName, src = "/favicon.ico" }: AppLogoProps) {
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center", className)}>
      <img src={src} alt={alt} className={cn("h-7 w-7 object-contain", imageClassName)} />
    </span>
  );
}
