"use client";

import Link from "next/link";
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
  type OrderKeyItem,
} from "@/lib/warranty-claim-shared";
import { cn } from "@/lib/utils";

const orderDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const coverEnd = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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

/** Small line under a key: the claim link, or where its claim stands. */
function KeyStatus({
  k,
  done,
  open,
  onOpen,
}: {
  k: OrderKeyItem["keys"][number];
  done: string | undefined;
  open: boolean;
  onOpen: () => void;
}) {
  if (done) return <p className="text-xs text-success">{done}</p>;
  if (k.claim?.status === "OPEN") {
    return (
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        Claim {CLAIM_STATUS.OPEN.toLowerCase()}
      </p>
    );
  }
  const lastClaim =
    k.claim && k.claim.status !== "REPLACED" ? (
      <p className="flex gap-1.5 text-xs text-muted-foreground">
        <ShieldX className="mt-px size-3.5 shrink-0" />
        <span>
          Last claim: {CLAIM_STATUS[k.claim.status]}
          {k.claim.note ? ` - ${k.claim.note}` : ""}
        </span>
      </p>
    ) : null;
  // Keys without a (running) warranty: say how long the free check lasts.
  const freeCheck =
    k.cover?.kind === "FREE_CHECK" && k.cover.endsAt && !lastClaim ? (
      <p className="text-xs text-muted-foreground">
        Check it now: you can report a problem until{" "}
        {/* Local time differs from the server's, so the client renders its own. */}
        <span suppressHydrationWarning>{coverEnd.format(new Date(k.cover.endsAt))}</span>.
      </p>
    ) : null;
  const claimLink =
    k.cover && !open ? (
      <button type="button" onClick={onOpen} className="shrink-0 text-xs font-medium text-primary hover:underline">
        Key not working?
      </button>
    ) : null;
  if (!lastClaim && !claimLink) return null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      {lastClaim ?? freeCheck ?? <span />}
      {claimLink}
    </div>
  );
}

/**
 * The customer's delivered keys, one card per product. Keys are hidden until
 * the eye is tapped. Products with a warranty show it in the heading. Every
 * key that's still covered (warranty, or the free check period after
 * delivery) has a "Key not working?" link under it.
 */
export function OrderKeys({
  token,
  items,
  showOrder = false,
  emptyText,
}: {
  /** Signed order link token (guests); null when signed in. */
  token: string | null;
  items: OrderKeyItem[];
  /** Show which order each product came from (the "My keys" page). */
  showOrder?: boolean;
  /** Shown when there are no keys; nothing is rendered without it. */
  emptyText?: string;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const delivered = items.filter((i) => i.keys.length > 0);
  if (delivered.length === 0) {
    return emptyText ? (
      <Card className="p-8 text-center text-sm text-muted-foreground">{emptyText}</Card>
    ) : null;
  }
  const anyCover = delivered.some((i) => i.warrantyName || i.keys.some((k) => k.cover));

  return (
    <div className="space-y-4">
      {delivered.map((item) => (
        <Card key={item.itemId} className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div>
              <div className="font-medium">{item.productName}</div>
              {showOrder && (
                <Link
                  href={`/account/orders/${item.orderNumber}`}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Order {item.orderNumber} · {orderDate.format(new Date(item.orderedAt))}
                </Link>
              )}
            </div>
            {item.summary && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  item.active ? "text-success" : "text-muted-foreground",
                )}
              >
                {item.active ? <ShieldCheck className="size-3.5" /> : <ShieldX className="size-3.5" />}
                {item.active ? item.summary : `Warranty ended (${item.summary})`}
              </span>
            )}
          </div>
          <ul className="space-y-3">
            {item.keys.map((k) => (
              <li key={k.id} className="space-y-1.5">
                {k.isReplacement && <div className="text-xs text-muted-foreground">Replacement key</div>}
                <CopyKey value={k.value} />
                <KeyStatus
                  k={k}
                  done={done[k.id]}
                  open={openKey === k.id}
                  onOpen={() => setOpenKey(k.id)}
                />
                {openKey === k.id && (
                  <ClaimForm
                    orderNumber={item.orderNumber}
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
        </Card>
      ))}
      {anyCover && (
        <p className="text-xs text-muted-foreground">
          Activate your keys as soon as you get them. If one doesn&apos;t work, use the link under it
          while it&apos;s covered: we check each report and email you a replacement or a refund for that
          key.
        </p>
      )}
    </div>
  );
}
