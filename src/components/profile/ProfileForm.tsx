"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileActionState } from "@/app/actions/profile";
import { StatusBanner } from "@/components/StatusBanner";
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVELS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants";
import type { ProfileRecord } from "@/lib/profile";

export function ProfileForm({ profile }: { profile: ProfileRecord }) {
  const [state, action, pending] = useActionState(
    saveProfileAction,
    {} as ProfileActionState,
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">Training profile</h2>
      <StatusBanner error={state.error} success={state.success} />

      <label className="block">
        <span className="text-sm font-medium">Display name</span>
        <input
          name="displayName"
          defaultValue={profile.displayName}
          required
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Main goal</span>
        <select
          name="goalKey"
          defaultValue={profile.goalKey || "other"}
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
          defaultValue={
            profile.goalKey && profile.goals.startsWith(
              GOAL_OPTIONS.find((goal) => goal.value === profile.goalKey)?.label ?? "___",
            )
              ? profile.goals.replace(/^.+?—\s*/, "")
              : profile.goals
          }
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Experience</span>
        <select
          name="experienceLevel"
          defaultValue={profile.experienceLevel}
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

      <fieldset>
        <legend className="text-sm font-medium">Equipment you can use</legend>
        <div className="mt-2 grid gap-2">
          {EQUIPMENT_OPTIONS.map((item) => (
            <label key={item} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="equipment"
                value={item}
                defaultChecked={profile.equipment.includes(item)}
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

      <label className="block">
        <span className="text-sm font-medium">Hours per week (optional)</span>
        <input
          name="hoursPerWeek"
          type="number"
          min={0}
          max={40}
          defaultValue={profile.hoursPerWeek ?? ""}
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
                defaultChecked={profile.preferredUnits === unit}
                className="h-5 w-5 accent-accent"
              />
              {unit}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium">Training limitations (optional)</span>
        <textarea
          name="trainingLimitations"
          defaultValue={profile.trainingLimitations}
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
        <span className="mt-1 block text-xs text-muted">
          Shared with a coach if you request help. Coach Savage AI will not diagnose or treat.
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Food preferences</span>
        <textarea
          name="foodPreferences"
          defaultValue={profile.foodPreferences}
          rows={2}
          placeholder="Example: I eat meat, I skip dairy."
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Allergies or foods to avoid</span>
        <textarea
          name="allergies"
          defaultValue={profile.allergies}
          rows={2}
          placeholder="Example: peanuts. Always verify ingredients yourself."
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
        <span className="mt-1 block text-xs text-muted">
          Always verify ingredients yourself. Food numbers in this app are estimates.
        </span>
      </label>

      <fieldset className="rounded-xl border border-line p-3">
        <legend className="text-sm font-medium">Daily nutrition targets (estimates)</legend>
        <p className="mt-1 text-xs text-muted">
          Used on Home rings. These are your numbers or DEMO defaults — not a personalized
          meal plan from a coach.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Calories
            <input
              name="calorieTarget"
              type="number"
              min={800}
              max={5000}
              defaultValue={profile.calorieTarget}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
          <label className="block text-sm">
            Protein (g)
            <input
              name="proteinTargetG"
              type="number"
              min={40}
              max={400}
              defaultValue={profile.proteinTargetG}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
          <label className="block text-sm">
            Carbs (g)
            <input
              name="carbsTargetG"
              type="number"
              min={40}
              max={600}
              defaultValue={profile.carbsTargetG}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
          <label className="block text-sm">
            Fat (g)
            <input
              name="fatTargetG"
              type="number"
              min={20}
              max={250}
              defaultValue={profile.fatTargetG}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl border border-line p-3">
        <input
          type="checkbox"
          name="claimsGymMembership"
          defaultChecked={profile.claimsGymMembership}
          className="mt-1 h-5 w-5 accent-accent"
        />
        <span className="text-sm">
          I train at SVG MMA Academy. This does <strong>not</strong> verify
          membership or change price.
        </span>
      </label>

      <div className="rounded-xl border border-line p-3 text-sm text-muted">
        Adult confirmed: {profile.isAdultConfirmed ? "yes" : "no"}. Gym
        membership verified by admin:{" "}
        {profile.gymMembershipVerified ? "yes" : "no (default)"}. You cannot
        flip the verified flag yourself.
      </div>

      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
