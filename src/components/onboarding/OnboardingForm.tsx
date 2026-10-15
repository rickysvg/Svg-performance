"use client";

import { useActionState, useRef, useState } from "react";
import { completeOnboardingAction, type OnboardingActionState } from "@/app/actions/onboarding";
import { CoachPicker } from "@/components/coach/CoachPicker";
import { StatusBanner } from "@/components/StatusBanner";
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVELS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  LIFT_DAY_OPTIONS,
  TRAINING_FOCUS_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants";
import { OutsideTrainingFields } from "@/components/profile/OutsideTrainingFields";
import { defaultLiftDays } from "@/lib/member-plan";
import type { ProfileRecord } from "@/lib/profile";

export function OnboardingForm({
  profile,
  email,
}: {
  profile: ProfileRecord;
  email?: string | null;
}) {
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    {} as OnboardingActionState,
  );
  const [step, setStep] = useState(1);
  const [trainingFocus, setTrainingFocus] = useState(profile.trainingFocus || "martial_arts_sc");
  const [level, setLevel] = useState(profile.experienceLevel || "beginner");
  const suggestedLifts = profile.liftDaysPerWeek ?? defaultLiftDays(level, email);
  const formRef = useRef<HTMLFormElement>(null);

  function goToCoach() {
    const form = formRef.current;
    if (!form) return;
    const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "[data-intake-step='1'] input, [data-intake-step='1'] select, [data-intake-step='1'] textarea",
    );
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return;
      }
    }
    setStep(2);
  }

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Intake · step {step} of 2
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full bg-accent/70 ${step === 1 ? "w-1/2" : "w-full"}`}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {step === 1
            ? "Required first. Next you pick your SVG Coach."
            : "Pick a face and a style. You can change both later in Profile."}
        </p>
      </div>
      <StatusBanner error={state.error} />

      <div data-intake-step="1" hidden={step !== 1} className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <h2>About you</h2>
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
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Training focus</legend>
          <div className="mt-2 grid gap-2">
            {TRAINING_FOCUS_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="trainingFocus"
                  value={option.value}
                  checked={trainingFocus === option.value}
                  onChange={() => setTrainingFocus(option.value)}
                  className="h-5 w-5 accent-accent"
                  required
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {trainingFocus === "sc_only" ? (
          <input type="hidden" name="primaryFocus" value={profile.primaryFocus || "general-fitness"} />
        ) : (
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
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <h2>Training setup</h2>
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
          <span className="text-sm font-medium">Lift days per week</span>
          <select
            name="liftDaysPerWeek"
            required
            defaultValue={String(suggestedLifts)}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            {LIFT_DAY_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} lift days
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            You will not lift every day. The rest of the week is cardio, mobility, and — on the martial
            arts track — bag work.
          </span>
        </label>
        <OutsideTrainingFields days={profile.outsideTraining ?? []} />
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
          <legend className="text-sm font-medium">Weight units</legend>
          <input type="hidden" name="preferredUnits" value="lb" />
          <p className="mt-2 text-sm text-muted">Pounds (lb). Loads and body weight use lbs.</p>
        </fieldset>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <h2>Optional notes</h2>
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
            Shared with a coach if you request help. SVG Coach will not diagnose or treat.
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
      </div>

      <div data-intake-step="2" hidden={step !== 2} className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2>Your coach</h2>
          <CoachPicker
            coachId={profile.aiCoachId}
            coachingStyle={profile.coachingStyle}
            idPrefix="onboarding-coach"
          />
        </section>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="touch-target w-full rounded-full border border-line font-semibold"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={pending}
          className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save and continue"}
        </button>
      </div>

      {step === 1 ? (
        <button
          type="button"
          onClick={goToCoach}
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          Next: pick your coach
        </button>
      ) : null}
    </form>
  );
}
