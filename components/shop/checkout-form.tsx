"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { selectCartSubtotal, useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";

export function CheckoutForm({
  defaultEmail,
  emailLocked,
  mockMode,
}: {
  defaultEmail?: string | null;
  emailLocked: boolean;
  mockMode: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectCartSubtotal);

  const [email, setEmail] = useState(defaultEmail ?? "");
  const [currency, setCurrency] = useState<"LKR" | "USD">("LKR");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayRate = 300;
  const displayAmount =
    currency === "LKR" ? Math.round(subtotal * displayRate) : subtotal;

  if (!hydrated) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your cart is empty, so there is nothing to check out.
        </p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "sm" }), "mt-4")}
        >
          Browse products
        </Link>
      </div>
    );
  }

  async function pay() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailLocked ? undefined : email.trim() || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
          currency,
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        fields?: Record<string, string>;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      if (data.fields) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.url;
        for (const [name, value] of Object.entries(data.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } else if (data.url.startsWith("http")) {
        window.location.assign(data.url);
      } else {
        router.push(data.url);
      }
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="font-medium">Delivery email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your license keys are sent here immediately after payment.
          </p>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled={emailLocked}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            {emailLocked && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" />
                Using your account email.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Payment currency</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["LKR", "USD"] as const).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="currency"
                  value={option}
                  checked={currency === option}
                  onChange={() => setCurrency(option)}
                />
                {option === "LKR" ? "Sri Lanka (LKR)" : "International (USD)"}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Sandbox rate: 1 USD = {displayRate} LKR.
          </p>
        </Card>

        {mockMode && (
          <Alert>
            <AlertDescription>
              <strong>Test mode.</strong> PayHere isn&rsquo;t connected yet, so
              the next step is a simulated payment — no card required.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <h2 className="font-medium">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {l.name}
                  {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                </span>
                <span className="tabular-nums">
                  {formatMoney(
                    currency === "LKR"
                      ? Math.round(l.priceCents * l.quantity * displayRate)
                      : l.priceCents * l.quantity,
                    currency,
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(displayAmount, currency)}</span>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={pending || (!emailLocked && !email.trim())}
            onClick={pay}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mockMode ? "Continue to test payment" : "Pay with card"}
          </Button>
          <Link
            href="/cart"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mt-2 w-full",
            )}
          >
            Back to cart
          </Link>
        </Card>
      </div>
    </div>
  );
}
