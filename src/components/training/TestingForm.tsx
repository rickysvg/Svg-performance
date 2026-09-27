"use client";

import { useActionState } from "react";
import { saveTestingAction, type MobilityActionState } from "@/app/actions/mobility";
import { StatusBanner } from "@/components/StatusBanner";
import { STRENGTH_TEST_LIFTS } from "@/lib/testing-week";
import type { LoadUnit } from "@/lib/units";

export function TestingForm({
  loadUnit,
  lengthUnit,
  distanceUnit,
}: {
  loadUnit: LoadUnit;
  lengthUnit: string;
  distanceUnit: string;
}) {
  const [state, action, pending] = useActionState(saveTestingAction, {} as MobilityActionState);
  return (
    <form action={action} className="space-y-4">
      <StatusBanner error={state.error} />
      <p className="text-sm text-muted">Boxes start empty. Units follow your profile ({loadUnit}).</p>
      <label className="block text-sm font-medium">
        Broad jump ({lengthUnit})
        <input name="broadJumpValue" inputMode="decimal" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
      </label>
      <label className="block text-sm font-medium">
        Strength lift
        <select name="strengthExercise" defaultValue="Trap-bar deadlift" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3">
          {STRENGTH_TEST_LIFTS.map((lift) => (
            <option key={lift} value={lift}>
              {lift}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Load ({loadUnit})
          <input name="strengthLoad" inputMode="decimal" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
        </label>
        <label className="block text-sm font-medium">
          Reps
          <input name="strengthReps" inputMode="numeric" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
        </label>
      </div>
      <p className="text-xs text-muted">SVG estimates a max from that set. It is an estimate, not a tested max.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          10 s bike sprint
          <input name="bikeSprintValue" inputMode="decimal" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
        </label>
        <label className="block text-sm font-medium">
          Sprint unit
          <select name="bikeSprintUnit" defaultValue="rpm" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3">
            <option value="rpm">rpm</option>
            <option value="watts">watts</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        5-minute bike distance ({distanceUnit})
        <input name="bikeFiveMinValue" inputMode="decimal" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
      </label>
      <label className="block text-sm font-medium">
        Resting heart rate (optional)
        <input name="restingHr" inputMode="numeric" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
      </label>
      <button type="submit" disabled={pending} className="touch-target w-full rounded-full bg-accent text-black">
        {pending ? "Saving…" : "Save testing week"}
      </button>
    </form>
  );
}
