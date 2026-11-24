import { BadgeCheck } from "lucide-react";
import { Stars } from "@/components/shop/stars";
import type { RatingSummary } from "@/lib/review-shared";

const reviewDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

type Review = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  adminReply: string | null;
  createdAt: Date;
};

/** Published reviews on the product page. */
export function ProductReviews({ reviews, summary }: { reviews: Review[]; summary: RatingSummary }) {
  return (
    <section id="reviews" className="mt-12 max-w-3xl scroll-mt-20">
      <h2 className="mb-1 text-lg font-semibold">Customer reviews</h2>
      {summary.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Customers who buy this can review it from their order page.
        </p>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-2 text-sm">
            <Stars rating={summary.average} />
            <span className="font-medium tabular-nums">{summary.average.toFixed(1)} out of 5</span>
            <span className="text-muted-foreground">
              · {summary.count} review{summary.count === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="space-y-1.5 py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars rating={r.rating} size="size-3.5" />
                  {r.title && <span className="text-sm font-medium">{r.title}</span>}
                </div>
                <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{r.body}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="text-foreground">{r.authorName}</span>
                  <span className="inline-flex items-center gap-1 text-success">
                    <BadgeCheck className="size-3.5" />
                    Verified purchase
                  </span>
                  <span>· {reviewDate.format(r.createdAt)}</span>
                </p>
                {r.adminReply && (
                  <div className="mt-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">Reply from the store</span>
                    <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{r.adminReply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
