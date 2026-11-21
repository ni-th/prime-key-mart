import { Badge } from "@/components/ui/badge";

const MAP: Record<
  string,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  PENDING: { label: "Pending payment", variant: "outline" },
  // Paid, but not delivered yet (ran out of stock) - needs an admin.
  PAID: { label: "Paid · awaiting keys", variant: "destructive" },
  FULFILLED: { label: "Delivered", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  EXPIRED: { label: "Cancelled", variant: "outline" },
  REFUNDED: { label: "Refunded", variant: "destructive" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const entry = MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
