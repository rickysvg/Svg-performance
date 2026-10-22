"use client";

import { useActionState } from "react";
import { cancelFightCampAction, type CampActionState } from "@/app/actions/fight-camp";
import { StatusBanner } from "@/components/StatusBanner";

export function CancelCampForm() {
  const [state, action, pending] = useActionState(cancelFightCampAction, {} as CampActionState);
  return (
    <form data-testid="fight-camp-form" action={action} className="space-y-3">
      <StatusBanner error={state.error} />
      <button
        data-testid="fight-camp-cancel-camp"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-black bg-white font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel camp"}
      </button>
    </form>
  );
}
