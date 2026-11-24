"use client";

import { ErrorContent } from "@/components/error-content";

/**
 * Last-resort error page for anything outside the shop, account and admin
 * areas (those have their own, which keep their layout). Renders inside the
 * root layout. Errors in the root layout itself go to global-error.tsx.
 */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent error={error} retry={retry} />;
}
