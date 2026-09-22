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
    <form action={action}>
      <StatusBanner error={state.error} />
      <input type="hidden" name="pathSlug" value={pathSlug} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : label}
      </button>
    </form>
  );
}
