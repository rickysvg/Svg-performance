"use client";

import { useActionState } from "react";
import { completePathStepAction, type PathActionState } from "@/app/actions/paths";
import { StatusBanner } from "@/components/StatusBanner";

export function CompleteStepForm({
  pathSlug,
  stepKey,
}: {
  pathSlug: string;
  stepKey: string;
}) {
  const [state, action, pending] = useActionState(completePathStepAction, {} as PathActionState);
  return (
    <form action={action} className="mt-2">
      <StatusBanner error={state.error} />
      <input type="hidden" name="pathSlug" value={pathSlug} />
      <input type="hidden" name="stepKey" value={stepKey} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-accent underline disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark this milestone done"}
      </button>
    </form>
  );
}
