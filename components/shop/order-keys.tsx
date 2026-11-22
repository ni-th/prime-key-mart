"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { createWarrantyClaim, type ClaimResult } from "@/app/actions/warranty-claims";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyKey } from "@/components/shop/key-list";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CLAIM_REASONS,
  CLAIM_STATUS,
  type ClaimReason,
  type WarrantyItemView,
} from "@/lib/warranty-claim-shared";
import { cn } from "@/lib/utils";

function ClaimForm({
  orderNumber,
  token,
  keyId,
  onDone,
  onCancel,
}: {
  orderNumber: string;
  token: string | null;
  keyId: string;
  onDone: (r: ClaimResult) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<ClaimReason>("NOT_ACTIVATING");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-2 space-y-3 rounded-lg border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createWarrantyClaim({ orderNumber, token, keyId, reason, message });
          if (r.ok) onDone(r);
          else setError(r.error);
        });
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">What&apos;s wrong?</legend>
        {(Object.keys(CLAIM_REASONS) as ClaimReason[]).map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`reason-${keyId}`}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-4"
            />
            {CLAIM_REASONS[r]}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`claim-msg-${keyId}`}>Details (optional)</Label>
        <Textarea
          id={`claim-msg-${keyId}`}
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. The exact error message, and when it stopped working."
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Send claim
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Warranty status for each delivered item, with "Key stopped working?" on
 * keys that are still covered. Shown on the customer's order page.
 */
export function WarrantyClaims({
  orderNumber,
  token,
  items,
}: {
  orderNumber: string;
  token: string | null;
  items: WarrantyItemView[];
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  if (items.length === 0) return null;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck className="size-5 text-primary" />
        Warranty
      </div>
      {items.map((item) => (
        <div key={item.itemId} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{item.productName}</span>
            <span className={cn("text-xs", item.active ? "text-success" : "text-muted-foreground")}>
              {item.active ? item.summary : `Warranty ended (${item.summary})`}
            </span>
          </div>
          <ul className="space-y-2">
            {item.keys.map((k) => (
              <li key={k.id} className="rounded-lg border p-3 text-sm">
                {k.isReplacement && (
                  <div className="mb-1.5 text-xs text-muted-foreground">Replacement key</div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-56 flex-1">
                    <CopyKey value={k.value} size="sm" />
                  </div>
                  {done[k.id] ? null : k.claim?.status === "OPEN" ? (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Claim {CLAIM_STATUS.OPEN.toLowerCase()}
                    </span>
                  ) : item.active && openKey !== k.id ? (
                    <button
                      type="button"
                      onClick={() => setOpenKey(k.id)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Key stopped working?
                    </button>
                  ) : null}
                </div>
                {k.claim && k.claim.status !== "OPEN" && k.claim.status !== "REPLACED" && (
                  <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                    <ShieldX className="size-3.5 shrink-0" />
                    <span>
                      Last claim: {CLAIM_STATUS[k.claim.status]}
                      {k.claim.note ? ` - ${k.claim.note}` : ""}
                    </span>
                  </div>
                )}
                {done[k.id] && <p className="mt-2 text-xs text-success">{done[k.id]}</p>}
                {openKey === k.id && (
                  <ClaimForm
                    orderNumber={orderNumber}
                    token={token}
                    keyId={k.id}
                    onCancel={() => setOpenKey(null)}
                    onDone={(r) => {
                      setOpenKey(null);
                      setDone((d) => ({ ...d, [k.id]: r.ok ? r.message : "" }));
                      router.refresh();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        A warranty covers keys that stop working through no fault of yours. We check each claim and
        send a replacement (or a refund) by email.
      </p>
    </Card>
  );
}
