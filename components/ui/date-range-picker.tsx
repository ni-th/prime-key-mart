"use client";

import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { DateRange };

/**
 * shadcn-style date range picker: a button that opens a two-month calendar.
 * Picking one day sets the start; picking a second sets the end. Used for
 * every date range in the app (order filters, sale schedules).
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  disabled,
  className,
  size = "default",
  id,
  invalid,
  clearable = true,
  "aria-label": ariaLabel,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  /** Days that can't be picked (react-day-picker matcher). */
  disabled?: React.ComponentProps<typeof Calendar>["disabled"];
  className?: string;
  size?: "sm" | "default";
  id?: string;
  invalid?: boolean;
  clearable?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const from = value?.from;
  const to = value?.to;

  const label = from
    ? to && to.getTime() !== from.getTime()
      ? `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`
      : format(from, "MMM d, yyyy")
    : null;

  return (
    <div className={cn("relative inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            buttonVariants({ variant: "outline", size }),
            "w-full justify-start font-normal aria-invalid:border-destructive",
            !label && "text-muted-foreground",
            clearable && label && "pr-8",
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">{label ?? placeholder}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            disabled={disabled}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && label && (
        <button
          type="button"
          aria-label="Clear dates"
          onClick={() => onChange(undefined)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** "2026-11-21" <-> Date at local midnight (for URL params). */
export function parseYmd(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function toYmd(date: Date | undefined): string | null {
  return date ? format(date, "yyyy-MM-dd") : null;
}
