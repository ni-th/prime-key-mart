"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { EMAIL_MAX } from "@/lib/validation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { lookupOrderAction, type LookupState } from "@/app/actions/order-lookup";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Email me my order
    </Button>
  );
}

/**
 * Find my order: emails the order (keys if delivered) to the address used at
 * checkout. Nothing about the order is ever shown here, so knowing someone's
 * order number and email doesn't give away their keys.
 */
export function OrderLookup({ supportEmail }: { supportEmail?: string | null }) {
  const [state, formAction] = useActionState<LookupState, FormData>(lookupOrderAction, {
    status: "idle",
  });

  if (state.status === "blocked") {
    return (
      <Card className="space-y-3 p-6 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert className="size-5 text-destructive" />
          We couldn&apos;t verify this order
        </div>
        <p className="text-muted-foreground">
          The order number and email didn&apos;t match too many times, so Find my order is paused
          for 24 hours to protect our customers&apos; keys.
        </p>
        <p className="text-muted-foreground">
          Please contact the Keysby team and we&apos;ll help you get your order. Include your order
          number and, if you have it, your PayHere receipt.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}?subject=${encodeURIComponent("Help finding my order")}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Email {supportEmail}
            </a>
          )}
          <Link
            href="/contact"
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          >
            Contact page
          </Link>
        </div>
      </Card>
    );
  }

  if (state.status === "sent") {
    return (
      <Card className="space-y-3 p-6 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <MailCheck className="size-5 text-success" />
          Check your email
        </div>
        <p className="text-muted-foreground">
          We&apos;ve sent your order details to <strong>{state.email}</strong>. Delivered orders
          include your license keys. It usually arrives within a minute; check your spam folder
          too.
        </p>
        <p className="text-muted-foreground">
          Nothing arrived after a few minutes? Reply to any email from us and we&apos;ll help.
        </p>
        {/* Full reload resets the form (and the server keeps counting attempts). */}
        <a href="/order-lookup" className="inline-block text-sm font-medium text-primary hover:underline">
          Look up another order
        </a>
      </Card>
    );
  }

  const typed = state.status === "notFound" ? state : null;

  return (
    <Card className="p-6">
      {/* key: remount with the typed values after each failed attempt. */}
      <form
        key={typed ? `${typed.orderNumber}|${typed.email}|${typed.attemptsLeft}` : "new"}
        action={formAction}
        className="space-y-4"
      >
        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state.status === "notFound" && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t find an order with that order number and email. Check both against
              your PayHere receipt.{" "}
              {state.attemptsLeft > 0
                ? `${state.attemptsLeft} attempt${state.attemptsLeft === 1 ? "" : "s"} left.`
                : ""}
            </AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="orderNumber" required>
              Order number
            </FieldLabel>
            <Input
              id="orderNumber"
              name="orderNumber"
              placeholder="KM-XXXXXX"
              defaultValue={typed?.orderNumber}
              autoCapitalize="characters"
              spellCheck={false}
              minLength={3}
              maxLength={40}
              required
            />
            <FieldDescription>On your PayHere receipt and order email, e.g. KM-8F3K2Q.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="email" required>
              Email used at checkout
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={typed?.email}
              maxLength={EMAIL_MAX}
              required
            />
          </Field>
        </FieldGroup>
        <SubmitButton />
        <p className="text-xs text-muted-foreground">
          For your security we never show keys here. We&apos;ll email your order to the address
          used at checkout.
        </p>
      </form>
    </Card>
  );
}
