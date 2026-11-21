"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Ban, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModerationDialog } from "@/components/admin/moderation-dialog";
import {
  setUserRole,
  setUserSuspended,
  type FormResult,
} from "@/app/actions/admin";

const INITIAL: FormResult = { ok: false, error: "" };

function Result({ state }: { state: FormResult }) {
  if (state.ok && state.message) {
    return (
      <Alert className="mt-2">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  if (!state.ok && state.error) {
    return (
      <Alert variant="destructive" className="mt-2">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function RoleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Update role
    </Button>
  );
}

export function UserControls({
  userId,
  role,
  suspended,
  isSelf,
}: {
  userId: string;
  role: "USER" | "ADMIN";
  suspended: boolean;
  isSelf: boolean;
}) {
  const [suspendState, suspendAction] = useActionState<FormResult, FormData>(
    (_p, fd) => setUserSuspended(fd),
    INITIAL,
  );
  const [roleState, roleAction] = useActionState<FormResult, FormData>(
    (_p, fd) => setUserRole(fd),
    INITIAL,
  );

  if (isSelf) {
    return (
      <p className="text-sm text-muted-foreground">
        This is your own account - role and suspension controls are disabled.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">Account status</h3>
        {suspended ? (
          <ModerationDialog
            triggerText="Re-enable account"
            triggerIcon={<UserCheck className="size-4" />}
            fields={{ userId, suspend: "false" }}
            title="Re-enable this account?"
            description="The user will be able to sign in and place orders again."
            confirmText="Re-enable"
            formAction={suspendAction}
          />
        ) : (
          <ModerationDialog
            triggerText="Suspend account"
            triggerIcon={<Ban className="size-4" />}
            triggerVariant="destructive"
            fields={{ userId, suspend: "true" }}
            title="Suspend this account?"
            description="The user is signed out on their next request and can't sign in or check out until re-enabled."
            noteLabel="Reason (optional)"
            notePlaceholder="Why is this account being suspended?"
            confirmText="Suspend"
            confirmVariant="destructive"
            formAction={suspendAction}
          />
        )}
        <Result state={suspendState} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Role</h3>
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <Select name="role" defaultValue={role}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">Customer</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
          <RoleSubmit />
          <ShieldCheck className="size-4 text-muted-foreground" />
        </form>
        <Result state={roleState} />
      </div>
    </div>
  );
}
