"use client";

import { useId } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MachineFormField({ label, error, className, ...props }: InputProps & { label: string; error?: string }) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div className={cn("space-y-2 text-sm font-medium", className)}>
      <label htmlFor={fieldId} className={cn(error && "text-destructive")}>
        {label}
      </label>
      <Input
        id={fieldId}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(error && "border-destructive focus-visible:outline-destructive")}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-normal text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
