import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminDiscounts } from "@/lib/admin";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DiscountStatusBadge } from "@/components/admin/discount-status-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Discounts · Admin" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

function schedule(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return "No end date";
  if (startsAt && endsAt) return `${dateFormat.format(startsAt)} - ${dateFormat.format(endsAt)}`;
  if (startsAt) return `From ${dateFormat.format(startsAt)}`;
  return `Until ${dateFormat.format(endsAt!)}`;
}

export default async function AdminDiscountsPage() {
  const discounts = await getAdminDiscounts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales lower prices for everyone. When sales overlap, the biggest one applies.
          </p>
        </div>
        <Link href="/admin/discounts/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4" />
          New sale
        </Link>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale</TableHead>
              <TableHead className="text-right">Off</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Schedule (Sri Lanka time)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No sales yet.
                </TableCell>
              </TableRow>
            )}
            {discounts.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link href={`/admin/discounts/${d.id}`} className="font-medium hover:underline">
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{d.percent}%</TableCell>
                <TableCell className="text-muted-foreground">
                  {d.scope === "ALL"
                    ? "Every product"
                    : d.scope === "CATEGORIES"
                      ? d.categories.map((c) => c.name).join(", ") || "No categories"
                      : `${d._count.products} product${d._count.products === 1 ? "" : "s"}`}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {schedule(d.startsAt, d.endsAt)}
                </TableCell>
                <TableCell>
                  <DiscountStatusBadge discount={d} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
