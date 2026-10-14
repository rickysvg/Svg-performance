"use client";

import { useActionState } from "react";
import { saveCoachChoiceAction, type CoachChoiceState } from "@/app/actions/coach-choice";
import { CoachChoiceFields } from "@/components/coach/CoachChoiceFields";
import { StatusBanner } from "@/components/StatusBanner";
import { resolveCoach, resolveCoachingStyle } from "@/lib/coaches";
import type { ProfileRecord } from "@/lib/profile";

export function CoachChoiceForm({
  profile,
  mode,
}: {
  profile: ProfileRecord;
  mode: "onboarding" | "profile";
}) {
  const [state, action, pending] = useActionState(saveCoachChoiceAction, {} as CoachChoiceState);
  const coach = resolveCoach(profile.aiCoachId);
  const style = resolveCoachingStyle(profile.coachingStyle);
  const onboarding = mode === "onboarding";

  return (
    <form action={action} className="space-y-6">
      <StatusBanner error={state.error} success={state.success} />
      {onboarding ? <input type="hidden" name="next" value="/onboarding/deeper" /> : null}
      <CoachChoiceFields coachId={coach.id} styleId={style.id} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : onboarding ? "Continue" : "Save coach"}
      </button>
    </form>
  );
}
