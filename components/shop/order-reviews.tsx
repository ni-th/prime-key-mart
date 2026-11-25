"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { saveReview } from "@/app/actions/reviews";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/label";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Stars } from "@/components/shop/stars";
import { cn } from "@/lib/utils";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_STATUS,
  REVIEW_TITLE_MAX,
  type OrderReviewItem,
} from "@/lib/review-shared";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="p-0.5"
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{RATING_WORDS[shown]}</span>
    </div>
  );
}

function ReviewForm({
  orderNumber,
  token,
  item,
  onSaved,
  onCancel,
}: {
  orderNumber: string;
  token: string | null;
  item: OrderReviewItem;
  onSaved: (review: NonNullable<OrderReviewItem["review"]>, message: string) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(item.review?.rating ?? 0);
  const [title, setTitle] = useState(item.review?.title ?? "");
  const [body, setBody] = useState(item.review?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Pick a star rating.");
        start(async () => {
          const r = await saveReview({ orderNumber, token, productId: item.productId, rating, title, body });
          if (!r.ok) return setError(r.error);
          onSaved(
            {
              rating,
              title: title.trim() || null,
              body: body.trim(),
              status: r.status ?? item.review?.status ?? "PENDING",
              adminReply: item.review?.adminReply ?? null,
            },
            r.message,
          );
        });
      }}
    >
      <FieldGroup className="gap-4">
        <Field>
          <FieldTitle>
            Rating <RequiredMark className="ml-0" />
          </FieldTitle>
          <StarPicker value={rating} onChange={(n) => { setRating(n); setError(null); }} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`title-${item.productId}`}>Title (optional)</FieldLabel>
          <Input
            id={`title-${item.productId}`}
            value={title}
            maxLength={REVIEW_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Activated in seconds"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`body-${item.productId}`} required>
            Your review
          </FieldLabel>
          <Textarea
            id={`body-${item.productId}`}
            value={body}
            rows={4}
            minLength={REVIEW_BODY_MIN}
            maxLength={REVIEW_BODY_MAX}
            onChange={(e) => { setBody(e.target.value); setError(null); }}
            placeholder="How was activation? Did it work as described?"
            required
          />
          <FieldDescription className="flex justify-between gap-3 text-xs">
            <span>Shown with your first name and last initial. Please don&apos;t include your key or personal details.</span>
            <span className="shrink-0 tabular-nums">
              {body.trim().length}/{REVIEW_BODY_MAX}
            </span>
          </FieldDescription>
        </Field>
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {item.review ? "Save changes" : "Submit review"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** "Rate your purchase" on a delivered order: one review per product. */
export function OrderReviews({
  orderNumber,
  token,
  items: initial,
}: {
  orderNumber: string;
  token: string | null;
  items: OrderReviewItem[];
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ productId: string; message: string } | null>(null);
  if (items.length === 0) return null;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-medium">Rate your purchase</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Help other customers by sharing how it went. Reviews are marked as a verified purchase.
        </p>
      </div>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.productId} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/products/${item.productSlug}`} className="text-sm font-medium hover:underline">
                {item.productName}
              </Link>
              {item.review && editing !== item.productId && (
                <div className="flex items-center gap-2">
                  <Badge variant={item.review.status === "APPROVED" ? "secondary" : "outline"}>
                    {REVIEW_STATUS[item.review.status]}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(item.productId); setNotice(null); }}>
                    Edit
                  </Button>
                </div>
              )}
              {!item.review && editing !== item.productId && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(item.productId); setNotice(null); }}>
                  <Star className="size-4" />
                  Write a review
                </Button>
              )}
            </div>

            {item.review && editing !== item.productId && (
              <div className="mt-2 space-y-1 text-sm">
                <Stars rating={item.review.rating} size="size-3.5" />
                {item.review.title && <p className="font-medium">{item.review.title}</p>}
                <p className="whitespace-pre-line text-muted-foreground">{item.review.body}</p>
                {item.review.adminReply && (
                  <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs">
                    <span className="font-medium">Reply from the store:</span> {item.review.adminReply}
                  </p>
                )}
              </div>
            )}

            {notice?.productId === item.productId && (
              <p className="mt-2 text-sm text-success">{notice.message}</p>
            )}

            {editing === item.productId && (
              <ReviewForm
                orderNumber={orderNumber}
                token={token}
                item={item}
                onCancel={() => setEditing(null)}
                onSaved={(review, message) => {
                  setItems((all) => all.map((i) => (i.productId === item.productId ? { ...i, review } : i)));
                  setEditing(null);
                  setNotice({ productId: item.productId, message });
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
