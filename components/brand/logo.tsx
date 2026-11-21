import { cn } from "@/lib/utils";

// Kept in sync with lib/brand.ts (not imported: that module uses Buffer,
// which client components can't bundle).
const FROM = "#6366F1";
const TO = "#7C3AED";

/** The Keysby mark: a white key on an indigo-to-violet rounded tile. */
export function LogoMark({
  className,
  title,
}: {
  className?: string;
  /** Accessible name; omit when the wordmark sits next to it. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-7 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        {/* Same id on every instance is fine: the definitions are identical. */}
        <linearGradient
          id="keysby-mark"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={FROM} />
          <stop offset="1" stopColor={TO} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#keysby-mark)" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="24" cy="24" r="9" />
        <path d="M30.4 30.4 L46 46 M38.5 38.5 L43 34 M45.5 45.5 L50 41" />
      </g>
    </svg>
  );
}

/** Mark + "Keysby" wordmark. Size it with `className` on the wrapper. */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="font-semibold tracking-tight">Keysby</span>
    </span>
  );
}
