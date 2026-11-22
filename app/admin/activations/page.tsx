import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hrefWith, param, type RawParams } from "@/lib/list-params";
import { ACTIVATION_LIMIT, ACTIVATION_REPLY_TIME, formatActivationId, secretText } from "@/lib/delivery";
import { buttonVariants, Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyKey } from "@/components/shop/key-list";
import { AnswerActivationForm } from "@/components/admin/answer-activation-form";
import { allowExtraActivation } from "@/app/actions/activation";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activations · Admin" };

const FILTERS = [
  { value: "", label: "Open" },
  { value: "DONE", label: "Sent" },
  { value: "REJECTED", label: "Couldn't activate" },
  { value: "ALL", label: "All" },
];

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Waiting",
  DONE: "Sent",
  REJECTED: "Couldn't activate",
};

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

export default async function ActivationsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const status = param(sp, "status");
  const active = FILTERS.some((f) => f.value === status) ? status : "";

  const [requests, openCount] = await Promise.all([
    prisma.activationRequest.findMany({
      where: active === "ALL" ? {} : { status: active || "OPEN" },
      // Open requests oldest first (fair queue); history newest first.
      orderBy: { createdAt: active ? "desc" : "asc" },
      take: 100,
      include: {
        key: {
          include: {
            activations: { select: { status: true } },
            orderItem: {
              select: { productName: true, order: { select: { orderNumber: true, email: true } } },
            },
          },
        },
      },
    }),
    prisma.activationRequest.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Phone activations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers send the Installation ID their software shows. Get the Confirmation ID (Microsoft&apos;s
          phone activation line or your supplier) and send it back. Customers are told: {ACTIVATION_REPLY_TIME}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={hrefWith("/admin/activations", sp, { status: f.value || null })}
            className={cn(buttonVariants({ variant: active === f.value ? "default" : "outline", size: "xs" }))}
          >
            {f.label}
            {f.value === "" && openCount > 0 ? ` (${openCount})` : ""}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {active ? "Nothing here." : "No open requests."}
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const item = r.key.orderItem;
            const order = item?.order;
            const limit = ACTIVATION_LIMIT + r.key.extraActivations;
            const used = r.key.activations.filter((a) => a.status !== "REJECTED").length;
            const key = secretText(
              decryptSecret({ ciphertext: r.key.secretCiphertext, iv: r.key.secretIv, authTag: r.key.secretAuthTag }),
            );
            return (
              <Card key={r.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{item?.productName ?? "Unknown product"}</div>
                    {order && (
                      <div className="text-xs text-muted-foreground">
                        <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                          {order.orderNumber}
                        </Link>{" "}
                        · {order.email} · {when.format(r.createdAt)}
                      </div>
                    )}
                  </div>
                  <Badge variant={r.status === "OPEN" ? "secondary" : "outline"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
                <dl className="grid items-center gap-1.5 text-sm sm:grid-cols-[9rem_1fr]">
                  <dt className="text-muted-foreground">Installation ID</dt>
                  <dd>
                    <CopyKey value={formatActivationId(r.installationId)} size="sm" hide="none" what="Installation ID" />
                  </dd>
                  <dt className="text-muted-foreground">Key</dt>
                  <dd>
                    <CopyKey value={key} size="sm" what="Key" />
                  </dd>
                  {r.confirmationId && (
                    <>
                      <dt className="text-muted-foreground">Confirmation ID</dt>
                      <dd className="font-mono text-xs">{formatActivationId(r.confirmationId)}</dd>
                    </>
                  )}
                  {r.note && (
                    <>
                      <dt className="text-muted-foreground">Our message</dt>
                      <dd className="whitespace-pre-line">{r.note}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Requests used</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <span>
                      {used} of {limit}
                    </span>
                    {used >= limit && (
                      <form action={allowExtraActivation}>
                        <input type="hidden" name="keyId" value={r.keyId} />
                        <Button type="submit" size="xs" variant="outline">
                          Allow one more
                        </Button>
                      </form>
                    )}
                  </dd>
                </dl>
                {r.resolvedAt && (
                  <p className="text-xs text-muted-foreground">
                    Answered {when.format(r.resolvedAt)}
                    {r.resolvedBy ? ` by ${r.resolvedBy}` : ""}
                  </p>
                )}
                {r.status === "OPEN" && <AnswerActivationForm requestId={r.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
