import type { Metadata } from "next";
import Link from "next/link";
import { getAdminOrders } from "@/lib/admin";
import { formatMoney } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";

export const metadata: Metadata = { title: "Orders · Admin" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "FULFILLED", label: "Delivered" },
  { value: "EXPIRED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.some((f) => f.value === status) ? status : "";
  const orders = await getAdminOrders(active || undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/orders?status=${f.value}` : "/admin/orders"}
            className={cn(
              buttonVariants({
                variant: active === f.value ? "default" : "outline",
                size: "xs",
              }),
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Keys</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No orders.
                </TableCell>
              </TableRow>
            )}
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/admin/orders/${o.orderNumber}`}
                    className="font-medium hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                  {o.email}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {o.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {o.items.reduce((n, i) => n + i.quantity, 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(o.totalCents, o.currency.toUpperCase())}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={o.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
