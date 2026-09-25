"use client";

import { useActionState, useMemo, useState } from "react";
import { deleteAccountAction, type DeleteAccountState } from "@/app/actions/account";
import { isDeleteConfirmation } from "@/lib/account-confirm";
import { StatusBanner } from "@/components/StatusBanner";

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    {} as DeleteAccountState,
  );
  const [confirmation, setConfirmation] = useState("");
  const enabled = useMemo(
    () => isDeleteConfirmation(confirmation, email),
    [confirmation, email],
  );

  return (
    <form action={action} className="space-y-4" data-delete-confirm>
      <StatusBanner error={state.error} />
      <label className="block">
        <span className="text-sm font-medium">Type DELETE or {email}</span>
        <input
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          placeholder="DELETE"
        />
      </label>
      <button
        type="submit"
        disabled={!enabled || pending}
        className="touch-target w-full rounded-full bg-danger text-base font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Deleting…" : "Permanently delete account"}
      </button>
    </form>
  );
}
