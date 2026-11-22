/**
 * Order statuses where a customer can say "I paid but got no keys". Client-safe.
 * Not FAILED: those never took a payment (checkout broke before PayHere, or
 * PayHere itself reported the payment failed/cancelled).
 */
export const REPORTABLE_STATUSES = ["PENDING", "EXPIRED"] as const;

export function canReportPaymentIssue(status: string): boolean {
  return (REPORTABLE_STATUSES as readonly string[]).includes(status);
}

/** Saved on the order when a report is handled by delivering the keys. */
export const RESOLVED_DELIVERED = "Keys delivered";
/** Prefix on the note of a follow-up report (only one follow-up is allowed). */
export const FOLLOW_UP_PREFIX = "[Follow-up] ";

/** What the customer should see about their report. */
export function reportView(order: {
  issueReportedAt: Date | null;
  issueResolvedAt: Date | null;
  issueResolution: string | null;
  issueNote: string | null;
}) {
  const closed = Boolean(order.issueResolvedAt) && order.issueResolution !== RESOLVED_DELIVERED;
  return {
    /** Open report: "we're checking your payment". */
    reported: Boolean(order.issueReportedAt && !order.issueResolvedAt),
    /** Admin's message after checking and finding no payment, or null. */
    closedMessage: closed ? order.issueResolution : null,
    /** Whether the customer may still send a (follow-up) report. */
    canFollowUp: !(order.issueNote ?? "").startsWith(FOLLOW_UP_PREFIX),
  };
}
