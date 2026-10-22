"use client";

import { useState } from "react";
import { setCoachMotivationEnabled } from "@/app/actions/profile";
import { COACH_WORKOUT_MOTIVATION_ENABLED } from "@/lib/coach/config";

export function CoachMotivationToggle({ enabled }: { enabled: boolean }) {
  if (!COACH_WORKOUT_MOTIVATION_ENABLED) return null;
  return <CoachMotivationToggleLive enabled={enabled} />;
}

function CoachMotivationToggleLive({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      await setCoachMotivationEnabled(next);
    } catch {
      setOn(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-5" data-coach-motivation-setting>
      <h2 className="text-lg">Coach motivation during workouts</h2>
      <p className="text-sm text-muted">
        Short cues from your coach at the start, between exercises, and on the last 10 seconds of
        rest. On by default. Off stays silent.
      </p>
      <button
        data-testid="profile-coach-motivation"
        type="button"
        data-coach-motivation={on ? "on" : "off"}
        aria-pressed={on}
        disabled={pending}
        onClick={() => void toggle()}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-3 text-left text-sm"
      >
        <span>{on ? "Coach motivation on" : "Coach motivation off"}</span>
        <span
          aria-hidden
          className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-accent" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-black transition-transform ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
    </section>
  );
}
