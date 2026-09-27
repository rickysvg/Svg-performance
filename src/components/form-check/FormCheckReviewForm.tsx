"use client";

import { useActionState } from "react";
import {
  markFormCheckInReviewAction,
  saveFormCheckFeedbackAction,
  type FormCheckActionState,
} from "@/app/actions/form-check";
import { StatusBanner } from "@/components/StatusBanner";

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

  return (
    <div className="mt-4 space-y-3">
      <StatusBanner error={state.error} />
      {status !== "reviewed" ? (
        <form action={markFormCheckInReviewAction}>
          <input type="hidden" name="checkId" value={checkId} />
          <button
            type="submit"
            className="touch-target w-full rounded-full border border-black bg-white text-sm font-semibold"
          >
            Mark in review
          </button>
        </form>
      ) : null}
      <form action={action} className="space-y-3">
        <input type="hidden" name="checkId" value={checkId} />
        <label className="block text-sm">
          Feedback the athlete will see
          <textarea
            name="feedback"
            required
            rows={4}
            maxLength={2000}
            defaultValue={feedback}
            placeholder="Chin down. Bring the rear hand back after the cross."
            className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base"
          />
        </label>
        <p className="text-xs text-muted">Signed SVG Coach in the app. Your name stays off the note.</p>
        <button
          type="submit"
          disabled={pending}
          className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : status === "reviewed" ? "Update feedback" : "Mark reviewed"}
        </button>
      </form>
    </div>
  );
}
