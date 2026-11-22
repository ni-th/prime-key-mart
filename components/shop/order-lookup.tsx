"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { ReportPaymentIssue } from "@/components/shop/report-payment-issue";
import { canReportPaymentIssue } from "@/lib/payment-issue";
import { KeyList } from "@/components/shop/key-list";
import { lookupOrderAction, type LookupState } from "@/app/actions/order-lookup";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Find my order
    </Button>
  );
}

export function OrderLookup() {
  const [state, formAction] = useActionState<LookupState, FormData>(
    lookupOrderAction,
    { status: "idle" },
  );

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <form action={formAction} className="space-y-4">
          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="orderNumber">Order number</Label>
            <Input
              id="orderNumber"
              name="orderNumber"
              placeholder="KM-XXXXXX"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email used at checkout</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <SubmitButton />
        </form>
      </Card>

      {state.status === "ok" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{state.order.orderNumber}</div>
              <div className="text-sm text-muted-foreground">
                {state.order.email}
              </div>
            </div>
            <OrderStatusBadge status={state.order.status} />
          </div>

          <Card className="p-5">
            <ul className="space-y-2 text-sm">
              {state.order.items.map((item) => (
                <li
                  key={item.productName}
                  className="flex justify-between gap-3"
                >
                  <span className="text-muted-foreground">
                    {item.productName}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(item.unitPriceCents * item.quantity, state.order.currency.toUpperCase())}
                  </span>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(state.order.totalCents, state.order.currency.toUpperCase())}
              </span>
            </div>
          </Card>

          {state.order.status === "FULFILLED" ? (
            <div className="space-y-3">
              <h2 className="font-medium">Your license keys</h2>
              <KeyList groups={state.order.keyGroups} />
            </div>
          ) : (
            <Card className="space-y-4 p-5 text-sm text-muted-foreground">
              <p>
                {state.order.status === "PAID"
                  ? "Your payment was received and your keys are being prepared. We'll email them shortly."
                  : state.order.status === "REFUNDED"
                    ? "This order was refunded."
                    : state.order.status === "FAILED"
                      ? "The payment for this order didn't go through, so no payment was taken."
                      : "We haven't received a payment for this order, so there are no keys to show yet."}
              </p>
              {canReportPaymentIssue(state.order.status) && (
                <ReportPaymentIssue
                  orderNumber={state.order.orderNumber}
                  email={state.order.email}
                  alreadyReported={state.order.reported}
                  closedMessage={state.order.closedMessage}
                  canFollowUp={state.order.canFollowUp}
                />
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
