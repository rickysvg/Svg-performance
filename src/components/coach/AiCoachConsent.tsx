"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAiCoachConsentAction } from "@/app/actions/coach-consent";

export function WithdrawAiCoachConsent() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className="touch-target rounded-full border border-line px-4 text-sm"
      onClick={() => {
        setPending(true);
        void setAiCoachConsentAction(false).then(() => {
          setPending(false);
          router.refresh();
        });
      }}
    >
      {pending ? "Saving…" : "Withdraw AI coach consent"}
    </button>
  );
}

export function AiCoachConsent({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-[#101216] p-5 text-white ring-1 ring-white/10">
        <h2 id="ai-consent-title" className="text-lg">SVG Coach uses AI</h2>
        <p className="text-sm text-white/80">
          SVG Coach is powered by AI (OpenAI). To answer, we send your message and training context
          (experience, goals, schedule, injury or limitation notes, fight-camp details, and plan or
          workout data when you ask about programming) to OpenAI. Don&apos;t share medical details you
          want kept private.
        </p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            className="touch-target w-full rounded-full bg-[#CBF805] text-black disabled:opacity-60"
            onClick={() => {
              setPending(true);
              void setAiCoachConsentAction(true).then((result) => {
                setPending(false);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                onClose();
                router.refresh();
              });
            }}
          >
            {pending ? "Saving…" : "Agree & continue"}
          </button>
          <button
            type="button"
            className="touch-target w-full rounded-full border border-white/20"
            onClick={onClose}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
