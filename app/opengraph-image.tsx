import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

// Link-preview image (WhatsApp, Facebook, X, Slack, Discord...).
export const alt = `${BRAND.name} - ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHIPS = ["Windows", "Microsoft Office", "Antivirus", "Instant email delivery"];

// The full logo with white "keys" + key, which suits this dark background.
// 1159x271 source, shown at height 110.
const LOGO_W = Math.round((1159 / 271) * 110);

export default async function OpenGraphImage() {
  const logo = await readFile(
    join(process.cwd(), "public/images/brand/keysby-logo-dark.png"),
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#fff",
          backgroundColor: BRAND.ink,
          backgroundImage: `radial-gradient(circle at 88% 12%, ${BRAND.to}66 0%, transparent 45%), radial-gradient(circle at 8% 100%, ${BRAND.from}55 0%, transparent 50%)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs <img> */}
        <img src={logoSrc} width={LOGO_W} height={110} alt="" />

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 940 }}>
            {`${BRAND.tagline}.`}
          </div>
          <div style={{ fontSize: 28, color: "#A1A1B5", maxWidth: 900, lineHeight: 1.35 }}>
            Fair prices, real licenses, in your inbox seconds after checkout.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {CHIPS.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 24,
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                backgroundColor: "rgba(255,255,255,0.06)",
                color: "#E4E4F0",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
