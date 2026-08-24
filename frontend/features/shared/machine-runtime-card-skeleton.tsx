import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MachineRuntimeCardSkeleton({ label }: { label: string }) {
  return (
    <Card className="overflow-hidden border-2" aria-busy="true" aria-label={label}>
      <CardHeader className="pb-2 sm:pb-2">
        <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.15fr)]">
          <SkeletonBlock className="h-10" />
          <SkeletonBlock className="h-10" />
          <SkeletonBlock className="h-10" />
          <SkeletonBlock className="h-10" />
        </div>
      </CardHeader>
      <CardContent className="px-3 py-2 sm:px-4 sm:py-2">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)] md:items-stretch">
          <div className="flex min-h-52 items-center justify-center border-b pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3">
            <SkeletonBlock className="h-44 w-44 rounded-full" />
          </div>
          <div className="grid min-h-52 grid-rows-4 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-full" />
            ))}
          </div>
        </div>
      </CardContent>
      <SkeletonBlock className="h-9 rounded-none border-x-0 border-b-0" />
    </Card>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md border bg-muted ${className}`} />;
}
