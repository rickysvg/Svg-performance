"use client";

import { useActionState, useMemo, useState } from "react";
import { deleteAccountAction, type DeleteAccountState } from "@/app/actions/account";
import { isDeleteConfirmation } from "@/lib/account-confirm";
import { StatusBanner } from "@/components/StatusBanner";
import { ManageStoreSubscriptionButton } from "@/components/native/ManageStoreSubscriptionButton";
import { NativeOnly } from "@/components/native/NativeOnly";

export function DeleteAccountForm({
  email,
  store,
}: {
  email: string;
  store?: string | null;
}) {
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    {} as DeleteAccountState,
  );
  const [confirmation, setConfirmation] = useState("");
  const enabled = useMemo(
    () => isDeleteConfirmation(confirmation, email),
    [confirmation, email],
  );

  const storeName = store === "play_store" ? "Google Play" : store === "app_store" ? "the App Store" : "";
  return (
    <div className="space-y-4">
      {storeName ? (
        <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg">Cancel the store subscription first</h2>
          <p className="text-sm text-muted">
            Your subscription is billed by {storeName}. Deleting your account doesn&apos;t cancel it. Cancel it first in your device settings.
          </p>
          <NativeOnly>
            <ManageStoreSubscriptionButton />
          </NativeOnly>
        </section>
      ) : null}
    <form data-testid="profile-delete-confirm" action={action} className="space-y-4" data-delete-confirm>
      <StatusBanner error={state.error} />
      <label className="block">
        <span className="text-sm font-medium">Type DELETE or {email}</span>
        <input
          data-testid="profile-delete-confirmation"
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
        data-testid="profile-delete-permanently-delete-account"
        type="submit"
        disabled={!enabled || pending}
        className="touch-target w-full rounded-full bg-danger text-base font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Deleting…" : "Permanently delete account"}
      </button>
    </form>
    </div>
  );
}
