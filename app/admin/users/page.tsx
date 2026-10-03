import type { Metadata } from "next";
import Link from "next/link";
import { getUsersList, type UserFilter } from "@/lib/admin";
import { formatUsd } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Users · Admin" };

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "registered", label: "Registered" },
  { value: "guests", label: "Guests" },
  { value: "flagged", label: "Suspended / blocked" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const active = (FILTERS.find((f) => f.value === filter)?.value ??
    "all") as UserFilter;
  const rows = await getUsersList(active);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/users" : `/admin/users?filter=${f.value}`}
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
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users match this filter.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const href =
                r.kind === "registered"
                  ? `/admin/users/${r.id}`
                  : `/admin/users/guest/${encodeURIComponent(r.email)}`;
              return (
                <TableRow key={`${r.kind}-${r.id ?? r.email}`}>
                  <TableCell>
                    <Link href={href} className="font-medium hover:underline">
                      {r.name ?? r.email}
                    </Link>
                    {r.name && (
                      <div className="text-xs text-muted-foreground">
                        {r.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.kind === "registered" ? (
                      <Badge variant={r.role === "ADMIN" ? "default" : "secondary"}>
                        {r.role === "ADMIN" ? "Admin" : "Registered"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Guest</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.orderCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(r.spentCents)}
                  </TableCell>
                  <TableCell>
                    {r.suspended ? (
                      <Badge variant="destructive">
                        {r.kind === "registered" ? "Suspended" : "Blocked"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Active
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
