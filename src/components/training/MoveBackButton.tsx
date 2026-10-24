"use client";

import { useState, useTransition } from "react";
import { moveWorkoutHomeAction } from "@/app/actions/move-home";

export function MoveBackButton({
  sessionKey,
  weekStart,
  home,
}: {
  sessionKey: string;
  weekStart: string;
  home: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div data-move-back-row={sessionKey}>
      <button
        type="button"
        data-move-back={home}
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await moveWorkoutHomeAction(sessionKey, weekStart);
            if (result.error) setError(result.error);
          });
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
