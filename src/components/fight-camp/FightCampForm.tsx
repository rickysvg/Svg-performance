"use client";

import { useActionState } from "react";
import { saveFightCampAction, type CampActionState } from "@/app/actions/fight-camp";
import { StatusBanner } from "@/components/StatusBanner";
import { FIGHT_DISCIPLINES } from "@/lib/fight-disciplines";

export function FightCampForm({
  todayKey,
  fightDate = "",
  weightClass = "",
  discipline = "",
  editing = false,
}: {
  todayKey: string;
  fightDate?: string;
  weightClass?: string;
  discipline?: string;
  editing?: boolean;
}) {
  const [state, action, pending] = useActionState(saveFightCampAction, {} as CampActionState);

  return (
    <form action={action} className="space-y-4">
      <StatusBanner error={state.error} />
      <label className="block text-sm">
        Fight date
        <input
          name="fightDate"
          type="date"
          required
          min={todayKey}
          defaultValue={fightDate}
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        />
      </label>
      <label className="block text-sm">
        Discipline
        <span className="mt-0.5 block text-xs text-muted">Optional</span>
        <select
          name="discipline"
          defaultValue={discipline}
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        >
          <option value="">Leave blank</option>
          {FIGHT_DISCIPLINES.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Weight class
        <span className="mt-0.5 block text-xs text-muted">Optional. A class name, not a cut plan.</span>
        <input
          name="weightClass"
          defaultValue={weightClass}
          maxLength={40}
          placeholder="77 kg class"
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-lg text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : editing ? "Save camp" : "Build camp"}
      </button>
    </form>
  );
}
