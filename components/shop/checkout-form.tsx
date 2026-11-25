"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useCart } from "@/lib/cart-store";
import { useCartQuote } from "@/lib/use-cart-quote";
import { useHydrated } from "@/lib/use-hydrated";
import { cartIssues, issueLabel, type CartIssue } from "@/lib/cart-issues";
import type { CartQuote, CartQuoteLine } from "@/app/actions/pricing";
import { StockIssueDialog } from "@/components/shop/stock-issue-dialog";
import { warrantyLength } from "@/lib/warranty";
import { EMAIL_MAX, customerDetailsSchema, emailField, type CustomerDetails } from "@/lib/validation";
import { CustomerDetailsFields, type CustomerDetailsErrors } from "@/components/shop/customer-details-fields";
import { ReleaseAbandonedCheckout } from "@/components/shop/pending-checkout";
import { rememberPendingCheckout } from "@/lib/pending-checkout";
import { paymentLimitError, type PaymentLimits } from "@/lib/payment-limit";

/** Guests' details are remembered on this device only, for their next order. */
const DETAILS_KEY = "keysby-checkout-details";
const EMPTY_DETAILS: CustomerDetails = { firstName: "", lastName: "", phone: "", country: "Sri Lanka" };

function loadSavedDetails(): Partial<CustomerDetails> {
  try {
    const raw = window.localStorage.getItem(DETAILS_KEY);
    return raw ? (JSON.parse(raw) as Partial<CustomerDetails>) : {};
  } catch {
    return {};
  }
}

function withDefaults(...parts: (Partial<CustomerDetails> | null | undefined)[]): CustomerDetails {
  const out = { ...EMPTY_DETAILS };
  for (const p of parts) {
    if (!p) continue;
    for (const k of Object.keys(out) as (keyof CustomerDetails)[]) {
      if (typeof p[k] === "string" && p[k]) out[k] = p[k];
    }
  }
  return out;
}

export function CheckoutForm({
  defaultEmail,
  emailLocked,
  defaultCustomer,
  mockMode,
  usdEnabled = true,
  limits = { LKR: null, USD: null },
}: {
  defaultEmail?: string | null;
  emailLocked: boolean;
  /** Prefill for signed-in customers (account name, last order's phone). */
  defaultCustomer?: Partial<CustomerDetails> | null;
  mockMode: boolean;
  /** Offer USD as a payment currency (Admin -> Settings). */
  usdEnabled?: boolean;
  /** Largest single payment per currency; null = no limit. */
  limits?: PaymentLimits;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  // Live prices from the server (fixed LKR prices / admin exchange rate).
  const { quote, byId, loading, refresh } = useCartQuote(lines);
  const [dialogIssues, setDialogIssues] = useState<CartIssue[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const issues = cartIssues(lines, byId);
  const issueFor = (productId: string) => issues.find((i) => i.productId === productId);

  /** Re-check stock with the server; open the dialog if anything changed. */
  async function stockProblems(fresh: CartQuote | null): Promise<boolean> {
    if (!fresh) return false;
    const map = new Map<string, CartQuoteLine>(fresh.lines.map((l) => [l.productId, l]));
    const found = cartIssues(lines, map);
    if (found.length === 0) return false;
    setDialogIssues(found);
    setDialogOpen(true);
    return true;
  }

  const [email, setEmail] = useState(defaultEmail ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  // Lazy init runs on the client after hydration (this form renders a skeleton until then).
  const [customer, setCustomer] = useState<CustomerDetails>(() =>
    withDefaults(typeof window === "undefined" ? null : loadSavedDetails(), defaultCustomer),
  );
  const [customerErrors, setCustomerErrors] = useState<CustomerDetailsErrors>({});
  const [currency, setCurrency] = useState<"LKR" | "USD">("LKR");
  const [pending, setPending] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineTotal = (productId: string, qty: number) => {
    const q = byId.get(productId);
    if (!q) return null;
    const warranty = q.warranty ? (currency === "LKR" ? q.warranty.lkrCents : q.warranty.usdCents) : 0;
    return ((currency === "LKR" ? q.lkrCents : q.usdCents) + warranty) * qty;
  };
  const total = quote ? quote.totals[currency] : null;
  const limitError = total === null ? null : paymentLimitError(total, currency, limits);
  const currencies = usdEnabled ? (["LKR", "USD"] as const) : (["LKR"] as const);
  // Back from PayHere without paying: the hold was just released; let them try again.
  const onReturn = () => {
    setPending(false);
    void refresh();
  };
  const savings = quote
    ? quote.lines.reduce(
        (n, l) =>
          n +
          ((currency === "LKR" ? l.listLkrCents - l.lkrCents : l.listUsdCents - l.usdCents) *
            l.quantity),
        0,
      )
    : 0;

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
    const details = customerDetailsSchema.safeParse(customer);
    if (!details.success) {
      const errs: CustomerDetailsErrors = {};
      for (const issue of details.error.issues) {
        const key = issue.path[0] as keyof CustomerDetails;
        if (!errs[key]) errs[key] = issue.message;
      }
      setCustomerErrors(errs);
      setError("Please fill in your details above.");
      return;
    }
    setCustomerErrors({});
    if (!emailLocked) {
      const checked = emailField.safeParse(email);
      if (!checked.success) {
        setEmailError(checked.error.issues[0]?.message ?? "Enter a valid email address");
        setError("Please check your email address above.");
        return;
      }
    }
    if (limitError) {
      setError(limitError);
      return;
    }
    if (!agreed) {
      setError("Please tick the box to accept the terms and refund policy.");
      return;
    }
    try {
      window.localStorage.setItem(DETAILS_KEY, JSON.stringify(details.data));
    } catch {
      // Private mode etc.: just don't remember.
    }
    setPending(true);
    // Stock changes all the time: check right before paying, not with the
    // numbers from when the page loaded.
    if (await stockProblems(await refresh())) {
      setPending(false);
      return;
    }
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailLocked ? undefined : email.trim() || undefined,
          customer: details.data,
          acceptTerms: true,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            warrantyPlanId: l.warrantyPlanId ?? null,
          })),
          currency,
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        fields?: Record<string, string>;
        order?: { orderNumber: string; token: string };
        error?: string;
      };
      if (!res.ok || !data.url) {
        // 409 = an item sold out in the last few seconds: show what changed.
        if (res.status === 409 && (await stockProblems(await refresh()))) {
          setPending(false);
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      if (data.order) rememberPendingCheckout(data.order);
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
          <Field className="mt-4" data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="email" required={!emailLocked}>
              Email address
            </FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={emailLocked}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="you@example.com"
              maxLength={EMAIL_MAX}
              required
              aria-invalid={emailError ? true : undefined}
            />
            <FieldError>{emailError}</FieldError>
            {emailLocked && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" />
                Using your account email.
              </p>
            )}
          </Field>
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Your details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our payment provider (PayHere) needs these to process your card. We only use them for this order.
          </p>
          <div className="mt-4">
            <CustomerDetailsFields
              value={customer}
              onChange={(next) => {
                setCustomer(next);
                if (Object.keys(customerErrors).length) setCustomerErrors({});
              }}
              errors={customerErrors}
              disabled={pending}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Payment currency</h2>
          <div className={cn("mt-4 grid gap-3", currencies.length > 1 && "sm:grid-cols-2")}>
            {currencies.map((option) => (
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
            You pay exactly the total shown in the order summary.
          </p>
        </Card>

        {mockMode && (
          <Alert>
            <AlertDescription>
              <strong>Test mode.</strong> PayHere isn&rsquo;t connected yet, so
              the next step is a simulated payment - no card required.
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
                  {byId.get(l.productId)?.salePercent && (
                    <span className="ml-1.5 text-xs font-medium text-destructive">
                      -{byId.get(l.productId)!.salePercent}%
                    </span>
                  )}
                  {byId.get(l.productId)?.warranty && (
                    <span className="block text-xs">
                      {byId.get(l.productId)!.warranty!.name} warranty (
                      {warrantyLength(byId.get(l.productId)!.warranty!.days)})
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {!quote ? (
                    <Skeleton className="inline-block h-4 w-16 align-middle" />
                  ) : issueFor(l.productId) ? (
                    <span className="text-destructive">{issueLabel(issueFor(l.productId)!)}</span>
                  ) : (
                    formatMoney(lineTotal(l.productId, l.quantity) ?? 0, currency)
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          {savings > 0 && (
            <div className="mb-2 flex justify-between text-sm text-destructive">
              <span>You save</span>
              <span className="tabular-nums">{formatMoney(savings, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span className={cn("tabular-nums", loading && "opacity-60")}>
              {total === null ? (
                <Skeleton className="inline-block h-5 w-24 align-middle" />
              ) : (
                formatMoney(total, currency)
              )}
            </span>
          </div>
          {issues.length > 0 && (
            <p className="mt-2 text-xs text-destructive">
              Some items are out of stock or no longer available.
            </p>
          )}
          {limitError && <p className="mt-2 text-xs text-destructive">{limitError}</p>}

          <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms" target="_blank" className="text-foreground underline underline-offset-4">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/refund-policy" target="_blank" className="text-foreground underline underline-offset-4">
                refund and warranty policy
              </Link>
              . I understand keys are delivered instantly and should be activated straight away.
            </span>
          </label>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={
              pending || total === null || Boolean(limitError) || (!emailLocked && !email.trim())
            }
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
      <StockIssueDialog issues={dialogIssues} open={dialogOpen} onOpenChange={setDialogOpen} />
      <ReleaseAbandonedCheckout onReturn={onReturn} />
    </div>
  );
}
