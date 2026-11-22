"use client";

import { ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { warrantyLength, type PricedWarranty } from "@/lib/warranty";
import { cn } from "@/lib/utils";

/**
 * Warranty choice on the product page: one card per plan with its price
 * (USD, LKR underneath). Included plan shows "Free".
 */
export function WarrantyPicker({
  options,
  value,
  onChange,
}: {
  options: PricedWarranty[];
  value: string | null;
  onChange: (planId: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <ShieldCheck className="size-4 text-primary" />
        Warranty
      </legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Warranty">
        {options.map((o) => {
          const selected = o.planId === value;
          return (
            <button
              key={o.planId}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.planId)}
              className={cn(
                "relative rounded-lg border p-3 text-left text-sm transition-colors",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
              )}
            >
              {o.recommended && (
                <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{o.name}</span>
                <span className="shrink-0 tabular-nums font-medium">
                  {o.usdCents === 0 ? "Free" : `+${formatMoney(o.usdCents, "USD")}`}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>{warrantyLength(o.days)}</span>
                {o.lkrCents > 0 && <span className="tabular-nums">+{formatMoney(o.lkrCents, "LKR")}</span>}
              </div>
              {o.description && <div className="mt-1 text-xs text-muted-foreground">{o.description}</div>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
