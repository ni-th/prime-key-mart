"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Send } from "lucide-react";
import {
  saveAlertSettings,
  sendTestAlert,
  type AlertSettingsResult,
} from "@/app/actions/alerts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { EMAIL_MAX } from "@/lib/validation";

type Toggles = {
  alertLowStock: boolean;
  alertOutOfStock: boolean;
  alertFailedDelivery: boolean;
  alertPaymentProblem: boolean;
  alertNewOrder: boolean;
};

const TOGGLES: { name: keyof Toggles; label: string; hint: string }[] = [
  {
    name: "alertFailedDelivery",
    label: "Order not delivered",
    hint: "A customer paid but there were no keys, or the keys email failed. Most urgent.",
  },
  {
    name: "alertPaymentProblem",
    label: "Payment problems",
    hint: "Wrong amount paid, chargebacks, fake PayHere notifications, and Find my order being blocked after repeated failed attempts.",
  },
  {
    name: "alertOutOfStock",
    label: "Out of stock",
    hint: "A published product has no keys left.",
  },
  {
    name: "alertLowStock",
    label: "Low stock",
    hint: "A published product drops below its low stock level. Once per drop.",
  },
  {
    name: "alertNewOrder",
    label: "New orders and reviews",
    hint: "An email for every paid order, and for new reviews to approve (at most one an hour).",
  },
];

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save alert settings
    </Button>
  );
}

export function AlertSettingsForm({
  alertEmails,
  fallbackEmail,
  lowStockThreshold,
  toggles,
}: {
  alertEmails: string;
  /** ADMIN_EMAIL, used when no alert emails are set. */
  fallbackEmail: string | null;
  lowStockThreshold: number;
  toggles: Toggles;
}) {
  const [state, action] = useActionState<AlertSettingsResult | null, FormData>(
    saveAlertSettings,
    null,
  );
  const [test, setTest] = useState<AlertSettingsResult | null>(null);
  const [testing, startTest] = useTransition();
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const shown = test ?? state;

  return (
    <form action={action} onSubmit={() => setTest(null)} className="space-y-5">
      {shown && (
        <Alert variant={shown.ok ? "default" : "destructive"}>
          <AlertDescription>{shown.ok ? shown.message : shown.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field data-invalid={fe.alertEmails ? true : undefined}>
          <FieldLabel htmlFor="alertEmails">Send alerts to</FieldLabel>
          <Input
            id="alertEmails"
            name="alertEmails"
            defaultValue={alertEmails}
            placeholder={fallbackEmail ?? "you@example.com"}
            // Up to 10 addresses (checked on the server).
            maxLength={10 * (EMAIL_MAX + 2)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={fe.alertEmails ? true : undefined}
          />
          {fe.alertEmails ? (
            <FieldError>{fe.alertEmails}</FieldError>
          ) : (
            <FieldDescription className="text-xs">
              {fallbackEmail
                ? `Up to 10, separated by commas. Empty = ${fallbackEmail} (ADMIN_EMAIL).`
                : "Up to 10, separated by commas."}
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={fe.lowStockThreshold ? true : undefined}>
          <FieldLabel htmlFor="lowStockThreshold" required>
            Low stock level
          </FieldLabel>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            required
            defaultValue={lowStockThreshold}
            aria-invalid={fe.lowStockThreshold ? true : undefined}
          />
          {fe.lowStockThreshold ? (
            <FieldError>{fe.lowStockThreshold}</FieldError>
          ) : (
            <FieldDescription className="text-xs">
              Alert when fewer keys than this are left (1 to 1000). Products can override it.
            </FieldDescription>
          )}
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Email me about</legend>
        {TOGGLES.map((t) => (
          <label key={t.name} className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name={t.name}
              defaultChecked={toggles[t.name]}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Save />
        <Button
          type="button"
          variant="outline"
          disabled={testing}
          onClick={() =>
            startTest(async () => {
              setTest(await sendTestAlert());
            })
          }
        >
          {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send test email
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The test goes to the saved recipients, so save changes first.
      </p>
    </form>
  );
}
