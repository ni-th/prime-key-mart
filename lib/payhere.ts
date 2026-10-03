import { createHash } from "node:crypto";

const merchantId = process.env.PAYHERE_MERCHANT_ID ?? "";
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET ?? "";
export const usdToLkrRate = Number(process.env.PAYHERE_USD_TO_LKR_RATE ?? "300");

export function convertUsdCentsToCurrency(cents: number, currency: "LKR" | "USD") {
  return currency === "LKR" ? Math.round(cents * usdToLkrRate) : cents;
}

export const isPayHereConfigured =
  merchantId.length > 0 &&
  merchantSecret.length > 0 &&
  !merchantId.includes("xxx") &&
  !merchantSecret.includes("xxx");

export const payHereCheckoutUrl =
  process.env.PAYHERE_MODE === "live"
    ? "https://www.payhere.lk/pay/checkout"
    : "https://sandbox.payhere.lk/pay/checkout";

export function createPayHereHash({
  orderId,
  amount,
  currency,
}: {
  orderId: string;
  amount: string;
  currency: string;
}) {
  const secretHash = createHash("md5")
    .update(merchantSecret)
    .digest("hex")
    .toUpperCase();
  return createHash("md5")
    .update(`${merchantId}${orderId}${amount}${currency}${secretHash}`)
    .digest("hex")
    .toUpperCase();
}

export function isValidPayHereNotification(fields: {
  merchant_id: string;
  order_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
}) {
  const expected = createHash("md5")
    .update(
      `${fields.merchant_id}${fields.order_id}${fields.payhere_amount}${fields.payhere_currency}${fields.status_code}${createHash("md5").update(merchantSecret).digest("hex").toUpperCase()}`,
    )
    .digest("hex")
    .toUpperCase();

  return fields.merchant_id === merchantId && fields.md5sig === expected;
}
