"use client";

import { useEffect, useMemo, useState } from "react";
import { quoteCart, type CartQuote, type CartQuoteLine } from "@/app/actions/pricing";
import type { CartLine } from "@/lib/cart-store";

/**
 * Live prices (USD + LKR) for the cart from the server. Re-fetches when items
 * or quantities change. `quote` is null until the first response arrives.
 */
export function useCartQuote(lines: CartLine[]) {
  const key = useMemo(
    () => lines.map((l) => `${l.productId}:${l.quantity}`).join(","),
    [lines],
  );
  const [state, setState] = useState<{ key: string; quote: CartQuote } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const items = key
      ? key.split(",").map((s) => {
          const [productId, qty] = s.split(":");
          return { productId, quantity: Number(qty) };
        })
      : [];
    quoteCart(items)
      .then((quote) => {
        if (!cancelled) setState({ key, quote });
      })
      .catch(() => {
        /* keep the last quote; checkout re-prices on the server anyway */
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const quote = state?.quote ?? null;
  const byId = useMemo(
    () => new Map<string, CartQuoteLine>((quote?.lines ?? []).map((l) => [l.productId, l])),
    [quote],
  );
  return { quote, byId, loading: state?.key !== key };
}
