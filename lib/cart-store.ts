"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  brand: string;
  quantity: number;
  /** Chosen warranty plan; unset = the product's included (default) plan. */
  warrantyPlanId?: string | null;
};

type CartState = {
  lines: CartLine[];
  /** Add `qty` (default 1). With `max` (e.g. the stock), the line never goes above it. */
  add: (line: Omit<CartLine, "quantity">, qty?: number, max?: number) => void;
  setQty: (productId: string, qty: number) => void;
  setWarranty: (productId: string, planId: string | null) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line, qty = 1, max = Infinity) =>
        set((state) => {
          const existing = state.lines.find(
            (l) => l.productId === line.productId,
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === line.productId
                  ? {
                      ...l,
                      quantity: Math.max(l.quantity, Math.min(l.quantity + qty, max)),
                      // A plan picked on the product page replaces the old one.
                      ...(line.warrantyPlanId !== undefined && { warrantyPlanId: line.warrantyPlanId }),
                    }
                  : l,
              ),
            };
          }
          const quantity = Math.min(qty, max);
          if (quantity <= 0) return state;
          return { lines: [...state.lines, { ...line, quantity }] };
        }),
      setQty: (productId, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => l.productId !== productId)
              : state.lines.map((l) =>
                  l.productId === productId ? { ...l, quantity: qty } : l,
                ),
        })),
      setWarranty: (productId, planId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId ? { ...l, warrantyPlanId: planId } : l,
          ),
        })),
      remove: (productId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.productId !== productId),
        })),
      clear: () => set({ lines: [] }),
    }),
    { name: "keymart-cart", version: 1 },
  ),
);

export const selectCartCount = (s: CartState) =>
  s.lines.reduce((n, l) => n + l.quantity, 0);

export const selectCartSubtotal = (s: CartState) =>
  s.lines.reduce((n, l) => n + l.priceCents * l.quantity, 0);
