import { Badge } from "@/components/ui/badge";
import { discountStatus } from "@/lib/sale";

const LABELS = {
  active: "Live",
  scheduled: "Scheduled",
  ended: "Ended",
  off: "Paused",
} as const;

export function DiscountStatusBadge({
  discount,
}: {
  discount: { active: boolean; startsAt: Date | null; endsAt: Date | null };
}) {
  const status = discountStatus(discount);
  if (status === "active") {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500">
        {LABELS.active}
      </Badge>
    );
  }
  return (
    <Badge variant={status === "scheduled" ? "secondary" : "outline"}>{LABELS[status]}</Badge>
  );
}
