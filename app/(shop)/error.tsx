"use client";

import { ErrorContent } from "@/components/error-content";

/** An error on a shop page: shown inside the shop layout (header and footer stay). */
export default function ShopError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent error={error} retry={retry} area="shop" />;
}
