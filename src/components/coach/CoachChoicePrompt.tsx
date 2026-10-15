"use client";

import {
  dismissCoachChoiceAction,
  saveCoachChoiceAction,
} from "@/app/actions/profile";
import { CoachPicker } from "@/components/coach/CoachPicker";
import { resolveAiCoach, resolveCoachingStyle } from "@/lib/coaches";

export function CoachChoicePrompt() {
  const coach = resolveAiCoach();
  const style = resolveCoachingStyle();

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" data-coach-choice-prompt>
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-choice-title"
        className="relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-6"
      >
        <p className="text-xs uppercase tracking-wide text-muted">SVG Coach</p>
        <h2 id="coach-choice-title" className="mt-1 text-xl">
          Pick your coach
        </h2>
        <p className="mt-1 text-sm text-muted">
          Until you choose, SVG Coach uses {coach.name} and a {style.label.toLowerCase()} style.
          You can change both later in Profile.
        </p>
        <form action={saveCoachChoiceAction} className="mt-4 space-y-4">
          <CoachPicker coachId={coach.id} coachingStyle={style.value} idPrefix="prompt-coach" />
          <button
            type="submit"
            className="touch-target w-full rounded-full bg-accent text-black"
          >
            Save coach
          </button>
        </form>
        <form action={dismissCoachChoiceAction} className="mt-2">
          <button
            type="submit"
            className="touch-target w-full rounded-full border border-line text-sm font-semibold"
          >
            Keep {coach.name}, {style.label}
          </button>
        </form>
      </div>
    </div>
  );
}
