"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Profile } from "@/features/shared/types";
import { cn } from "@/lib/utils";

function getProfileLabel(profile: Profile, fallbackLabel: (id: number) => string) {
  return profile.chassis_code?.code_full ?? fallbackLabel(profile.id);
}

export function ProfileFilterCombobox({
  label,
  value,
  profiles,
  allProfilesLabel,
  searchPlaceholder,
  emptyLabel,
  fallbackLabel,
  onValueChange
}: {
  label: string;
  value: string;
  profiles: Profile[];
  allProfilesLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  fallbackLabel: (id: number) => string;
  onValueChange: (value: string) => void;
}) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedProfile = profiles.find((profile) => String(profile.id) === value);
  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return profiles;

    return profiles.filter((profile) => getProfileLabel(profile, fallbackLabel).toLocaleLowerCase().includes(normalizedQuery));
  }, [fallbackLabel, profiles, query]);

  const selectProfile = (nextValue: string) => {
    onValueChange(nextValue);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="space-y-2 text-sm font-medium">
      <label htmlFor={fieldId}>{label}</label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background px-3 font-normal hover:bg-background"
          >
            <span className="truncate">{selectedProfile ? getProfileLabel(selectedProfile, fallbackLabel) : allProfilesLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <Input
            autoFocus
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 max-h-64 overflow-y-auto" role="listbox" aria-label={label}>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted",
                !value && "bg-muted"
              )}
              onClick={() => selectProfile("")}
            >
              <Check className={cn("h-4 w-4", !value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
              <span className="truncate">{allProfilesLabel}</span>
            </button>
            {filteredProfiles.map((profile) => {
              const profileValue = String(profile.id);
              const isSelected = value === profileValue;

              return (
                <button
                  key={profile.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted",
                    isSelected && "bg-muted"
                  )}
                  onClick={() => selectProfile(profileValue)}
                >
                  <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  <span className="truncate">{getProfileLabel(profile, fallbackLabel)}</span>
                </button>
              );
            })}
            {filteredProfiles.length === 0 ? <p className="px-2 py-3 text-sm font-normal text-muted-foreground">{emptyLabel}</p> : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
