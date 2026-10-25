"use client";

import { useState } from "react";
import { useWorkoutMove } from "@/components/training/WorkoutMove";
import { nextIntentSeq } from "@/lib/plan-intent";
import { submitPlanIntent } from "@/lib/plan-intent-outbox";

export function MoveBackButton({
  sessionKey,
  weekStart,
  home,
}: {
  sessionKey: string;
  weekStart: string;
  home: string;
}) {
  const move = useWorkoutMove();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div data-move-back-row={sessionKey}>
      <button
        type="button"
        data-move-back={home}
        disabled={pending}
        onClick={() => {
          setError("");
          setPending(true);
          const run = move
            ? move.moveHome(sessionKey, weekStart, home)
            : submitPlanIntent({
                sessionKey,
                weekStart,
                toDay: home,
                intentSeq: nextIntentSeq(sessionKey),
                intent: "restore",
              });
          void run
            .then((result) => {
              if (result.error) setError(result.error);
            })
            .finally(() => setPending(false));
        }}
        className="text-sm font-semibold text-[#CBF805] underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? "Moving…" : `Move back to ${home}`}
      </button>
      {error ? (
        <p className="mt-1 text-sm text-[#FF3B3B]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
