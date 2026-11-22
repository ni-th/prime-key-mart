import { optimizedImageUrl } from "@/lib/image-url";

/**
 * Category page banner. Phones get the 2:1 mobile banner when one is set
 * (a 4:1 banner is very thin on a small screen); larger screens get the 4:1
 * desktop banner. Cloudinary serves a right-sized WebP/AVIF for each.
 */
export function CategoryBanner({
  name,
  bannerUrl,
  bannerMobileUrl,
}: {
  name: string;
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
}) {
  const desktop = bannerUrl ?? bannerMobileUrl;
  if (!desktop) return null;
  const mobile = bannerMobileUrl ?? desktop;
  const mobileAspect = bannerMobileUrl ? "aspect-2/1" : "aspect-4/1";

  return (
    <div
      className={`mb-8 overflow-hidden rounded-2xl border bg-muted ${mobileAspect} sm:aspect-4/1`}
    >
      <picture className="block h-full w-full">
        <source media="(min-width: 640px)" srcSet={optimizedImageUrl(desktop, 1920)} />
        <img
          src={optimizedImageUrl(mobile, 1200)}
          alt={`${name} banner`}
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}
