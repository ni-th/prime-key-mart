import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { hrefWith, param, type RawParams } from "@/lib/list-params";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Stars } from "@/components/shop/stars";
import { ReviewActions } from "@/components/admin/review-actions";
import { REVIEW_STATUS, type ReviewStatus } from "@/lib/review-shared";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews · Admin" };

const FILTERS = [
  { value: "", label: "To approve" },
  { value: "APPROVED", label: "Published" },
  { value: "REJECTED", label: "Not published" },
  { value: "ALL", label: "All" },
];

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const status = param(sp, "status");
  const active = FILTERS.some((f) => f.value === status) ? status : "";

  const [reviews, pendingCount] = await Promise.all([
    prisma.productReview.findMany({
      where: active === "ALL" ? {} : { status: active || "PENDING" },
      // Queue oldest first (fair); history newest first.
      orderBy: { updatedAt: active ? "desc" : "asc" },
      take: 100,
      include: {
        product: { select: { name: true, slug: true } },
        orderItem: { select: { order: { select: { orderNumber: true } } } },
      },
    }),
    prisma.productReview.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviews come only from customers with a delivered order. New and edited reviews wait here
          until you publish them. Replies are shown publicly under the review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={hrefWith("/admin/reviews", sp, { status: f.value || null })}
            className={cn(buttonVariants({ variant: active === f.value ? "default" : "outline", size: "xs" }))}
          >
            {f.label}
            {f.value === "" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {active ? "No reviews here." : "Nothing to approve."}
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/products/${r.product.slug}`} className="font-medium hover:underline">
                    {r.product.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.authorName} · {r.email} ·{" "}
                    <Link href={`/admin/orders/${r.orderItem.order.orderNumber}`} className="hover:underline">
                      {r.orderItem.order.orderNumber}
                    </Link>{" "}
                    · {when.format(r.updatedAt)}
                    {r.updatedAt.getTime() - r.createdAt.getTime() > 60_000 ? " (edited)" : ""}
                  </div>
                </div>
                <Badge variant={r.status === "APPROVED" ? "secondary" : "outline"}>
                  {REVIEW_STATUS[r.status as ReviewStatus] ?? r.status}
                </Badge>
              </div>

              <div className="space-y-1">
                <Stars rating={r.rating} />
                {r.title && <p className="font-medium">{r.title}</p>}
                <p className="whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>
              </div>

              {r.adminReply && (
                <div className="rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium">Your reply</span>
                  <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{r.adminReply}</p>
                </div>
              )}

              <ReviewActions id={r.id} status={r.status as ReviewStatus} reply={r.adminReply} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
