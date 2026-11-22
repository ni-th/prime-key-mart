import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { hrefWith, param, type RawParams } from "@/lib/list-params";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ResolveClaimForm } from "@/components/admin/resolve-claim-form";
import { decryptSecret } from "@/lib/crypto";
import { secretText } from "@/lib/delivery";
import { warrantySummary } from "@/lib/warranty";
import { formatMoney } from "@/lib/money";
import { perKeyPaidCents } from "@/lib/warranty-claims";
import { CLAIM_REASONS, CLAIM_STATUS, type ClaimReason, type ClaimStatus } from "@/lib/warranty-claim-shared";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Key claims · Admin" };

const FILTERS = [
  { value: "", label: "Open" },
  { value: "REPLACED", label: "Replaced" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "REJECTED", label: "Not covered" },
  { value: "ALL", label: "All" },
];

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

export default async function WarrantyClaimsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const status = param(sp, "status");
  const active = FILTERS.some((f) => f.value === status) ? status : "";

  const [claims, openCount] = await Promise.all([
    prisma.warrantyClaim.findMany({
      where: active === "ALL" ? {} : { status: active || "OPEN" },
      // Open claims oldest first (fair queue); history newest first.
      orderBy: { createdAt: active ? "desc" : "asc" },
      take: 100,
      include: {
        key: true,
        replacementKey: true,
        orderItem: { include: { order: { select: { orderNumber: true, email: true, currency: true } } } },
      },
    }),
    prisma.warrantyClaim.count({ where: { status: "OPEN" } }),
  ]);
  const plain = (k: { secretCiphertext: string; secretIv: string; secretAuthTag: string }) =>
    secretText(decryptSecret({ ciphertext: k.secretCiphertext, iv: k.secretIv, authTag: k.secretAuthTag }));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/warranty"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Warranty plans
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Key claims</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers report keys that don&apos;t work, during the free check period after delivery or
          while their warranty runs. Check the key with your supplier if needed, then send a
          replacement, refund that key, or explain why it isn&apos;t covered.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={hrefWith("/admin/warranty/claims", sp, { status: f.value || null })}
            className={cn(buttonVariants({ variant: active === f.value ? "default" : "outline", size: "xs" }))}
          >
            {f.label}
            {f.value === "" && openCount > 0 ? ` (${openCount})` : ""}
          </Link>
        ))}
      </div>

      {claims.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {active ? "No claims here." : "No open claims."}
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((c) => {
            const order = c.orderItem.order;
            const cur = order.currency.toUpperCase();
            const paid = perKeyPaidCents(c.orderItem);
            return (
              <Card key={c.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.orderItem.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                        {order.orderNumber}
                      </Link>{" "}
                      · {order.email} · {when.format(c.createdAt)}
                    </div>
                  </div>
                  <Badge variant={c.status === "OPEN" ? "secondary" : "outline"}>
                    {CLAIM_STATUS[c.status as ClaimStatus] ?? c.status}
                  </Badge>
                </div>
                <dl className="grid gap-1.5 text-sm sm:grid-cols-[9rem_1fr]">
                  <dt className="text-muted-foreground">Problem</dt>
                  <dd>{CLAIM_REASONS[c.reason as ClaimReason] ?? c.reason}</dd>
                  <dt className="text-muted-foreground">Message</dt>
                  <dd className="whitespace-pre-line">{c.message ?? "None"}</dd>
                  <dt className="text-muted-foreground">Key</dt>
                  <dd className="font-mono text-xs break-all">{plain(c.key)}</dd>
                  <dt className="text-muted-foreground">Covered by</dt>
                  <dd>
                    {c.coverage === "FREE_CHECK"
                      ? "Free check period after delivery"
                      : `Warranty: ${warrantySummary(c.orderItem) ?? "-"}`}
                  </dd>
                  <dt className="text-muted-foreground">Key price paid</dt>
                  <dd>{formatMoney(paid, cur)}</dd>
                  {c.refundCents !== null && (
                    <>
                      <dt className="text-muted-foreground">Refunded</dt>
                      <dd>{formatMoney(c.refundCents, cur)}</dd>
                    </>
                  )}
                  {c.replacementKey && (
                    <>
                      <dt className="text-muted-foreground">Replacement</dt>
                      <dd className="font-mono text-xs break-all">{plain(c.replacementKey)}</dd>
                    </>
                  )}
                  {c.resolutionNote && (
                    <>
                      <dt className="text-muted-foreground">Sent to customer</dt>
                      <dd className="whitespace-pre-line">{c.resolutionNote}</dd>
                    </>
                  )}
                </dl>
                {c.status === "OPEN" && (
                  <ResolveClaimForm claimId={c.id} keyPaid={(paid / 100).toFixed(2)} currency={cur} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
