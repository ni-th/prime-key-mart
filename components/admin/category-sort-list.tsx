"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, ImageIcon, Loader2 } from "lucide-react";
import { reorderCategories } from "@/app/actions/categories";
import { optimizedImageUrl } from "@/lib/image-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SortableCategory = {
  id: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  productCount: number;
  visible: boolean;
  showInHeader: boolean;
};

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Category list ordered by drag and drop (grip handle) or the up/down buttons
 * (touch screens and keyboards). Every change is saved straight away.
 */
export function CategorySortList({ categories }: { categories: SortableCategory[] }) {
  const [items, setItems] = useState(categories);
  const [dragId, setDragId] = useState<string | null>(null);
  // Only the row whose grip is pressed is draggable, so links and text in
  // other rows behave normally.
  const [armedId, setArmedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const beforeDrag = useRef<SortableCategory[]>(categories);
  const saved = useRef<SortableCategory[]>(categories);

  function save(next: SortableCategory[]) {
    const unchanged = next.every((c, i) => c.id === saved.current[i]?.id);
    if (unchanged) return;
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const res = await reorderCategories(next.map((c) => c.id));
      if (res.ok) {
        saved.current = next;
        setStatus({ kind: "saved" });
      } else {
        setItems(saved.current);
        setStatus({ kind: "error", message: res.error });
      }
    });
  }

  function nudge(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = move(items, index, to);
    setItems(next);
    save(next);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        No categories yet. Create one before adding products.
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
        ) : status.kind === "saved" ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" /> Order saved
          </span>
        ) : status.kind === "error" ? (
          <span className="text-destructive">{status.message}</span>
        ) : (
          <span className="text-muted-foreground">
            Drag the handle (or use the arrows) to change the order.
          </span>
        )}
      </div>

      <ul className="divide-y rounded-xl border">
        {items.map((c, index) => (
          <li
            key={c.id}
            draggable={armedId === c.id}
            onDragStart={(e) => {
              beforeDrag.current = items;
              setDragId(c.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", c.id);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (dragId === c.id) return;
              const from = items.findIndex((i) => i.id === dragId);
              if (from !== -1) setItems(move(items, from, index));
            }}
            onDrop={(e) => e.preventDefault()}
            onDragEnd={(e) => {
              setDragId(null);
              setArmedId(null);
              // Dropped outside the list (or Esc): put things back.
              if (e.dataTransfer.dropEffect === "none") setItems(beforeDrag.current);
              else save(items);
            }}
            className={cn(
              "flex items-center gap-3 bg-card p-3 first:rounded-t-xl last:rounded-b-xl",
              dragId === c.id && "opacity-50",
            )}
          >
            <button
              type="button"
              aria-label={`Drag to reorder ${c.name}`}
              onPointerDown={() => setArmedId(c.id)}
              onPointerUp={() => setArmedId(null)}
              className="hidden cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing sm:block"
            >
              <GripVertical className="size-4" />
            </button>

            <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>

            {c.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an uploaded URL
              <img
                src={optimizedImageUrl(c.bannerUrl, 240)}
                alt=""
                draggable={false}
                className="hidden aspect-4/1 w-28 shrink-0 rounded border object-cover md:block"
              />
            ) : (
              <span className="hidden w-28 shrink-0 items-center gap-1 text-xs text-muted-foreground md:inline-flex">
                <ImageIcon className="size-3.5" /> No banner
              </span>
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/categories/${c.id}`}
                draggable={false}
                className="font-medium hover:underline"
              >
                {c.name}
              </Link>
              <div className="truncate font-mono text-xs text-muted-foreground">{c.slug}</div>
            </div>

            <div className="hidden flex-wrap gap-1 sm:flex">
              {c.visible ? (
                <Badge variant="secondary">Visible</Badge>
              ) : (
                <Badge variant="outline">Hidden</Badge>
              )}
              {c.visible && c.showInHeader && <Badge variant="outline">In header</Badge>}
            </div>

            <Link
              href={`/admin/products?category=${c.slug}`}
              draggable={false}
              className="w-16 text-right text-sm tabular-nums hover:underline"
            >
              {c.productCount} <span className="text-xs text-muted-foreground">items</span>
            </Link>

            <div className="flex shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${c.name} up`}
                disabled={index === 0 || pending}
                onClick={() => nudge(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${c.name} down`}
                disabled={index === items.length - 1 || pending}
                onClick={() => nudge(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
