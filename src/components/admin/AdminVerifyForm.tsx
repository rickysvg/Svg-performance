"use client";

import { useActionState } from "react";
import { verifyGymMemberAction, type AdminActionState } from "@/app/actions/admin";
import { StatusBanner } from "@/components/StatusBanner";

export function AdminVerifyForm({
  userId,
  verified,
}: {
  userId: string;
  verified: boolean;
}) {
  const [state, action, pending] = useActionState(
    verifyGymMemberAction,
    {} as AdminActionState,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="targetUserId" value={userId} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="verified"
          defaultChecked={verified}
          className="h-5 w-5 accent-accent"
        />
        Verified SVG gym member
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full border border-line px-4 text-sm"
      >
        {pending ? "Saving…" : "Save verification"}
      </button>
    </form>
  );
}
