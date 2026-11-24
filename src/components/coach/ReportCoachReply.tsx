"use client";

import { useState } from "react";
import { reportCoachReplyAction, type CoachReportState } from "@/app/actions/coach-report";

const REASONS = [
  ["offensive", "Offensive"],
  ["harmful", "Harmful"],
  ["wrong", "Wrong"],
  ["other", "Other"],
] as const;

export function ReportCoachReply({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CoachReportState>({});
  const [pending, setPending] = useState(false);
  if (!messageId || messageId.startsWith("local-")) return null;
  return (
    <>
      <button
        type="button"
        data-report-coach-reply
        className="text-[10px] text-white/45 underline"
        onClick={() => {
          setState({});
          setOpen(true);
        }}
      >
        Report
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-reply-title">
          <form
            className="w-full max-w-md space-y-3 rounded-2xl bg-[#101216] p-5 text-left text-white ring-1 ring-white/10"
            action={(formData) => {
              setPending(true);
              void reportCoachReplyAction(state, formData).then((result) => {
                setState(result);
                setPending(false);
              });
            }}
          >
            <h2 id="report-reply-title" className="text-lg">Report this reply</h2>
            <input type="hidden" name="messageId" value={messageId} />
            <label className="block text-sm">
              Reason
              <select name="reason" defaultValue="offensive" className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2">
                {REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Note (optional)
              <textarea name="note" rows={3} maxLength={500} className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2" />
            </label>
            {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
            {state.success ? <p className="text-sm text-[#CBF805]">{state.success}</p> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={pending || Boolean(state.success)} className="touch-target flex-1 rounded-full bg-[#CBF805] text-black disabled:opacity-60">
                {pending ? "Sending…" : "Submit report"}
              </button>
              <button type="button" className="touch-target flex-1 rounded-full border border-white/20" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
