import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests (incl. Server Actions) from the
  // Cloudflare quick tunnel used locally so PayHere's notify_url is reachable.
  // See SITE_URL in .env - safe to remove once testing against a real domain.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Email templates and the email logo (emails/) are read from disk at
  // runtime, which the build can't detect: ship them with every server route
  // that may send mail. The same goes for the logo drawn on PDF invoices.
  outputFileTracingIncludes: {
    "/**": ["./emails/**/*", "./public/images/brand/keysby-logo-light.png"],
  },
};

export default nextConfig;
