"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { savePaymentSettings, type SettingsResult } from "@/app/actions/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save payment settings
    </Button>
  );
}

export function PaymentSettingsForm({
  maxPaymentLkr,
  usdEnabled,
  rate,
}: {
  /** Current limit in LKR (whole rupees), or null for none. */
  maxPaymentLkr: number | null;
  usdEnabled: boolean;
  /** Market rate, to show the limit in USD. */
  rate: number;
}) {
  const [state, action] = useActionState<SettingsResult | null, FormData>(savePaymentSettings, null);
  const [limitInput, setLimitInput] = useState(maxPaymentLkr === null ? "" : String(maxPaymentLkr));
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const lkr = Number(limitInput.replace(/,/g, ""));
  const validLimit = limitInput.trim() !== "" && Number.isFinite(lkr) && lkr > 0;

  return (
    <form action={action} className="space-y-5">
      {state && (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.ok ? state.message : state.error}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={fe.maxPayment ? true : undefined}>
        <FieldLabel htmlFor="maxPayment">Largest single payment (LKR)</FieldLabel>
        <Input
          id="maxPayment"
          name="maxPayment"
          inputMode="decimal"
          placeholder="No limit"
          value={limitInput}
          // Digits, commas and one decimal point only.
          onChange={(e) => setLimitInput(e.target.value.replace(/[^0-9.,]/g, ""))}
          maxLength={15}
          aria-invalid={fe.maxPayment ? true : undefined}
          className="sm:max-w-[calc(50%-0.5rem)]"
        />
        {fe.maxPayment ? (
          <FieldError>{fe.maxPayment}</FieldError>
        ) : (
          <FieldDescription className="text-xs">
            {validLimit
              ? `Checkouts over ${formatMoney(Math.round(lkr * 100), "LKR")} (about ${formatMoney(
                  Math.floor((lkr * 100) / rate),
                  "USD",
                )}) are refused before any keys are reserved. `
              : "Set this to your PayHere per-transaction limit. Empty = no limit. "}
            Bigger payments fail on PayHere&apos;s side and used to leave keys on hold.
          </FieldDescription>
        )}
      </Field>

      <label className="flex items-start gap-3 border-t pt-5 text-sm">
        <input
          type="checkbox"
          name="usdEnabled"
          defaultChecked={usdEnabled}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Accept USD payments</span>
          <span className="block text-xs text-muted-foreground">
            Shows &ldquo;International (USD)&rdquo; at checkout. Turn off to accept LKR only. Prices in USD
            are still shown on product pages.
          </span>
        </span>
      </label>

      <Save />
    </form>
  );
}
