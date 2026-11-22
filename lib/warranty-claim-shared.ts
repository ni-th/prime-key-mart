/** Warranty claim labels shared by the customer and admin UI. Client-safe. */

export const CLAIM_REASONS = {
  NOT_ACTIVATING: "Key won't activate",
  DEACTIVATED: "Was working, now deactivated",
  ALREADY_USED: "Says the key is already in use",
  OTHER: "Something else",
} as const;
export type ClaimReason = keyof typeof CLAIM_REASONS;

export const CLAIM_STATUS = {
  OPEN: "Being reviewed",
  REPLACED: "Replaced",
  REFUNDED: "Refunded",
  REJECTED: "Not covered",
} as const;
export type ClaimStatus = keyof typeof CLAIM_STATUS;

/** One delivered item with a warranty, as the customer sees it on their order. */
/** One delivered product line on the customer's order page: its keys, warranty and claims. */
export type OrderKeyItem = {
  itemId: string;
  /** The order this line belongs to (claims are made against it). */
  orderNumber: string;
  /** When the order was placed (ISO). */
  orderedAt: string;
  productName: string;
  /** Null when the line was bought without a warranty. */
  warrantyName: string | null;
  /** "Premium (1 year), until 22 Nov 2027"; null without a warranty. */
  summary: string | null;
  /** Covered right now (claims allowed). */
  active: boolean;
  keys: {
    id: string;
    /** Last characters of the key, to tell keys apart. */
    label: string;
    /** The full key (only sent to the order's owner; hidden until they tap the eye). */
    value: string;
    /** This key was sent as a warranty replacement. */
    isReplacement: boolean;
    /** The latest claim on this key, if any. */
    claim: { status: ClaimStatus; note: string | null; createdAt: string } | null;
  }[];
};
