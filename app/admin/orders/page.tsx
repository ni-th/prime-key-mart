import type { Metadata } from "next";
import Link from "next/link";
import { ORDER_SORTS, searchAdminOrders } from "@/lib/admin";
import {
  dateParam,
  hrefWith,
  oneOf,
  pageParam,
  param,
  type RawParams,
} from "@/lib/list-params";
import {
  ListClear,
  ListDateRange,
  ListSearch,
  ListSelect,
} from "@/components/admin/list-controls";
import { ListPagination } from "@/components/admin/list-pagination";
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
  { value: "PAID", label: "Needs action" },
  { value: "PENDING", label: "Pending" },
  { value: "FULFILLED", label: "Delivered" },
  { value: "EXPIRED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const status = param(sp, "status");
  const active = FILTERS.some((f) => f.value === status) ? status : "";
  const q = param(sp, "q");
  const from = dateParam(param(sp, "from"));
  const to = dateParam(param(sp, "to"));
  const sort = oneOf(param(sp, "sort"), ORDER_SORTS, "newest");

  const { orders, total, page, pageSize } = await searchAdminOrders({
    q: q || undefined,
    status: active || undefined,
    from,
    to,
    sort,
    page: pageParam(sp),
  });
  const filtered = Boolean(q || active || from || to);
  const pagination = (
    <ListPagination
      path="/admin/orders"
      params={sp}
      page={page}
      pageSize={pageSize}
      total={total}
    />
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={hrefWith("/admin/orders", sp, { status: f.value || null })}
            scroll={false}
            aria-current={active === f.value ? "true" : undefined}
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

      <div className="flex flex-wrap items-center gap-2">
        <ListSearch placeholder="Order no., email or product..." />
        <ListDateRange />
        <ListSelect
          param="sort"
          label="Sort"
          className="w-44"
          options={[
            { value: "", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "total-desc", label: "Total: high to low" },
            { value: "total-asc", label: "Total: low to high" },
          ]}
        />
        <ListClear keys={["q", "status", "from", "to", "sort"]} />
      </div>

      {pagination}

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
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {filtered ? "No orders match these filters." : "No orders yet."}
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

      {total > pageSize && pagination}
    </div>
  );
}
