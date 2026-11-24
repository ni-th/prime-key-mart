import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating (supports halves visually by rounding to the nearest half). */
export function Stars({
  rating,
  className,
  size = "size-4",
}: {
  rating: number;
  className?: string;
  size?: string;
}) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0;
        return (
          <span key={n} className={cn("relative inline-block", size)}>
            <Star className={cn("absolute inset-0 text-muted-foreground/40", size)} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn("fill-amber-400 text-amber-400", size)} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
