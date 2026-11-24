import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { BRAND } from "@/lib/brand";
import { BUSINESS } from "@/lib/business";
import { formatMoney } from "@/lib/money";
import { INVOICE_TIME_ZONE, type InvoiceData } from "@/lib/invoice";

/**
 * Draws an invoice as an A4 PDF with pdf-lib (pure JS, no browser needed).
 * The standard PDF fonts only cover Western European characters, so other
 * characters (e.g. a name typed in Sinhala) are shown as "?".
 */

const LOGO_PATH = path.join(process.cwd(), "public", "images", "brand", "keysby-logo-light.png");
const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin
const CONTENT_W = A4.w - M * 2;

const hex = (h: string): RGB =>
  rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  ink: hex("#0c0c16"),
  muted: hex("#666875"),
  border: hex("#e1e2eb"),
  soft: hex("#f3f4fa"),
  primary: hex("#594cf4"),
  success: hex("#065f46"),
};

/** Keep only characters the standard (WinAnsi) fonts can draw. */
function safe(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\t\r\n]+/g, " ")
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: INVOICE_TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
}

type Fonts = { regular: PDFFont; bold: PDFFont };

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    readonly fonts: Fonts,
    private onNewPage: (w: Writer) => void,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - M;
  }

  /** Start a new page if fewer than `height` points are left. */
  need(height: number) {
    if (this.y - height < M + 30) {
      this.addPage();
      this.onNewPage(this);
    }
  }

  text(
    value: string,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean; color?: RGB; align?: "left" | "right"; width?: number } = {},
  ) {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const s = safe(value);
    const tx = opts.align === "right" ? x + (opts.width ?? 0) - font.widthOfTextAtSize(s, size) : x;
    this.page.drawText(s, { x: tx, y, size, font, color: opts.color ?? C.ink });
  }

  /** Split text into lines that fit `width`. */
  wrap(value: string, width: number, size: number, bold = false): string[] {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const words = safe(value).split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    // A single word longer than the width: cut it.
    return lines.flatMap((l) => {
      if (font.widthOfTextAtSize(l, size) <= width) return [l];
      const parts: string[] = [];
      let part = "";
      for (const ch of l) {
        if (font.widthOfTextAtSize(part + ch, size) > width) {
          parts.push(part);
          part = ch;
        } else part += ch;
      }
      return part ? [...parts, part] : parts;
    });
  }

  line(y: number, color = C.border, x1 = M, x2 = A4.w - M) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.75, color });
  }
}

// Item table columns (x offset from the margin, width). Amounts right-aligned.
const COLS = {
  item: { x: 0, w: 158 },
  qty: { x: 160, w: 26 },
  unit: { x: 190, w: 80 },
  discount: { x: 274, w: 74 },
  warranty: { x: 352, w: 70 },
  total: { x: 422, w: CONTENT_W - 422 },
};

/** Amount without the currency (the table headers name it): "12,500.00". */
function plainAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

function tableHeader(w: Writer, currency: string) {
  const y = w.y;
  w.page.drawRectangle({ x: M, y: y - 6, width: CONTENT_W, height: 20, color: C.soft });
  const h = { size: 7.5, bold: true, color: C.muted };
  w.text("ITEM", M + 6, y, h);
  w.text("QTY", M + COLS.qty.x, y, { ...h, align: "right", width: COLS.qty.w });
  w.text(`UNIT PRICE (${currency})`, M + COLS.unit.x, y, { ...h, align: "right", width: COLS.unit.w });
  w.text("DISCOUNT", M + COLS.discount.x, y, { ...h, align: "right", width: COLS.discount.w });
  w.text("WARRANTY", M + COLS.warranty.x, y, { ...h, align: "right", width: COLS.warranty.w });
  w.text(`TOTAL (${currency})`, M + COLS.total.x, y, { ...h, align: "right", width: COLS.total.w - 6 });
  w.y -= 24;
}

export async function renderInvoicePdf(inv: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.invoiceNumber}`);
  doc.setAuthor(BUSINESS.legalName);
  doc.setSubject(`Order ${inv.orderNumber}`);
  doc.setCreator(BRAND.name);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const money = (cents: number) => formatMoney(cents, inv.currency);

  // Later pages repeat a small header so loose pages still identify the bill.
  const w = new Writer(doc, fonts, (wr) => {
    wr.text(`${BUSINESS.legalName} - Invoice ${inv.invoiceNumber} (continued)`, M, wr.y, { size: 8.5, color: C.muted });
    wr.y -= 24;
  });

  /* ----- Header: logo + business on the left, INVOICE + numbers on the right ----- */
  let leftY = w.y;
  try {
    const logo = await doc.embedPng(fs.readFileSync(LOGO_PATH));
    const height = 30;
    const width = (logo.width / logo.height) * height;
    w.page.drawImage(logo, { x: M, y: leftY - height + 8, width, height });
    leftY -= height + 6;
  } catch {
    w.text(BRAND.name, M, leftY - 14, { size: 20, bold: true });
    leftY -= 30;
  }

  w.text(BUSINESS.legalName, M, leftY, { size: 10, bold: true });
  leftY -= 13;
  const businessLines = [
    ...(BUSINESS.address ? w.wrap(BUSINESS.address, 240, 9) : []),
    BUSINESS.registrationNo ? `Reg. no. ${BUSINESS.registrationNo}` : "",
    BUSINESS.email,
    BUSINESS.phone,
    SITE_URL.replace(/^https?:\/\//, ""),
  ].filter(Boolean);
  for (const l of businessLines) {
    w.text(l, M, leftY, { size: 9, color: C.muted });
    leftY -= 12;
  }

  const rightX = A4.w - M - 210;
  let rightY = w.y - 14;
  w.text("INVOICE", rightX, rightY, { size: 20, bold: true, color: C.primary, align: "right", width: 210 });
  rightY -= 24;
  const meta: [string, string][] = [
    ["Invoice no.", inv.invoiceNumber],
    ["Order no.", inv.orderNumber],
    ["Invoice date", formatDate(inv.paidAt)],
    ...(inv.paymentRef ? ([["Payment ref.", inv.paymentRef]] as [string, string][]) : []),
  ];
  for (const [label, value] of meta) {
    w.text(label, rightX, rightY, { size: 9, color: C.muted });
    w.text(value, rightX + 70, rightY, { size: 9, bold: true, align: "right", width: 140 });
    rightY -= 13;
  }

  w.y = Math.min(leftY, rightY) - 14;
  w.line(w.y);
  w.y -= 20;

  /* ----- Bill to ----- */
  w.text("BILL TO", M, w.y, { size: 8, bold: true, color: C.muted });
  w.text("PAYMENT", M + CONTENT_W / 2, w.y, { size: 8, bold: true, color: C.muted });
  w.y -= 14;
  const billTo = [
    inv.customer.name,
    inv.customer.email,
    inv.customer.phone,
    inv.customer.country,
  ].filter((v): v is string => Boolean(v));
  const payment = [`Paid via PayHere`, `on ${formatDate(inv.paidAt)}`];
  const rows = Math.max(billTo.length, payment.length);
  for (let i = 0; i < rows; i++) {
    if (billTo[i]) w.text(billTo[i], M, w.y, { size: 9.5, bold: i === 0 && Boolean(inv.customer.name) });
    if (payment[i]) w.text(payment[i], M + CONTENT_W / 2, w.y, { size: 9.5, bold: i === 0 });
    w.y -= 13;
  }
  w.y -= 14;

  /* ----- Items ----- */
  tableHeader(w, inv.currency);
  for (const line of inv.lines) {
    const titleLines = w.wrap(line.description, COLS.item.w - 6, 9.5, true);
    const detailLines = line.details.flatMap((d) => w.wrap(d, COLS.item.w - 6, 8));
    const height = titleLines.length * 12 + detailLines.length * 10 + 10;
    w.need(height);
    if (w.y > A4.h - M - 40) tableHeader(w, inv.currency); // fresh page: repeat the column titles

    const top = w.y;
    let y = top;
    for (const t of titleLines) {
      w.text(t, M + 6, y, { size: 9.5, bold: true });
      y -= 12;
    }
    for (const d of detailLines) {
      w.text(d, M + 6, y + 1, { size: 8, color: C.muted });
      y -= 10;
    }
    const num = { size: 9 };
    w.text(String(line.quantity), M + COLS.qty.x, top, { ...num, align: "right", width: COLS.qty.w });
    w.text(plainAmount(line.unitCents), M + COLS.unit.x, top, { ...num, align: "right", width: COLS.unit.w });
    w.text(line.discountCents ? `-${plainAmount(line.discountCents)}` : "-", M + COLS.discount.x, top, {
      ...num,
      align: "right",
      width: COLS.discount.w,
      color: line.discountCents ? C.success : C.muted,
    });
    w.text(line.warrantyCents ? plainAmount(line.warrantyCents) : "-", M + COLS.warranty.x, top, {
      ...num,
      align: "right",
      width: COLS.warranty.w,
      color: line.warrantyCents ? C.ink : C.muted,
    });
    w.text(plainAmount(line.lineTotalCents), M + COLS.total.x, top, {
      ...num,
      bold: true,
      align: "right",
      width: COLS.total.w - 6,
    });
    w.y = y - 6;
    w.line(w.y + 4);
    w.y -= 8;
  }

  /* ----- Totals ----- */
  const labelX = M + CONTENT_W - 230;
  const totalRow = (label: string, value: string, opts: { bold?: boolean; color?: RGB; size?: number } = {}) => {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? fonts.bold : fonts.regular;
    // Long labels (refund lines) wrap so they never run into the amount.
    const labelLines = w.wrap(label, 224 - font.widthOfTextAtSize(safe(value), size) - 12, size, opts.bold);
    w.need(labelLines.length * (size + 3) + 6);
    w.text(value, labelX, w.y, { size, bold: opts.bold, color: opts.color, align: "right", width: 224 });
    for (const l of labelLines) {
      w.text(l, labelX, w.y, { size, bold: opts.bold, color: opts.bold ? C.ink : C.muted });
      w.y -= size + 3;
    }
    w.y -= 3;
  };

  w.y -= 4;
  totalRow("Subtotal", money(inv.subtotalCents));
  if (inv.discountCents > 0) totalRow("Discounts", `-${money(inv.discountCents)}`, { color: C.success });
  if (inv.warrantyCents > 0) totalRow("Warranty", money(inv.warrantyCents));
  w.need(26);
  w.line(w.y + 8, C.border, labelX, A4.w - M);
  w.y -= 6;
  totalRow("Total paid", money(inv.totalCents), { bold: true, size: 12 });

  if (inv.refunds.length > 0) {
    w.y -= 4;
    for (const r of inv.refunds) {
      // Non-breaking spaces keep the date on one line when the label wraps.
      totalRow(`${r.description} (${formatDate(r.date).replace(/ /g, " ")})`, `-${money(r.cents)}`);
    }
    w.need(26);
    w.line(w.y + 8, C.border, labelX, A4.w - M);
    w.y -= 6;
    totalRow("Net amount paid", money(Math.max(0, inv.totalCents - inv.refundedCents)), { bold: true, size: 11 });
  }

  /* ----- Notes ----- */
  w.y -= 18;
  w.need(60);
  const notes = [
    "Thank you for your purchase. License keys are not shown on this invoice: open your order page or the keys email to see them.",
    `Questions about this invoice? Contact ${BUSINESS.email || SITE_URL.replace(/^https?:\/\//, "")} and quote ${inv.invoiceNumber}.`,
  ];
  for (const n of notes) {
    for (const l of w.wrap(n, CONTENT_W, 8.5)) {
      w.need(12);
      w.text(l, M, w.y, { size: 8.5, color: C.muted });
      w.y -= 11;
    }
    w.y -= 4;
  }

  /* ----- Footer on every page ----- */
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = safe(`${BUSINESS.legalName} - ${inv.invoiceNumber} - Page ${i + 1} of ${pages.length}`);
    const size = 7.5;
    p.drawText(footer, {
      x: (A4.w - fonts.regular.widthOfTextAtSize(footer, size)) / 2,
      y: M - 20,
      size,
      font: fonts.regular,
      color: C.muted,
    });
  });

  return doc.save();
}
