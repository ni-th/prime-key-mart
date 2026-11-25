"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DateRangePicker, parseYmd, toYmd } from "@/components/ui/date-range-picker";

/** Update URL params in place (replace, no scroll), resetting to page 1. */
function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };
  return { params, update, pending };
}

/** Search box bound to `?q=`. Updates as you type (debounced), Enter = now. */
export function ListSearch({
  placeholder,
  param = "q",
  className,
}: {
  placeholder: string;
  param?: string;
  className?: string;
}) {
  const { params, update, pending } = useParamUpdater();
  const urlValue = params.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL changes elsewhere (Clear, Back button).
  const [lastUrlValue, setLastUrlValue] = useState(urlValue);
  if (urlValue !== lastUrlValue) {
    setLastUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (v.trim() !== urlValue) update({ [param]: v.trim() || null });
  };

  return (
    <form
      role="search"
      className={cn("relative w-full sm:w-72", className)}
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
    >
      {pending ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={100}
        className="h-8 pr-8 pl-8"
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(v), 350);
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
          onClick={() => {
            setValue("");
            commit("");
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}

/** Dropdown bound to one URL param. The first option ("all") removes it. */
export function ListSelect({
  param,
  options,
  label,
  className,
}: {
  param: string;
  /** First option is the default/"all" choice; its value is ignored. */
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const { params, update } = useParamUpdater();
  const [all, ...rest] = options;
  const items = [{ value: "__all", label: all.label }, ...rest];
  const current = params.get(param);
  const value = current && rest.some((o) => o.value === current) ? current : "__all";

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(v) => update({ [param]: v === "__all" ? null : (v as string) })}
    >
      <SelectTrigger size="sm" aria-label={label} className={cn("w-40", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Date range picker bound to `?from=` and `?to=` (yyyy-mm-dd, inclusive). */
export function ListDateRange() {
  const { params, update } = useParamUpdater();
  const from = parseYmd(params.get("from"));
  const to = parseYmd(params.get("to"));
  return (
    <DateRangePicker
      size="sm"
      className="w-64"
      aria-label="Order date range"
      placeholder="Any date"
      value={from || to ? { from: from ?? to, to } : undefined}
      onChange={(range) => update({ from: toYmd(range?.from), to: toYmd(range?.to) })}
    />
  );
}

/** "Clear" button shown when any of `keys` is set in the URL. */
export function ListClear({ keys }: { keys: string[] }) {
  const { params, update } = useParamUpdater();
  if (!keys.some((k) => params.get(k))) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => update(Object.fromEntries(keys.map((k) => [k, null])))}
    >
      <X className="size-3.5" />
      Clear
    </Button>
  );
}
