"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  markFormCheckInReviewAction,
  saveFormCheckFeedbackAction,
  type FormCheckActionState,
} from "@/app/actions/form-check";
import { StatusBanner } from "@/components/StatusBanner";

const CHIPS = [
  "Chin tucked.",
  "Hands home.",
  "Brace first.",
  "Full range.",
  "Hips back.",
  "Eyes up.",
  "Nice rep.",
  "Slow the lowering.",
  "Rear hand back.",
  "Even stance.",
] as const;

export function FormCheckReviewForm({
  checkId,
  status,
  feedback,
}: {
  checkId: string;
  status: string;
  feedback: string;
}) {
  const [state, action, pending] = useActionState(
    saveFormCheckFeedbackAction,
    {} as FormCheckActionState,
  );
  const [note, setNote] = useState(feedback);

  function addChip(phrase: string) {
    setNote((current) => {
      if (current.includes(phrase)) return current;
      const trimmed = current.trim();
      return trimmed ? `${trimmed} ${phrase}` : phrase;
    });
  }

  return (
    <div className="mt-4 space-y-3" data-form-check-review={checkId}>
      <StatusBanner error={state.error} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => addChip(chip)}
            className="shrink-0 rounded-full border border-[#CBF805]/50 bg-black px-3 py-2 text-sm text-[#CBF805]"
          >
            {chip.replace(/\.$/, "")}
          </button>
        ))}
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="checkId" value={checkId} />
        <label className="block text-sm">
          Feedback the athlete will see
          <textarea
            name="feedback"
            required
            rows={4}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Chin down. Bring the rear hand back after the cross."
            className="mt-1 w-full rounded-2xl border border-[#2a3124] bg-black px-4 py-3 text-base text-white"
          />
        </label>
        <p className="text-xs text-muted">Signed SVG Coach in the app. Your name stays off the note.</p>
        <button
          type="submit"
          disabled={pending}
          className="touch-target w-full rounded-full bg-[#CBF805] text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : status === "reviewed" ? "Update feedback" : "Mark reviewed"}
        </button>
      </form>
      {status !== "reviewed" ? (
        <form action={markFormCheckInReviewAction}>
          <input type="hidden" name="checkId" value={checkId} />
          <button type="submit" className="min-h-11 w-full text-sm text-muted underline">
            Mark in review
          </button>
        </form>
      ) : null}
    </div>
  );
}
