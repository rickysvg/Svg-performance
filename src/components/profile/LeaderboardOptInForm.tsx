"use client";

import { useActionState } from "react";
import {
  setLeaderboardOptInAction,
  type ProfileActionState,
} from "@/app/actions/profile";
import { StatusBanner } from "@/components/StatusBanner";

export function LeaderboardOptInForm({ optedIn }: { optedIn: boolean }) {
  const [state, action, pending] = useActionState(
    setLeaderboardOptInAction,
    {} as ProfileActionState,
  );

  return (
    <form
      id="leaderboard"
      action={action}
      className="space-y-3 rounded-2xl border border-line bg-card p-5"
    >
      <h2 className="text-lg">Monthly leaderboard</h2>
      <p className="text-sm text-muted">
        Off by default. Opt in to appear on the monthly workout board. Only your
        display name is shown. Emails never appear. Academy filter shows verified
        academy members only.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
        <input
          type="checkbox"
          name="leaderboardOptIn"
          defaultChecked={optedIn}
          className="mt-1 h-5 w-5 accent-accent"
        />
        <span className="text-sm">
          Show my display name on the monthly workout leaderboard.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save leaderboard preference"}
      </button>
    </form>
  );
}
