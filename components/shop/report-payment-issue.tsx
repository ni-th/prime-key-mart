"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Info, Loader2, MessageCircleWarning } from "lucide-react";
import { reportPaymentIssue, type ReportResult } from "@/app/actions/payment-issue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * "I paid but didn't get my keys". For when the payment went through but the
 * confirmation never reached us (e.g. the connection dropped after paying).
 * Flags the order for the admin, who checks PayHere and delivers.
 */
export function ReportPaymentIssue({
  orderNumber,
  token,
  email,
  alreadyReported = false,
  closedMessage = null,
  canFollowUp = true,
  defaultOpen = false,
}: {
  orderNumber: string;
  /** Signed order link token (success page), if any. */
  token?: string | null;
  /** Checkout email (order lookup), if any. Signed-in owners need neither. */
  email?: string | null;
  alreadyReported?: boolean;
  /** We checked and found no payment: our message to the customer. */
  closedMessage?: string | null;
  /** One follow-up report is allowed after a close. */
  canFollowUp?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadyReported || result?.ok) {
    return (
      <div className="flex gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="text-muted-foreground">
          {result?.ok
            ? result.message
            : "We have your report and are checking your payment. We'll email your keys once it's confirmed."}
        </p>
      </div>
    );
  }

  const closed = closedMessage !== null;

  if (closed && !open) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Info className="size-4 shrink-0 text-primary" />
          We checked your payment
        </div>
        <p className="whitespace-pre-line text-muted-foreground">{closedMessage}</p>
        {canFollowUp ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            I was charged - send more details
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            To follow up, reply to the email we sent you about this order.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <MessageCircleWarning className="size-4" />
        I paid but didn&apos;t get my keys
      </button>
    );
  }

  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setResult(await reportPaymentIssue({ orderNumber, token, email, paymentRef, note }));
        });
      }}
    >
      <div>
        <p className="text-sm font-medium">
          {closed ? "Send us more details" : "Tell us about your payment"}
        </p>
        <p className="text-xs text-muted-foreground">
          {closed
            ? "Tell us when and how you paid, and the reference from your bank or card statement. You can send this once; after that, reply to our email."
            : "If your connection dropped after paying, the confirmation may not have reached us. We'll check with PayHere and send your keys by email."}
        </p>
      </div>

      {result && !result.ok && (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`ref-${orderNumber}`}>Payment reference (optional)</Label>
        <Input
          id={`ref-${orderNumber}`}
          value={paymentRef}
          onChange={(e) => setPaymentRef(e.target.value)}
          maxLength={80}
          placeholder="From your PayHere receipt email"
          aria-invalid={fe.paymentRef ? true : undefined}
        />
        {fe.paymentRef && <p className="text-xs text-destructive">{fe.paymentRef}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`note-${orderNumber}`}>Anything else? (optional)</Label>
        <Textarea
          id={`note-${orderNumber}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Paid by card at 2:15pm, the page stopped loading."
          aria-invalid={fe.note ? true : undefined}
        />
        {fe.note && <p className="text-xs text-destructive">{fe.note}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Send to support
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
