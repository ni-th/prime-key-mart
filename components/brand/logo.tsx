import Image from "next/image";
import { cn } from "@/lib/utils";
import logoDark from "@/public/images/brand/keysby-logo-dark.png";
import logoLight from "@/public/images/brand/keysby-logo-light.png";

/**
 * The Keysby logo (K-with-key mark + "keysby" wordmark), from the artwork in
 * public/images. Two versions are swapped by theme: the original has white
 * "keys" and key (dark backgrounds); the light version recolors those parts to
 * ink so they stay readable on white. Generated from public/images/keysby-2.png.
 *
 * Size it with a height class on `className` (e.g. "h-8"); width follows the
 * artwork's aspect ratio and never shrinks, so the logo can't be squashed by a
 * crowded flex row.
 */
export function Logo({
  className,
  priority,
}: {
  className?: string;
  /** Set for the logo in the header so it loads first. */
  priority?: boolean;
}) {
  // Tailwind's preflight gives images `max-width: 100%`, which lets a flex row
  // compress them horizontally; `max-w-none` + a fixed aspect ratio prevent it.
  const shared = "h-full w-auto max-w-none shrink-0 object-contain select-none";
  const ratio = { aspectRatio: `${logoDark.width} / ${logoDark.height}` };
  return (
    <span className={cn("inline-flex h-8 shrink-0", className)}>
      <Image
        src={logoLight}
        alt="Keysby"
        priority={priority}
        style={ratio}
        className={cn(shared, "dark:hidden")}
      />
      <Image
        src={logoDark}
        alt="Keysby"
        priority={priority}
        style={ratio}
        className={cn(shared, "hidden dark:block")}
      />
    </span>
  );
}
