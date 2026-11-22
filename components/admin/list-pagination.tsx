import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { hrefWith, type RawParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";

/** Page numbers to show: first, last, and a window around the current page. */
function pageItems(page: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * "Showing 26-50 of 312" with Previous / numbered pages / Next. Links keep the
 * current search and filters (they only change `?page=`).
 */
export function ListPagination({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string;
  params: RawParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  if (total === 0) return null;
  const last = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const href = (p: number) => hrefWith(path, params, { page: p === 1 ? null : p });

  const btn = (active = false) =>
    cn(
      buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
      "min-w-8 px-2 tabular-nums",
    );
  const disabled = "pointer-events-none opacity-50";

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing{" "}
        <span className="tabular-nums text-foreground">
          {first}-{end}
        </span>{" "}
        of <span className="tabular-nums text-foreground">{total}</span>
      </span>

      {last > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
          <Link
            href={href(Math.max(1, page - 1))}
            scroll={false}
            aria-disabled={page === 1}
            tabIndex={page === 1 ? -1 : undefined}
            className={cn(btn(), page === 1 && disabled)}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Link>

          {pageItems(page, last).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1" aria-hidden="true">
                ...
              </span>
            ) : (
              <Link
                key={p}
                href={href(p)}
                scroll={false}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={btn(p === page)}
              >
                {p}
              </Link>
            ),
          )}

          <Link
            href={href(Math.min(last, page + 1))}
            scroll={false}
            aria-disabled={page === last}
            tabIndex={page === last ? -1 : undefined}
            className={cn(btn(), page === last && disabled)}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </Link>
        </nav>
      )}
    </div>
  );
}
