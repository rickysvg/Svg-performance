"use client";

import { useActionState } from "react";
import { saveCheckInAction, type MobilityActionState } from "@/app/actions/mobility";
import { StatusBanner } from "@/components/StatusBanner";
import { KICK_MARKS, SIT_REACH_LEVELS } from "@/lib/mobility";

function Num({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        inputMode="decimal"
        defaultValue=""
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3"
      />
    </label>
  );
}

function Kick({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select name={name} defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3">
        <option value="">—</option>
        {KICK_MARKS.map((mark) => (
          <option key={mark} value={mark}>
            {mark}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckInForm({ unit }: { unit: string }) {
  const [state, action, pending] = useActionState(saveCheckInAction, {} as MobilityActionState);
  return (
    <form action={action} className="space-y-4">
      <StatusBanner error={state.error} />
      <p className="text-sm text-muted">
        About 5 minutes. Boxes start empty. Measure in {unit === "in" ? "inches" : "centimeters"}.
      </p>
      <Num name="sitReachValue" label={`Sit-and-reach past the toes (${unit})`} />
      <label className="block text-sm font-medium">
        Or a reach level
        <select name="sitReachLevel" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3">
          <option value="">—</option>
          {SIT_REACH_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Num name="frontSplitLeft" label={`Front split L (${unit} to hip)`} />
        <Num name="frontSplitRight" label={`Front split R (${unit} to hip)`} />
      </div>
      <Num name="sideSplit" label={`Side split (${unit} to groin)`} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          90/90 left (0–2)
          <input name="hipLeft" inputMode="numeric" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
        </label>
        <label className="block text-sm font-medium">
          90/90 right (0–2)
          <input name="hipRight" inputMode="numeric" defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3" />
        </label>
      </div>
      <p className="text-xs text-muted">0 needs hands to sit up. 1 sits tall. 2 switches sides without hands.</p>
      <div className="grid grid-cols-2 gap-3">
        <Num name="ankleLeft" label={`Knee-to-wall L (${unit})`} />
        <Num name="ankleRight" label={`Knee-to-wall R (${unit})`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Kick name="kickFrontLeft" label="Front kick height L" />
        <Kick name="kickFrontRight" label="Front kick height R" />
        <Kick name="kickSideLeft" label="Side kick height L" />
        <Kick name="kickSideRight" label="Side kick height R" />
      </div>
      <Num name="shoulderGap" label={`Shoulder reach gap (${unit}, 0 if fingers overlap)`} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="painFlag" className="h-5 w-5 accent-accent" />
        Pain during the check-in
      </label>
      <button type="submit" disabled={pending} className="touch-target w-full rounded-full bg-accent text-black">
        {pending ? "Saving…" : "Save check-in"}
      </button>
    </form>
  );
}
