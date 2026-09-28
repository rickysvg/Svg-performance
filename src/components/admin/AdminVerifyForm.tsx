"use client";

import { useActionState } from "react";
import { overrideGymMemberAction, type GymdeskActionState } from "@/app/actions/gymdesk";
import { StatusBanner } from "@/components/StatusBanner";

export function AdminVerifyForm({
  userId,
  verified,
  override = "none",
  note = "",
}: {
  userId: string;
  verified: boolean;
  override?: string;
  note?: string;
}) {
  const [state, action, pending] = useActionState(
    overrideGymMemberAction,
    {} as GymdeskActionState,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="targetUserId" value={userId} />
      <p className="text-xs text-muted">
        Current: {verified ? "verified member" : "not verified"}. Override always wins.
      </p>
      <label className="block text-sm">
        <span className="font-medium">Membership override</span>
        <select
          name="override"
          defaultValue={override || "none"}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
        >
          <option value="none">Auto (Gymdesk)</option>
          <option value="force_on">Force member</option>
          <option value="force_off">Force non-member</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Note (required)</span>
        <textarea
          name="note"
          required
          minLength={3}
          defaultValue={note}
          rows={2}
          placeholder="Why this override?"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full border border-line px-4 text-sm"
      >
        {pending ? "Saving…" : "Save override"}
      </button>
    </form>
  );
}
