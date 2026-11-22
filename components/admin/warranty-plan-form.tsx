"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { saveWarrantyPlan } from "@/app/actions/warranty";
import type { FormResult } from "@/app/actions/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { warrantyLength, warrantyUsdCents, WARRANTY_MAX_PERCENT } from "@/lib/warranty";
import { cn } from "@/lib/utils";

export type WarrantyPlanValues = {
  id: string;
  name: string;
  description: string | null;
  days: number | null;
  percent: number;
  active: boolean;
  isDefault: boolean;
  recommended: boolean;
};

const EXAMPLE_PRICES = [999, 3999, 14999];
/** Quick picks for the length field. */
const DAY_PRESETS = [7, 14, 30, 90, 180, 365, 730];

function Hint({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  return children ? <p className="text-xs text-muted-foreground">{children}</p> : null;
}

function Submit({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {isEdit ? "Save changes" : "Create plan"}
    </Button>
  );
}

export function WarrantyPlanForm({ plan }: { plan?: WarrantyPlanValues }) {
  const [state, action] = useActionState<FormResult, FormData>(saveWarrantyPlan, { ok: false, error: "" });
  const fe = (!state.ok && state.fieldErrors) || {};
  const [lifetime, setLifetime] = useState(plan ? plan.days === null : false);
  const [days, setDays] = useState(plan?.days ? String(plan.days) : "30");
  const [percent, setPercent] = useState(plan ? String(plan.percent) : "15");
  const [isDefault, setIsDefault] = useState(plan?.isDefault ?? false);

  const pct = isDefault ? 0 : Number.parseFloat(percent || "0");
  const pctValid = Number.isFinite(pct) && pct >= 0 && pct <= WARRANTY_MAX_PERCENT;
  const daysNum = lifetime ? null : Number.parseInt(days, 10);

  return (
    <form action={action} className="space-y-6">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      {!state.ok && state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Plan name</Label>
          <Input id="name" name="name" defaultValue={plan?.name} placeholder="e.g. Premium" required maxLength={40} />
          <Hint error={fe.name}>Shown to customers, e.g. &quot;Premium, 1 year&quot;.</Hint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Short description (optional)</Label>
          <Input
            id="description"
            name="description"
            defaultValue={plan?.description ?? ""}
            placeholder="Free replacement if your key stops working"
            maxLength={120}
          />
          <Hint error={fe.description} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="days">Length (days)</Label>
          <Input
            id="days"
            name="days"
            type="number"
            min={1}
            max={3650}
            step={1}
            value={lifetime ? "" : days}
            onChange={(e) => setDays(e.target.value)}
            disabled={lifetime}
            placeholder={lifetime ? "Lifetime" : "30"}
          />
          {!lifetime && (
            <div className="flex flex-wrap gap-1">
              {DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(String(d))}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs",
                    String(d) === days ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {warrantyLength(d)}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="lifetime"
              checked={lifetime}
              onChange={(e) => setLifetime(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Lifetime (as long as the product is supported)
          </label>
          <Hint error={fe.days}>
            {!lifetime && daysNum && daysNum > 0 ? `Shown to customers as "${warrantyLength(daysNum)}".` : undefined}
          </Hint>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="percent">Price (% of the product price)</Label>
          <Input
            id="percent"
            name="percent"
            type="number"
            min={0}
            max={WARRANTY_MAX_PERCENT}
            step={0.1}
            value={isDefault ? "0" : percent}
            onChange={(e) => setPercent(e.target.value)}
            disabled={isDefault}
          />
          <Hint error={fe.percent}>
            {isDefault ? "The included plan is always free." : "Of the normal price, before any sale."}
          </Hint>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Included with every order (free)</span>
            <span className="block text-xs text-muted-foreground">
              Selected by default; customers can upgrade. Only one plan can be the included one.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="recommended"
            defaultChecked={plan?.recommended ?? false}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Mark as &quot;Most popular&quot;</span>
            <span className="block text-xs text-muted-foreground">Highlighted on product pages. Only one plan.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={plan?.active ?? true}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Active</span>
            <span className="block text-xs text-muted-foreground">
              Untick to stop offering it on every product (past orders keep theirs).
            </span>
          </span>
        </label>
      </Card>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="font-medium">Price preview</div>
        {pctValid ? (
          <ul className="mt-2 space-y-1 tabular-nums text-muted-foreground">
            {EXAMPLE_PRICES.map((cents) => {
              const w = warrantyUsdCents(cents, pct);
              return (
                <li key={cents}>
                  {formatMoney(cents, "USD")} product:{" "}
                  <span className="text-foreground">
                    {w === 0 ? "included free" : `+${formatMoney(w, "USD")} = ${formatMoney(cents + w, "USD")}`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">Enter a percentage from 0 to {WARRANTY_MAX_PERCENT}.</p>
        )}
      </div>

      <div className="flex gap-3">
        <Submit isEdit={Boolean(plan)} />
        <Link href="/admin/warranty" className={cn(buttonVariants({ variant: "ghost" }))}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
