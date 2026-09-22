"use client";

import { useActionState } from "react";
import { joinChallengeAction, type ChallengeActionState } from "@/app/actions/challenges";
import { StatusBanner } from "@/components/StatusBanner";

export function ChallengeJoinForm({
  defaultTrack,
}: {
  defaultTrack?: string;
}) {
  const [state, action, pending] = useActionState(
    joinChallengeAction,
    {} as ChallengeActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Track
        <select
          name="track"
          defaultValue={defaultTrack ?? "beginner"}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          <option value="beginner">Beginner (show-up days)</option>
          <option value="advanced">Advanced (more show-up days)</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : defaultTrack ? "Update track" : "Opt in"}
      </button>
    </form>
  );
}
