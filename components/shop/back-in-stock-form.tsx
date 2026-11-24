"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeBackInStock, type NotifyState } from "@/app/actions/stock-notify";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
      Notify me
    </Button>
  );
}

/** Shown instead of the buy buttons when a product is out of stock. */
export function BackInStockForm({ productId }: { productId: string }) {
  const [state, formAction] = useActionState<NotifyState, FormData>(subscribeBackInStock, {
    status: "idle",
  });

  if (state.status === "subscribed") {
    return (
      <div className="flex gap-2 rounded-lg border p-4 text-sm">
        <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
        <p>
          You&apos;re on the list. We&apos;ll email <strong>{state.email}</strong> as soon as it&apos;s back
          in stock.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border p-4">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor="restock-email" className="text-sm font-medium">
        Get an email when it&apos;s back in stock
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="restock-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="h-10 sm:flex-1"
        />
        <SubmitButton />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <p className="text-xs text-muted-foreground">One email, only for this product. No newsletter.</p>
    </form>
  );
}
