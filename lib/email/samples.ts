import {
  adminAlertEmail,
  orderKeysEmail,
  confirmEmailEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentReportClosedEmail,
  paymentReportReceivedEmail,
  orderStatusEmail,
  warrantyClaimReceivedEmail,
  warrantyClaimResolvedEmail,
  type EmailContent,
} from "@/lib/email/templates";
import { SITE_URL } from "@/lib/email/render";

/** Every email with sample data, for the Admin -> Emails preview. */
export const EMAIL_SAMPLES: {
  id: string;
  name: string;
  when: string;
  render: () => EmailContent;
}[] = [
  {
    id: "order-keys",
    name: "Order keys",
    when: "To the customer when an order is paid and delivered.",
    render: () =>
      orderKeysEmail({
        orderNumber: "KM-8F3K2Q",
        totalCents: 1199700,
        currency: "lkr",
        groups: [
          { name: "Windows 11 Pro", keys: ["VK7JG-NPHTM-C97JM-9MPGT-3V66T"], warranty: "Premium (1 year), until 22 Nov 2027" },
          { name: "Microsoft Office 2021 Pro Plus", keys: ["XQNVK-8JYDB-WJ9W3-YJ8YR-WFG99", "NMMKJ-6RK4F-KMJVX-8D9MJ-6MWKP"] },
        ],
        freeCheck: "24 hours",
      }),
  },
  {
    id: "order-status",
    name: "Order status (Find my order)",
    when: "Find my order, for an order that isn't delivered (e.g. expired).",
    render: () => orderStatusEmail({ orderNumber: "KM-8F3K2Q", status: "EXPIRED", totalCents: 1199700, currency: "lkr" }),
  },
  {
    id: "warranty-claim-received",
    name: "Warranty claim received",
    when: "When a customer reports a key that stopped working.",
    render: () =>
      warrantyClaimReceivedEmail({ orderNumber: "KM-8F3K2Q", productName: "Windows 11 Pro", reasonLabel: "Was working, now deactivated" }),
  },
  {
    id: "warranty-claim-replaced",
    name: "Warranty replacement",
    when: "When you send a replacement key for a claim.",
    render: () =>
      warrantyClaimResolvedEmail({
        orderNumber: "KM-8F3K2Q",
        productName: "Windows 11 Pro",
        outcome: "REPLACED",
        newKey: "W269N-WFGWX-YVC9B-4J6C9-T83GX",
        warrantyNote: "Plus (3 months), until 20 Feb 2027",
        note: "Sorry about that! Here's a fresh key.",
      }),
  },
  {
    id: "password-reset",
    name: "Password reset",
    when: "When someone uses \"Forgot password\".",
    render: () => passwordResetEmail({ resetUrl: `${SITE_URL}/reset-password?token=sample`, ttlMinutes: 30 }),
  },
  {
    id: "confirm-email",
    name: "Confirm email (link orders)",
    when: "When a customer asks to add their past guest orders to their account.",
    render: () => confirmEmailEmail({ confirmUrl: `${SITE_URL}/account/link-orders?t=sample`, orderCount: 2, ttlHours: 24 }),
  },
  {
    id: "password-changed",
    name: "Password changed",
    when: "After a password is changed, as a security notice.",
    render: () => passwordChangedEmail(),
  },
  {
    id: "payment-report-received",
    name: "Payment report received",
    when: "When a customer says \"I paid but didn't get my keys\".",
    render: () => paymentReportReceivedEmail({ orderNumber: "KM-8F3K2Q" }),
  },
  {
    id: "payment-report-closed",
    name: "Payment report closed",
    when: "When you close a report as not paid (with your message).",
    render: () =>
      paymentReportClosedEmail({
        orderNumber: "KM-8F3K2Q",
        message:
          "We checked with our payment provider (PayHere) and couldn't find a completed payment for this order, so no keys were sent. If money was taken from your account, please reply with a screenshot from your bank.",
      }),
  },
  {
    id: "admin-alert",
    name: "Admin alert",
    when: "To you: low stock, failed deliveries, payment problems, reports.",
    render: () =>
      adminAlertEmail({
        type: "FAILED_DELIVERY",
        subject: "Action needed: order KM-8F3K2Q paid but out of stock",
        lines: [
          "Order KM-8F3K2Q was paid (payment 320012345678), but there were not enough keys to deliver it.",
          "",
          "Missing: Windows 11 Pro (1 short)",
          "",
          `Add keys and use "Mark as paid & deliver keys" on the order: ${SITE_URL}/admin/orders/KM-8F3K2Q`,
        ],
      }),
  },
];
