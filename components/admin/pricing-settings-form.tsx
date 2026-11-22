"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { savePricingSettings, type SettingsResult } from "@/app/actions/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save settings
    </Button>
  );
}

/** Same rounding as lib/pricing.ts calculatedLkrCents (whole rupees). */
function previewLkr(usd: number, rate: number, margin: number) {
  return Math.round(usd * rate * (1 + margin / 100)) * 100;
}

export function PricingSettingsForm({
  rate,
  margin,
  rateMin,
  rateMax,
  marginMax,
  fee,
  feeMax,
}: {
  rate: number;
  margin: number;
  fee: number;
  feeMax: number;
  rateMin: number;
  rateMax: number;
  marginMax: number;
}) {
  const [state, action] = useActionState<SettingsResult | null, FormData>(
    savePricingSettings,
    null,
  );
  const [rateInput, setRateInput] = useState(String(rate));
  const [marginInput, setMarginInput] = useState(String(margin));
  const [feeInput, setFeeInput] = useState(String(fee));
  const f = Number.parseFloat(feeInput || "0");
  const feeValid = Number.isFinite(f) && f >= 0 && f <= feeMax;
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  const r = Number.parseFloat(rateInput);
  const m = Number.parseFloat(marginInput || "0");
  const valid = Number.isFinite(r) && r >= rateMin && r <= rateMax && Number.isFinite(m) && m >= 0 && m <= marginMax;

  return (
    <form action={action} className="space-y-5">
      {state && (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.ok ? state.message : state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rate">Market rate (LKR per 1 USD)</Label>
          <Input
            id="rate"
            name="rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={rateMin}
            max={rateMax}
            required
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            aria-invalid={fe.rate ? true : undefined}
          />
          <p className={fe.rate ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {fe.rate ?? `Today's rate, e.g. 299.50. Allowed: ${rateMin}-${rateMax}.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="margin">Safety margin (%)</Label>
          <Input
            id="margin"
            name="margin"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={marginMax}
            value={marginInput}
            onChange={(e) => setMarginInput(e.target.value)}
            aria-invalid={fe.margin ? true : undefined}
          />
          <p className={fe.margin ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {fe.margin ?? "Added on top of the rate to cover card fees and rate changes. 2-3% is typical."}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="font-medium">Preview</div>
        {valid ? (
          <ul className="mt-2 space-y-1 text-muted-foreground tabular-nums">
            <li>
              Effective rate: <span className="text-foreground">{(r * (1 + m / 100)).toFixed(2)} LKR</span> per USD
            </li>
            {[10, 39.99, 99].map((usd) => (
              <li key={usd}>
                {formatMoney(usd * 100, "USD")} product ={" "}
                <span className="text-foreground">{formatMoney(previewLkr(usd, r, m), "LKR")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">Enter a valid rate and margin to see example prices.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Only products without a fixed LKR price use this. Orders already placed keep the
          price they were charged.
        </p>
      </div>

      <div className="space-y-1.5 border-t pt-5">
        <Label htmlFor="fee">Payment gateway fee (%)</Label>
        <Input
          id="fee"
          name="fee"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={feeMax}
          value={feeInput}
          onChange={(e) => setFeeInput(e.target.value)}
          aria-invalid={fe.fee ? true : undefined}
          className="sm:max-w-[calc(50%-0.5rem)]"
        />
        <p className={fe.fee ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {fe.fee ??
            (feeValid && f > 0
              ? `PayHere keeps ${f}% of each payment, e.g. ${formatMoney(Math.round(10000 * f), "LKR")} of a LKR 10,000 order. `
              : "The percent PayHere keeps from each payment (see your PayHere plan). ")}
          Only used to calculate your profit; customers never see it or pay extra.
        </p>
      </div>

      <Save />
    </form>
  );
}
