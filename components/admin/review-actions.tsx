"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, EyeOff, Loader2, MessageSquareReply, Trash2 } from "lucide-react";
import { deleteReview, replyToReview, setReviewStatus, type ReviewResult } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { REVIEW_REPLY_MAX, type ReviewStatus } from "@/lib/review-shared";

/** Approve / hide / delete / reply buttons for one review in Admin -> Reviews. */
export function ReviewActions({
  id,
  status,
  reply,
}: {
  id: string;
  status: ReviewStatus;
  reply: string | null;
}) {
  const [pending, start] = useTransition();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(reply ?? "");

  const run = (fn: () => Promise<ReviewResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        after?.();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== "APPROVED" && (
          <Button size="sm" disabled={pending} onClick={() => run(() => setReviewStatus(id, "APPROVED"))}>
            <Check className="size-4" />
            Publish
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setReviewStatus(id, "REJECTED"))}
          >
            <EyeOff className="size-4" />
            {status === "APPROVED" ? "Unpublish" : "Don't publish"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setReplying((v) => !v)}>
          <MessageSquareReply className="size-4" />
          {reply ? "Edit reply" : "Reply"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this review for good? The customer can write a new one.")) {
              run(() => deleteReview(id));
            }
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        {pending && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />}
      </div>

      {replying && (
        <div className="space-y-2">
          <Field>
            <FieldLabel htmlFor={`reply-${id}`}>Public reply</FieldLabel>
            <Textarea
              id={`reply-${id}`}
              rows={3}
              maxLength={REVIEW_REPLY_MAX}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Thanks for the review! ... (shown publicly under the review)"
            />
            <FieldDescription className="text-xs">
              Shown under the review. {text.trim().length}/{REVIEW_REPLY_MAX} characters. Empty removes it.
            </FieldDescription>
          </Field>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(() => replyToReview(id, text), () => setReplying(false))}>
              Save reply
            </Button>
            {reply && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => replyToReview(id, ""), () => { setText(""); setReplying(false); })}
              >
                Remove reply
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
