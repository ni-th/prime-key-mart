import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminSession, getUserDetail } from "@/lib/admin";
import { formatUsd } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { UserControls } from "@/components/admin/user-controls";

export const metadata: Metadata = { title: "User · Admin" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, admin] = await Promise.all([getUserDetail(id), getAdminSession()]);
  if (!user) notFound();

  const spent = user.orders
    .filter((o) => o.status === "FULFILLED")
    .reduce((n, o) => n + o.totalCents, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All users
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.name ?? user.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.email} · joined {user.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
            {user.role === "ADMIN" ? "Admin" : "Customer"}
          </Badge>
          {user.suspended && <Badge variant="destructive">Suspended</Badge>}
        </div>
      </div>

      {user.suspended && (
        <Card className="border-destructive/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Suspension</h2>
            <span className="text-xs text-muted-foreground">
              {user.suspendedAt ? user.suspendedAt.toLocaleString() : ""}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {user.suspensionNote || "No reason was recorded."}
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Orders</div>
          <div className="text-lg font-semibold tabular-nums">
            {user.orders.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Lifetime spend</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatUsd(spent)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">User ID</div>
          <div className="truncate font-mono text-xs">{user.id}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-medium">Controls</h2>
        <UserControls
          userId={user.id}
          role={user.role}
          suspended={user.suspended}
          isSelf={admin?.user.id === user.id}
        />
      </Card>

      <div>
        <h2 className="mb-3 font-medium">Orders</h2>
        {user.orders.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No orders from this user.
          </Card>
        ) : (
          <div className="divide-y rounded-xl border">
            {user.orders.map((o) => (
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
        )}
      </div>
    </div>
  );
}
