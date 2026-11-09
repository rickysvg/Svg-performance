"use client";

import { useState } from "react";
import { setCoachMotivationEnabled } from "@/app/actions/profile";
import { COACH_WORKOUT_MOTIVATION_ENABLED, coachVoiceEnabled } from "@/lib/coach/config";
import type { MotivationView } from "@/lib/coach/motivation";

/**
 * In-workout coach lines stay written. This control does not speak, prefetch
 * audio, or open an audio session. Hearing the coach is a separate tap on a
 * speak or read-aloud button.
 */
export function WorkoutCoachCues(props: {
  initialEnabled: boolean;
  coachId: string;
  view: MotivationView;
}) {
  if (!COACH_WORKOUT_MOTIVATION_ENABLED || !coachVoiceEnabled()) return null;
  return <WorkoutCoachCuesLive initialEnabled={props.initialEnabled} />;
}

function WorkoutCoachCuesLive({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <button
      type="button"
      data-coach-motivation={enabled ? "on" : "off"}
      aria-pressed={enabled}
      aria-label="Coach notes during workouts"
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        void setCoachMotivationEnabled(next);
      }}
      className="touch-target text-sm font-medium"
    >
      {enabled ? "Coach on" : "Coach off"}
    </button>
  );
}
