"use client";

import { useActionState } from "react";
import {
  saveDeepOnboardingAction,
  skipDeepOnboardingAction,
  type OnboardingActionState,
} from "@/app/actions/onboarding";
import { StatusBanner } from "@/components/StatusBanner";
import {
  COMPETITION_STATUS_OPTIONS,
  COACHING_TONE_OPTIONS,
  OBSTACLE_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  TRAINING_LOCATION_OPTIONS,
} from "@/lib/constants";
import type { ProfileRecord } from "@/lib/profile";

function dateInputValue(value: Date | null) {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function DeepOnboardingForm({ profile }: { profile: ProfileRecord }) {
  const [state, action, pending] = useActionState(
    saveDeepOnboardingAction,
    {} as OnboardingActionState,
  );
  const units = profile.preferredUnits || "lb";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Optional · step 2 of 2</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 rounded-full bg-accent/70" />
        </div>
        <p className="mt-2 text-xs text-muted">
          Skip any or all of this. Skipping still finishes onboarding and opens Home.
        </p>
      </div>
      <StatusBanner error={state.error} />

      <form action={action} className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2>Body weight</h2>
          <p className="text-xs text-muted">
            Stored in {units} from your required answers. Display only — we will not invent a
            meal plan or medical target from these numbers.
          </p>
          <label className="block">
            <span className="text-sm font-medium">Current body weight ({units})</span>
            <input
              name="currentWeight"
              type="number"
              step="0.1"
              min={units === "kg" ? 20 : 50}
              max={units === "kg" ? 250 : 500}
              defaultValue={profile.currentWeight ?? ""}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Goal weight ({units}, optional)</span>
            <input
              name="goalWeight"
              type="number"
              step="0.1"
              min={units === "kg" ? 20 : 50}
              max={units === "kg" ? 250 : 500}
              defaultValue={profile.goalWeight ?? ""}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2>How you train</h2>
          <fieldset>
            <legend className="text-sm font-medium">Typical session length</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {SESSION_LENGTH_OPTIONS.map((item) => (
                <label key={item.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="sessionLengthMin"
                    value={item.value}
                    defaultChecked={profile.sessionLengthMin === item.value}
                    className="h-5 w-5 accent-accent"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Training location</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {TRAINING_LOCATION_OPTIONS.map((item) => (
                <label key={item.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="trainingLocation"
                    value={item.value}
                    defaultChecked={profile.trainingLocation === item.value}
                    className="h-5 w-5 accent-accent"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2>Competition</h2>
          <p className="text-xs text-muted">
            Saved as a flag for later fight-camp tools. This app still does not run a fight camp.
          </p>
          <fieldset>
            <legend className="text-sm font-medium">Status</legend>
            <div className="mt-2 grid gap-2">
              {COMPETITION_STATUS_OPTIONS.map((item) => (
                <label key={item.value} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="competitionStatus"
                    value={item.value}
                    defaultChecked={profile.competitionStatus === item.value}
                    className="h-5 w-5 accent-accent"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="text-sm font-medium">Next fight date (optional)</span>
            <input
              name="nextFightDate"
              type="date"
              defaultValue={dateInputValue(profile.nextFightDate)}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2>Coaching style</h2>
          <fieldset>
            <legend className="text-sm font-medium">Preferred coaching tone</legend>
            <div className="mt-2 grid gap-2">
              {COACHING_TONE_OPTIONS.map((item) => (
                <label key={item.value} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="coachingTone"
                    value={item.value}
                    defaultChecked={profile.coachingTone === item.value}
                    className="h-5 w-5 accent-accent"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Biggest obstacle (pick one or more)</legend>
            <div className="mt-2 grid gap-2">
              {OBSTACLE_OPTIONS.map((item) => (
                <label key={item.value} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="obstacles"
                    value={item.value}
                    defaultChecked={profile.obstacles.includes(item.value)}
                    className="h-5 w-5 accent-accent"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <button
          type="submit"
          disabled={pending}
          className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save and go to Home"}
        </button>
      </form>

      <form action={skipDeepOnboardingAction}>
        <button
          type="submit"
          className="touch-target w-full rounded-full border border-line font-semibold"
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}
