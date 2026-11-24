"use client";

import { ErrorContent } from "@/components/error-content";

/** An error on an account page: shown inside the account layout. */
export default function AccountError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent error={error} retry={retry} area="account" />;
}
