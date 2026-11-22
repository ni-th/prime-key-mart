import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import { BRAND } from "@/lib/brand";
import { BUSINESS } from "@/lib/business";
import { formatMoney } from "@/lib/money";

/**
 * Handlebars email templates (emails/*.hbs).
 *
 *   emails/layouts/main.hbs     branded frame (header, card, footer)
 *   emails/partials/*.hbs       reusable pieces: {{> button}}, {{> keyGroup}} ...
 *   emails/<name>.hbs           HTML body of one email
 *   emails/<name>.text.hbs      plain-text version of the same email
 *
 * {{value}} is HTML-escaped automatically; only use {{{triple}}} for markup we
 * built ourselves. The files ship with the server via outputFileTracingIncludes
 * in next.config.ts.
 */

export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAILS_DIR = path.join(process.cwd(), "emails");

/**
 * The logo is embedded in every email as an inline attachment (cid:) rather
 * than loaded from the website: it shows even when the site isn't reachable
 * (localhost) and when the mail app blocks remote images.
 */
export const EMAIL_LOGO = {
  cid: "keysby-logo",
  filename: "keysby-logo.png",
  path: path.join(EMAILS_DIR, "assets", "logo.png"),
};

/** For in-browser previews (no attachments there): inline the logo as data. */
export function withPreviewLogo(html: string): string {
  const data = fs.readFileSync(EMAIL_LOGO.path).toString("base64");
  return html.replaceAll(`cid:${EMAIL_LOGO.cid}`, `data:image/png;base64,${data}`);
}

/** The site's theme tokens (app/globals.css), as hex for email clients. */
export const THEME = {
  night: BRAND.ink, // dark theme background / logo ink
  ink: "#0c0c16", // --foreground
  muted: "#666875", // --muted-foreground
  faint: "#8b8d9c",
  border: "#e1e2eb", // --border
  soft: "#f3f4fa", // --muted
  accent: "#edefff", // --accent
  accentText: "#262659", // --accent-foreground
  primary: "#594cf4", // --primary
  from: BRAND.from, // logo gradient
  to: BRAND.to,
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace",
} as const;

const TONES = {
  info: { bg: THEME.accent, border: "#c9cdfd", fg: THEME.accentText },
  success: { bg: "#ecfdf5", border: "#a7f3d0", fg: "#065f46" },
  warning: { bg: "#fffbeb", border: "#fde68a", fg: "#92400e" },
  danger: { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" },
} as const;
export type Tone = keyof typeof TONES;

const hbs = Handlebars.create();

hbs.registerHelper("money", (cents: number, currency: string) =>
  formatMoney(cents, String(currency).toUpperCase()),
);
hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);
/** {{tone "info" "bg"}} -> colour for a callout/badge tone. */
hbs.registerHelper("tone", (name: string, part: "bg" | "border" | "fg") => {
  const t = TONES[name as Tone] ?? TONES.info;
  return t[part];
});
/** Escaped text with line breaks kept. */
hbs.registerHelper(
  "nl2br",
  (text: string) => new Handlebars.SafeString(Handlebars.escapeExpression(text ?? "").replace(/\r?\n/g, "<br>")),
);
/** Escaped text with URLs turned into links and line breaks kept. */
hbs.registerHelper("linkify", (text: string) => {
  const escaped = Handlebars.escapeExpression(text ?? "");
  const linked = escaped.replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" style="color:${THEME.primary};text-decoration:underline">${url}</a>`,
  );
  return new Handlebars.SafeString(linked.replace(/\r?\n/g, "<br>"));
});

type Compiled = Handlebars.TemplateDelegate;
const cache = new Map<string, Compiled>();
// Re-read templates on every send in development so edits show immediately.
const useCache = process.env.NODE_ENV === "production";

function load(rel: string): Compiled {
  const hit = useCache ? cache.get(rel) : undefined;
  if (hit) return hit;
  const source = fs.readFileSync(path.join(EMAILS_DIR, rel), "utf8");
  // Plain-text versions must not be HTML-escaped ("&" stays "&").
  const compiled = hbs.compile(source, { noEscape: rel.endsWith(".text.hbs") });
  cache.set(rel, compiled);
  return compiled;
}

let partialsLoaded = false;
function registerPartials() {
  if (partialsLoaded && useCache) return;
  const dir = path.join(EMAILS_DIR, "partials");
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".hbs")) continue;
    hbs.registerPartial(file.replace(/\.hbs$/, ""), fs.readFileSync(path.join(dir, file), "utf8"));
  }
  partialsLoaded = true;
}

/** Data every template can use: {{site.url}}, {{theme.primary}}, {{business.email}} ... */
function globals() {
  return {
    site: {
      name: BRAND.name,
      url: SITE_URL,
      host: SITE_URL.replace(/^https?:\/\//, ""),
      logo: `cid:${EMAIL_LOGO.cid}`,
    },
    theme: THEME,
    business: BUSINESS,
    year: new Date().getFullYear(),
  };
}

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Render emails/<name>.hbs inside the layout, plus emails/<name>.text.hbs.
 * `meta.preheader` is the grey preview line inbox lists show after the subject.
 */
export function renderEmail(
  name: string,
  data: Record<string, unknown>,
  meta: { subject: string; preheader: string; audience?: "customer" | "admin" },
): RenderedEmail {
  registerPartials();
  const ctx = { ...globals(), ...data };
  const body = load(`${name}.hbs`)(ctx);
  const html = load("layouts/main.hbs")({
    ...ctx,
    body,
    title: meta.subject,
    preheader: meta.preheader,
    isAdmin: meta.audience === "admin",
  });
  const text = load(`${name}.text.hbs`)(ctx).replace(/\n{3,}/g, "\n\n").trim();
  return { subject: meta.subject, html, text };
}
