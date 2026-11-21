import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getGuestDetail } from "@/lib/admin";
import { formatUsd } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { GuestControls } from "@/components/admin/guest-controls";

export const metadata: Metadata = { title: "Guest · Admin" };

export default async function AdminGuestDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: raw } = await params;
  const guest = await getGuestDetail(decodeURIComponent(raw));
  if (!guest) notFound();

  const spent = guest.orders
    .filter((o) => o.status === "FULFILLED")
    .reduce((n, o) => n + o.totalCents, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users?filter=guests"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All users
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {guest.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            Guest checkout - no account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Guest</Badge>
          {guest.blocked && <Badge variant="destructive">Blocked</Badge>}
        </div>
      </div>

      {guest.registeredUserId && (
        <Card className="p-4 text-sm">
          This address also has a registered account.{" "}
          <Link
            href={`/admin/users/${guest.registeredUserId}`}
            className="underline"
          >
            Open the user
          </Link>
        </Card>
      )}

      {guest.blocked && (
        <Card className="border-destructive/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Blocked</h2>
            <span className="text-xs text-muted-foreground">
              {guest.blocked.createdAt.toLocaleString()}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {guest.blocked.note || "No reason was recorded."}
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Orders</div>
          <div className="text-lg font-semibold tabular-nums">
            {guest.orders.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Lifetime spend</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatUsd(spent)}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-medium">Controls</h2>
        <GuestControls
          email={guest.email}
          blocked={Boolean(guest.blocked)}
          note={guest.blocked?.note ?? null}
        />
      </Card>

      <div>
        <h2 className="mb-3 font-medium">Orders</h2>
        <div className="divide-y rounded-xl border">
          {guest.orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.orderNumber}`}
              className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/40"
            >
              <div>
                <div className="font-medium">{o.orderNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {o.createdAt.toLocaleDateString()} ·{" "}
                  {o.items.reduce((n, i) => n + i.quantity, 0)} key(s)
                </div>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={o.status} />
                <span className="tabular-nums">{formatUsd(o.totalCents)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
