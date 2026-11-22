"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, PhoneCall, ShieldCheck, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { createWarrantyClaim, type ClaimResult } from "@/app/actions/warranty-claims";
import { requestActivation } from "@/app/actions/activation";
import { ACTIVATION_REPLY_TIME, formatActivationId } from "@/lib/delivery";
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
      <p className="text-xs text-muted-foreground">
        Lost account access or a forgotten password, sharing the key, or buying the wrong edition
        isn&apos;t covered.{" "}
        <Link href="/legal/refund-policy" target="_blank" className="underline underline-offset-4">
          What&apos;s covered
        </Link>
      </p>
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

/** An account (username + password) instead of a key. Both hidden until the eye is tapped. */
function AccountDetails({ account }: { account: { username: string; password: string } }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Username</span>
        <CopyKey value={account.username} what="Username" />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Password</span>
        <CopyKey value={account.password} hide="full" what="Password" />
      </div>
    </div>
  );
}

/**
 * Phone activation: Confirmation IDs we've sent, the request waiting for one,
 * and the form to send a new Installation ID.
 */
function Activation({
  orderNumber,
  token,
  keyId,
  activation,
}: {
  orderNumber: string;
  token: string | null;
  keyId: string;
  activation: NonNullable<OrderKeyItem["keys"][number]["activation"]>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reqs = activation.requests;
  const waiting = reqs.find((r) => r.status === "OPEN");
  const doneList = reqs.filter((r) => r.status === "DONE");
  const last = reqs[reqs.length - 1];
  const canRequest = !waiting && !sent && activation.used < activation.limit;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <PhoneCall className="size-3.5" />
        Phone activation
      </div>
      {doneList.map((r) => (
        <div key={r.id} className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Confirmation ID for Installation ID ending {r.installationId.slice(-7)}
          </div>
          <CopyKey value={formatActivationId(r.confirmationId ?? "")} size="sm" hide="none" what="Confirmation ID" />
        </div>
      ))}
      {waiting || sent ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {sent ?? `We're getting your Confirmation ID, ${ACTIVATION_REPLY_TIME}. We'll email it to you.`}
        </p>
      ) : last?.status === "REJECTED" ? (
        <p className="text-xs text-muted-foreground">
          We couldn&apos;t activate with your last Installation ID{last.note ? `: ${last.note}` : "."}
        </p>
      ) : doneList.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Enter the key in the software and choose phone activation. When it shows an Installation ID,
          send it here and we&apos;ll reply with the Confirmation ID.
        </p>
      ) : null}

      {open ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await requestActivation({ orderNumber, token, keyId, installationId: value });
              if (!r.ok) setError(r.error);
              else {
                setSent(r.message);
                setOpen(false);
                setValue("");
                router.refresh();
              }
            });
          }}
        >
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Label htmlFor={`iid-${keyId}`}>Installation ID</Label>
          <Textarea
            id={`iid-${keyId}`}
            rows={2}
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="1234567 1234567 1234567 1234567 1234567 1234567 1234567 1234567 1234567"
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            Type all 9 groups exactly as shown. Spaces or dashes are fine.
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Send Installation ID
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : canRequest ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {doneList.length > 0 ? "Reinstalled? Get a new Confirmation ID" : "Get confirmation ID"}
        </Button>
      ) : !waiting && !sent ? (
        <p className="text-xs text-muted-foreground">
          You&apos;ve used all activation requests for this key. Reply to your order email and we&apos;ll help.
        </p>
      ) : null}
    </div>
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
    k.cover?.kind === "FREE_CHECK" && !lastClaim ? (
      k.cover.endsAt ? (
        <p className="text-xs text-muted-foreground">
          Check it now: you can report a problem until{" "}
          {/* Local time differs from the server's, so the client renders its own. */}
          <span suppressHydrationWarning>{coverEnd.format(new Date(k.cover.endsAt))}</span>.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The check period starts when we send your Confirmation ID.
        </p>
      )
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
                {k.isReplacement && (
                  <div className="text-xs text-muted-foreground">
                    {k.account ? "Replacement account" : "Replacement key"}
                  </div>
                )}
                {k.account ? <AccountDetails account={k.account} /> : <CopyKey value={k.value} />}
                {k.activation && (
                  <Activation orderNumber={item.orderNumber} token={token} keyId={k.id} activation={k.activation} />
                )}
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
          {item.steps.length > 0 && (
            <details className="group rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <summary className="cursor-pointer text-xs font-medium">How to activate</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                {item.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </details>
          )}
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
