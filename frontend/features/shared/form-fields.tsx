"use client";

import type React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  children,
  className,
  hint
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cn("space-y-2 text-sm font-medium", className)}>
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function TextInputField({
  label,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: string;
}) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <Input {...props} />
    </FormField>
  );
}

export function NumberInputField({
  label,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: string;
}) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <Input type="number" min={1} {...props} />
    </FormField>
  );
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
    </FormField>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </FormField>
  );
}

export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  disabled,
  hint
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <Checkbox checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.currentTarget.checked)} />
      <span className="grid gap-1">
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}
