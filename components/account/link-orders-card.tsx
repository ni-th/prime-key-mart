"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MailCheck, PackageSearch } from "lucide-react";
import { requestOrderLink, type LinkOrdersState } from "@/app/actions/account";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Email me a confirmation link
    </Button>
  );
}

/**
 * "We found N orders placed with your email": guest orders are only added
 * after the customer confirms they own the inbox.
 */
export function LinkOrdersCard({ count, email }: { count: number; email: string }) {
  const [state, action] = useActionState<LinkOrdersState, FormData>(requestOrderLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <Card className="flex gap-3 p-5 text-sm">
        <MailCheck className="size-5 shrink-0 text-primary" />
        <div>
          <div className="font-medium">Check your inbox</div>
          <p className="text-muted-foreground">
            We sent a link to {email}. Open it to add your orders. It works for 24 hours (check spam too).
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-5 text-sm sm:flex-row sm:items-center">
      <PackageSearch className="size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="font-medium">
          We found {count} earlier order{count === 1 ? "" : "s"} placed with your email
        </div>
        <p className="text-muted-foreground">
          Confirm it&apos;s your inbox and we&apos;ll add {count === 1 ? "it" : "them"} (and the keys) to your account.
        </p>
        {state.status === "error" && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
      </div>
      <form action={action}>
        <Submit />
      </form>
    </Card>
  );
}
