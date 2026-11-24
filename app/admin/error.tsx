"use client";

import { ErrorContent } from "@/components/error-content";

/** An error on an admin page: shown inside the admin layout (nav stays). */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent error={error} retry={retry} area="admin" />;
}
