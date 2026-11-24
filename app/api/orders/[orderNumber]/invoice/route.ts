import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewOrder } from "@/lib/orders";
import { hasInvoice, loadInvoice } from "@/lib/invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

/**
 * PDF invoice for a paid order, made on request. Same access rule as the
 * order page: the owner's account, an admin (after 2FA), or the private
 * signed link from the order emails (?t=...).
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const token = new URL(req.url).searchParams.get("t");

  const order = await prisma.order.findUnique({ where: { orderNumber } });
  const session = await auth();
  // Same answer for "no such order" and "not yours": don't confirm which exist.
  if (!order || !canViewOrder(order, { session, token, orderNumber })) {
    return new Response("Not found", { status: 404 });
  }
  if (!hasInvoice(order)) {
    return new Response("This order has no invoice yet: invoices are available once the order is paid.", {
      status: 409,
    });
  }

  const invoice = await loadInvoice(orderNumber);
  if (!invoice) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoicePdf(invoice);
  const download = new URL(req.url).searchParams.get("download") !== "0";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
