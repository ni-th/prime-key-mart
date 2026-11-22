"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2, Star } from "lucide-react";
import { reorderWarrantyPlans } from "@/app/actions/warranty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { warrantyLength, warrantyUsdCents } from "@/lib/warranty";
import { cn } from "@/lib/utils";

export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  days: number | null;
  percent: number;
  active: boolean;
  isDefault: boolean;
  recommended: boolean;
  customProducts: number;
};

const EXAMPLE_CENTS = 3999;

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/** Warranty plans in display order; drag the handle or use the arrows. */
export function WarrantyPlanList({ plans }: { plans: PlanRow[] }) {
  const [items, setItems] = useState(plans);
  const [dragId, setDragId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | string>("idle");
  const [pending, startTransition] = useTransition();
  const saved = useRef(plans);
  const beforeDrag = useRef(plans);

  function save(next: PlanRow[]) {
    if (next.every((p, i) => p.id === saved.current[i]?.id)) return;
    startTransition(async () => {
      const res = await reorderWarrantyPlans(next.map((p) => p.id));
      if (res.ok) {
        saved.current = next;
        setStatus("saved");
      } else {
        setItems(saved.current);
        setStatus(res.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        No warranty plans yet. Start with a free included plan (e.g. 30 days), then add paid upgrades.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center gap-1.5 text-xs" aria-live="polite">
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Saving order...
          </>
        ) : status === "saved" ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" /> Order saved
          </span>
        ) : status !== "idle" ? (
          <span className="text-destructive">{status}</span>
        ) : (
          <span className="text-muted-foreground">
            Shown in this order on product pages. Example prices are for a {formatMoney(EXAMPLE_CENTS, "USD")} product.
          </span>
        )}
      </div>

      <ul className="divide-y rounded-xl border">
        {items.map((p, index) => {
          const example = warrantyUsdCents(EXAMPLE_CENTS, p.isDefault ? 0 : p.percent);
          return (
            <li
              key={p.id}
              draggable={armedId === p.id}
              onDragStart={(e) => {
                beforeDrag.current = items;
                setDragId(p.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", p.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (dragId === p.id) return;
                const from = items.findIndex((i) => i.id === dragId);
                if (from !== -1) setItems(move(items, from, index));
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={(e) => {
                setDragId(null);
                setArmedId(null);
                if (e.dataTransfer.dropEffect === "none") setItems(beforeDrag.current);
                else save(items);
              }}
              className={cn(
                "flex items-center gap-3 bg-card p-3 first:rounded-t-xl last:rounded-b-xl",
                dragId === p.id && "opacity-50",
                !p.active && "opacity-60",
              )}
            >
              <button
                type="button"
                aria-label={`Drag to reorder ${p.name}`}
                onPointerDown={() => setArmedId(p.id)}
                onPointerUp={() => setArmedId(null)}
                className="hidden cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted sm:block"
              >
                <GripVertical className="size-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/admin/warranty/${p.id}`} draggable={false} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">{warrantyLength(p.days)}</span>
                  {p.recommended && (
                    <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Most popular" />
                  )}
                </div>
                {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
              </div>

              <div className="hidden flex-wrap gap-1 sm:flex">
                {p.isDefault && <Badge variant="secondary">Included</Badge>}
                {!p.active && <Badge variant="outline">Hidden</Badge>}
                {p.customProducts > 0 && (
                  <Badge variant="outline">
                    {p.customProducts} custom product{p.customProducts === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>

              <div className="w-28 text-right text-sm tabular-nums">
                <div className="font-medium">{p.isDefault ? "Free" : `+${p.percent}%`}</div>
                {!p.isDefault && <div className="text-xs text-muted-foreground">+{formatMoney(example, "USD")}</div>}
              </div>

              <div className="flex shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${p.name} up`}
                  disabled={index === 0 || pending}
                  onClick={() => {
                    const next = move(items, index, index - 1);
                    setItems(next);
                    save(next);
                  }}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${p.name} down`}
                  disabled={index === items.length - 1 || pending}
                  onClick={() => {
                    const next = move(items, index, index + 1);
                    setItems(next);
                    save(next);
                  }}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
