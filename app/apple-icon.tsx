import { ImageResponse } from "next/og";
import { BRAND, KEY_GLYPH } from "@/lib/brand";

// iOS home-screen icon. Full-bleed (iOS applies its own rounded mask).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const keySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="#fff" stroke-width="${KEY_GLYPH.stroke}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${KEY_GLYPH.bow.cx}" cy="${KEY_GLYPH.bow.cy}" r="${KEY_GLYPH.bow.r}"/>
    <path d="${KEY_GLYPH.shaft} ${KEY_GLYPH.teeth}"/>
  </g>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs <img> */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(keySvg).toString("base64")}`}
          width={180}
          height={180}
          alt=""
        />
      </div>
    ),
    size,
  );
}
