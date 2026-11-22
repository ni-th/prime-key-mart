import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LinkOrdersCard } from "@/components/account/link-orders-card";
import { syncGuestOrders } from "@/lib/account-link";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string; n?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  // Pick up guest orders (automatic once the email is confirmed).
  const guest = await syncGuestOrders(user);

  const [orders, keysOwned] = await Promise.all([
    getUserOrders(userId),
    prisma.licenseKey.count({
      // Keys replaced under warranty don't count; their replacement does.
      where: { status: "SOLD", replacedAt: null, orderItem: { order: { userId } } },
    }),
  ]);
  const linkedNow = sp.link === "done" ? Number(sp.n) || 0 : 0;

  const delivered = orders.filter((o) => o.status === "FULFILLED").length;
  const recent = orders.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      {sp.link === "done" && (
        <Alert>
          <AlertDescription>
            {linkedNow > 0
              ? `Email confirmed. We added ${linkedNow} order${linkedNow === 1 ? "" : "s"} to your account.`
              : "Email confirmed. Future orders placed with this email will appear here automatically."}
          </AlertDescription>
        </Alert>
      )}
      {sp.link === "invalid" && (
        <Alert variant="destructive">
          <AlertDescription>
            That confirmation link is invalid or has expired. Please request a new one.
          </AlertDescription>
        </Alert>
      )}
      {guest.linked > 0 && (
        <Alert>
          <AlertDescription>
            We added {guest.linked} new order{guest.linked === 1 ? "" : "s"} placed with your email.
          </AlertDescription>
        </Alert>
      )}
      {guest.waiting > 0 && <LinkOrdersCard count={guest.waiting} email={user.email} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-2xl font-semibold">{orders.length}</div>
          <div className="text-sm text-muted-foreground">Orders</div>
        </Card>
        <Card className="p-5">
          <div className="text-2xl font-semibold">{delivered}</div>
          <div className="text-sm text-muted-foreground">Delivered</div>
        </Card>
        <Card className="p-5">
          <div className="text-2xl font-semibold">{keysOwned}</div>
          <Link href="/account/keys" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            License keys
          </Link>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent orders</h2>
          <Link
            href="/account/orders"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            You haven&rsquo;t placed any orders yet.
            <div>
              <Link
                href="/products"
                className={cn(buttonVariants({ size: "sm" }), "mt-4")}
              >
                Browse products
              </Link>
            </div>
          </Card>
        ) : (
          <div className="divide-y rounded-xl border">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.orderNumber}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40"
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
                  <span className="tabular-nums">{formatMoney(o.totalCents, o.currency.toUpperCase())}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
