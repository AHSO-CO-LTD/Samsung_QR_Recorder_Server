"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { enGB, vi } from "date-fns/locale";
import type { Matcher } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormField } from "@/features/shared/form-fields";
import {
  formatPickerDisplay,
  parsePickerValue,
  serializePickerValue,
  type DatePickerMode
} from "@/lib/date-picker-value";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

type DatePickerControlProps = {
  value: string;
  onChange: (value: string) => void;
  mode: DatePickerMode;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  className?: string;
  ariaLabel: string;
  title?: string;
};

export function DateTimePickerField({
  label,
  hint,
  className,
  value,
  onChange,
  disabled,
  required,
  min,
  max
}: Omit<DatePickerControlProps, "mode" | "ariaLabel" | "title"> & {
  label: string;
  hint?: string;
}) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <DatePickerControl
        mode="datetime"
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        ariaLabel={label}
      />
    </FormField>
  );
}

export function DatePickerInput({
  value,
  onChange,
  disabled,
  required,
  min,
  max,
  className,
  ariaLabel,
  title
}: Omit<DatePickerControlProps, "mode">) {
  return (
    <DatePickerControl
      mode="date"
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      min={min}
      max={max}
      className={className}
      ariaLabel={ariaLabel}
      title={title}
    />
  );
}

function DatePickerControl({
  value,
  onChange,
  mode,
  disabled,
  required,
  min,
  max,
  className,
  ariaLabel,
  title
}: DatePickerControlProps) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const parsedValue = useMemo(() => parsePickerValue(value, mode), [mode, value]);
  const minDate = useMemo(() => parsePickerValue(min ?? "", mode)?.date, [min, mode]);
  const maxDate = useMemo(() => parsePickerValue(max ?? "", mode)?.date, [max, mode]);
  const disabledDates = useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = [];
    if (minDate) {
      matchers.push({ before: minDate });
    }
    if (maxDate) {
      matchers.push({ after: maxDate });
    }
    return matchers;
  }, [maxDate, minDate]);
  const displayValue = parsedValue ? formatPickerDisplay(parsedValue, mode) : "";
  const pickerLocale = locale === "vi" ? vi : enGB;

  const selectDate = (date: Date | undefined) => {
    if (!date) {
      return;
    }
    onChange(serializePickerValue(date, mode, parsedValue?.time));
    if (mode === "date") {
      setOpen(false);
    }
  };

  const selectTime = (time: string) => {
    if (!parsedValue) {
      return;
    }
    onChange(serializePickerValue(parsedValue.date, mode, time));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 text-left font-normal tabular-nums",
            !displayValue && "text-muted-foreground",
            className
          )}
          aria-label={ariaLabel}
          aria-required={required}
          title={title}
          disabled={disabled}
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{displayValue || (mode === "datetime" ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="single"
          locale={pickerLocale}
          selected={parsedValue?.date}
          defaultMonth={parsedValue?.date ?? maxDate ?? new Date()}
          disabled={disabledDates}
          onSelect={selectDate}
          initialFocus
        />
        {mode === "datetime" ? (
          <div className="mt-3 border-t pt-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{t("datePickerTime")}</span>
              <Input
                type="time"
                step={60}
                value={parsedValue?.time ?? "00:00"}
                className="ml-auto h-9 w-32 tabular-nums"
                aria-label={t("datePickerTime")}
                disabled={!parsedValue}
                onChange={(event) => selectTime(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        {mode === "datetime" || (!required && parsedValue) ? (
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            {!required && parsedValue ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
                {t("datePickerClear")}
              </Button>
            ) : (
              <span />
            )}
            {mode === "datetime" ? (
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                {t("datePickerDone")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
