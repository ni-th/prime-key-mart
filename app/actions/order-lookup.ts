"use server";

import { z } from "zod";
import { decryptOrderKeys, lookupGuestOrder } from "@/lib/orders";

const schema = z.object({
  orderNumber: z.string().trim().min(3),
  email: z.email(),
});

export type LookupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      order: {
        orderNumber: string;
        status: string;
        email: string;
        currency: string;
        totalCents: number;
        items: { productName: string; quantity: number; unitPriceCents: number }[];
        keyGroups: { productName: string; keys: string[] }[];
      };
    };

export async function lookupOrderAction(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid order number and email address.",
    };
  }

  const order = await lookupGuestOrder(parsed.data.orderNumber, parsed.data.email);
  if (!order) {
    return {
      status: "error",
      message: "We couldn't find an order matching that number and email.",
    };
  }

  return {
    status: "ok",
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      currency: order.currency,
      totalCents: order.totalCents,
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
      keyGroups:
        order.status === "FULFILLED"
          ? decryptOrderKeys(order).map((g) => ({
              productName: g.productName,
              keys: g.keys,
            }))
          : [],
    },
  };
}
