import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests (incl. Server Actions) from the
  // Cloudflare quick tunnel used locally so PayHere's notify_url is reachable.
  // See SITE_URL in .env — safe to remove once testing against a real domain.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
