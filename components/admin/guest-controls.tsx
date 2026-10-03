"use client";

import { useActionState } from "react";
import { Ban, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModerationDialog } from "@/components/admin/moderation-dialog";
import { setEmailBlocked, type FormResult } from "@/app/actions/admin";

export function GuestControls({
  email,
  blocked,
  note,
}: {
  email: string;
  blocked: boolean;
  note: string | null;
}) {
  const [state, action] = useActionState<FormResult, FormData>(
    (_p, fd) => setEmailBlocked(fd),
    { ok: false, error: "" },
  );

  return (
    <div>
      {blocked ? (
        <ModerationDialog
          triggerText="Unblock email"
          triggerIcon={<MailCheck className="size-4" />}
          fields={{ email, block: "false" }}
          title="Unblock this email?"
          description="This address will be able to check out and register again."
          confirmText="Unblock"
          formAction={action}
        />
      ) : (
        <ModerationDialog
          triggerText="Block email"
          triggerIcon={<Ban className="size-4" />}
          triggerVariant="destructive"
          fields={{ email, block: "true" }}
          title="Block this email?"
          description="Orders and new registrations using this address will be refused."
          noteLabel="Reason (optional)"
          notePlaceholder="Why is this address being blocked?"
          noteDefaultValue={note ?? undefined}
          confirmText="Block"
          confirmVariant="destructive"
          formAction={action}
        />
      )}
      {state.ok && state.message && (
        <Alert className="mt-2">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {!state.ok && state.error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
