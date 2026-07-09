"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex min-w-0 justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-grid_line]:stroke-border/80 [&_.recharts-tooltip-cursor]:stroke-border",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, itemConfig]) => itemConfig.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: colorConfig
          .map(([key, itemConfig]) => `[data-chart=${id}] { --color-${key}: ${itemConfig.color}; }`)
          .join("\n")
      }}
    />
  );
};

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: React.ReactNode;
  color?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  className
}: {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: React.ReactNode;
  className?: string;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={cn("min-w-40 rounded-md border bg-card p-3 text-card-foreground shadow-sm", className)}>
      {label ? <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey || item.name || "");
          const itemConfig = config[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: item.color || itemConfig?.color }}
                />
                <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
              </div>
              <span className="font-mono font-medium">{String(item.value ?? "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

export function ChartLegendContent({
  payload,
  className
}: {
  payload?: ChartPayloadItem[];
  className?: string;
}) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-center gap-4 text-xs", className)}>
      {payload.map((item) => {
        const key = String(item.dataKey || item.value || "");
        const itemConfig = config[key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color || itemConfig?.color }} />
            <span className="text-muted-foreground">{itemConfig?.label || item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
