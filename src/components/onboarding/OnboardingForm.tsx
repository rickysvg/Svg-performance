"use client";

import { useActionState } from "react";
import { completeOnboardingAction, type OnboardingActionState } from "@/app/actions/onboarding";
import { StatusBanner } from "@/components/StatusBanner";
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVELS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants";
import type { ProfileRecord } from "@/lib/profile";

export function OnboardingForm({ profile }: { profile: ProfileRecord }) {
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    {} as OnboardingActionState,
  );

  return (
    <form action={action} className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Intake · 2 sections</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-full rounded-full bg-accent/70" />
        </div>
        <p className="mt-2 text-xs text-muted">
          Required first. Next screen is optional and can be skipped.
        </p>
      </div>
      <StatusBanner error={state.error} />

      <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-semibold">About you</h2>
        <label className="block">
          <span className="text-sm font-medium">What should we call you?</span>
          <input
            name="displayName"
            required
            defaultValue={profile.displayName}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Main goal</span>
          <select
            name="goalKey"
            required
            defaultValue={profile.goalKey || "stronger-for-class"}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            {GOAL_OPTIONS.map((goal) => (
              <option key={goal.value} value={goal.value}>
                {goal.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">More about that goal (optional)</span>
          <textarea
            name="goalNote"
            rows={2}
            placeholder="Optional extra detail"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Experience level</span>
          <select
            name="experienceLevel"
            required
            defaultValue={profile.experienceLevel || "beginner"}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Primary martial art / focus</span>
          <select
            name="primaryFocus"
            required
            defaultValue={profile.primaryFocus || "mma"}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            {FOCUS_OPTIONS.map((focus) => (
              <option key={focus.value} value={focus.value}>
                {focus.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-semibold">Training setup</h2>
        <fieldset>
          <legend className="text-sm font-medium">Equipment you can use</legend>
          <div className="mt-2 grid gap-2">
            {EQUIPMENT_OPTIONS.map((item) => (
              <label key={item} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="equipment"
                  value={item}
                  defaultChecked={profile.equipment.includes(item) || item === "Bodyweight only"}
                  className="h-5 w-5 accent-accent"
                />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Days you can train</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {WEEKDAYS.map((day) => (
              <label key={day} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="weeklyAvailability"
                  value={day}
                  defaultChecked={profile.weeklyAvailability.includes(day)}
                  className="h-5 w-5 accent-accent"
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-sm font-medium">Sessions per week (optional)</span>
          <input
            name="sessionsPerWeek"
            type="number"
            min={1}
            max={14}
            defaultValue={profile.sessionsPerWeek ?? ""}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Preferred units</legend>
          <div className="mt-2 flex gap-4">
            {(["lb", "kg"] as const).map((unit) => (
              <label key={unit} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferredUnits"
                  value={unit}
                  defaultChecked={(profile.preferredUnits || "lb") === unit}
                  className="h-5 w-5 accent-accent"
                />
                {unit}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-semibold">Optional notes</h2>
        <p className="text-xs text-muted">Skip any of these. You can add them later in Profile.</p>
        <label className="block">
          <span className="text-sm font-medium">Training limitations</span>
          <textarea
            name="trainingLimitations"
            rows={2}
            placeholder="Injuries, movements to avoid, or other notes"
            defaultValue={profile.trainingLimitations}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
          <span className="mt-1 block text-xs text-muted">
            Shared with a coach if you request help. Coach Savage AI will not diagnose or treat.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Dietary preferences</span>
          <textarea
            name="foodPreferences"
            rows={2}
            defaultValue={profile.foodPreferences}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Allergies</span>
          <textarea
            name="allergies"
            rows={2}
            defaultValue={profile.allergies}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
          <span className="mt-1 block text-xs text-muted">
            Always verify ingredients yourself. Food numbers in this app are estimates.
          </span>
        </label>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
