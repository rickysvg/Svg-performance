"use client";

import { useActionState } from "react";
import { saveChallengeAction, type ChallengeActionState } from "@/app/actions/challenges";
import { StatusBanner } from "@/components/StatusBanner";
export function ChallengeAdminForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action, pending] = useActionState(
    saveChallengeAction,
    {} as ChallengeActionState,
  );
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold">Create or update a month</h2>
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="monthKey"
        required
        defaultValue={defaultMonth}
        placeholder="2026-09"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input
        name="title"
        required
        placeholder="Title"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <textarea
        name="summary"
        rows={3}
        placeholder="Consistency scoring — not heaviest lift"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Beginner days
          <input
            name="beginnerGoalDays"
            type="number"
            min={1}
            max={31}
            defaultValue={8}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="text-sm">
          Advanced days
          <input
            name="advancedGoalDays"
            type="number"
            min={1}
            max={31}
            defaultValue={16}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-accent" />
        Make this the active month
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDemo" defaultChecked className="h-5 w-5 accent-accent" />
        Label DEMO
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save challenge"}
      </button>
    </form>
  );
}
