import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests (incl. Server Actions) from the
  // Cloudflare quick tunnel used locally so PayHere's notify_url is reachable.
  // See SITE_URL in .env - safe to remove once testing against a real domain.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Email templates (emails/*.hbs) are read from disk at runtime, which the
  // build can't detect: ship them with every server route that may send mail.
  outputFileTracingIncludes: {
    "/**": ["./emails/**/*.hbs"],
  },
};

export default nextConfig;
