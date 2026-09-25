"use client";

import { useActionState } from "react";
import { enrollPathAction, type PathActionState } from "@/app/actions/paths";
import { StatusBanner } from "@/components/StatusBanner";

export function EnrollPathForm({
  pathSlug,
  label,
}: {
  pathSlug: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(enrollPathAction, {} as PathActionState);
  return (
    <form action={action} className="w-full max-w-xs space-y-2">
      <StatusBanner error={state.error} />
      <input type="hidden" name="pathSlug" value={pathSlug} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent px-4 text-sm text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : label}
      </button>
    </form>
  );
}
