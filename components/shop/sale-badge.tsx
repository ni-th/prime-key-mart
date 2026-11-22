import { cn } from "@/lib/utils";

/** "-20%" pill shown on products that are on sale. */
export function SaleBadge({ percent, className }: { percent: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-destructive px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums",
        className,
      )}
    >
      -{Number.isInteger(percent) ? percent : percent.toFixed(1)}%
    </span>
  );
}
