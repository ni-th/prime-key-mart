import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, per-customer or transactional pages: nothing to index.
      disallow: [
        "/admin",
        "/account",
        "/api/",
        "/cart",
        "/checkout",
        "/order",
        "/order-lookup",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/two-factor",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
