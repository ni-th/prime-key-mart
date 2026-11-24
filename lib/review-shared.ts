/** Review types and limits. Safe to import anywhere (client and server). */

export const REVIEW_TITLE_MAX = 80;
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;
export const REVIEW_REPLY_MAX = 1000;

export const REVIEW_STATUS = {
  PENDING: "Waiting for approval",
  APPROVED: "Published",
  REJECTED: "Not published",
} as const;
export type ReviewStatus = keyof typeof REVIEW_STATUS;

/** A product in a delivered order, with the customer's review of it (if any). */
export type OrderReviewItem = {
  productId: string;
  productName: string;
  productSlug: string;
  review: {
    rating: number;
    title: string | null;
    body: string;
    status: ReviewStatus;
    adminReply: string | null;
  } | null;
};

export type RatingSummary = { average: number; count: number };
