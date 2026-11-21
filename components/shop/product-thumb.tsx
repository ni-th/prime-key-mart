import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizedImageUrl } from "@/lib/image-url";

const BRAND_GRADIENTS: Record<string, string> = {
  Microsoft: "from-sky-500/25 to-blue-600/10",
  Norton: "from-amber-500/25 to-yellow-600/10",
  Bitdefender: "from-red-500/25 to-rose-600/10",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProductThumb({
  name,
  brand,
  imageUrl,
  className,
  width = 800,
}: {
  name: string;
  brand: string;
  imageUrl?: string | null;
  className?: string;
  /** Pixel width to request from Cloudinary (covers 2x screens at card size). */
  width?: number;
}) {
  if (imageUrl) {
    return (
      // Product images are admin-provided arbitrary URLs; next/image would need
      // per-host remotePatterns config, so a plain img is intentional here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // Cloudinary images are served resized + as WebP/AVIF; others as-is.
        src={optimizedImageUrl(imageUrl, width)}
        alt={name}
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  const gradient = BRAND_GRADIENTS[brand] ?? "from-primary/20 to-primary/5";

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center bg-linear-to-br",
        gradient,
        className,
      )}
    >
      <KeyRound className="absolute right-3 top-3 size-4 text-foreground/30" />
      <span className="font-heading text-3xl font-semibold text-foreground/70">
        {initials(name)}
      </span>
    </div>
  );
}
