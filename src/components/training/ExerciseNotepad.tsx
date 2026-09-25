"use client";

import { useActionState, useState } from "react";
import { saveExerciseNoteAction, type ExerciseNoteState } from "@/app/actions/exercise-notes";
import { StatusBanner } from "@/components/StatusBanner";
import { useCoachStream } from "@/components/coach/useCoachStream";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";
import type { ExerciseNoteView } from "@/lib/exercise-notes";

function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M3.5 2.75h6.2L12.5 5.5v7.75H3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9.6 2.85V5.6h2.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 8.2h5.6M5.2 10.6h3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ExerciseNotepad({
  exerciseName,
  programDayId = "",
  workoutId = "",
  logMode = "",
  plannedLine = "",
  note,
}: {
  exerciseName: string;
  programDayId?: string;
  workoutId?: string;
  logMode?: string;
  plannedLine?: string;
  note?: ExerciseNoteView | null;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(note?.body ?? "");
  const [saveState, saveAction, saving] = useActionState(
    saveExerciseNoteAction,
    {} as ExerciseNoteState,
  );
  const { streaming, partial, error, offline, start, stop } = useCoachStream();
  const [liveReply, setLiveReply] = useState("");
  const pending = saving || streaming;
  const shownBody = saveState.body ?? body;
  const aiReply = liveReply || partial || saveState.aiReply || note?.aiReply || "";
  const aiOffline = offline || saveState.aiOffline || note?.aiOffline || false;
  const hasNote = Boolean(shownBody || aiReply);
  const label = hasNote ? "Notes · saved" : "Notes";

  function payload() {
    const data = new FormData();
    data.set("exerciseName", exerciseName);
    data.set("programDayId", programDayId);
    data.set("workoutId", workoutId);
    data.set("logMode", logMode);
    data.set("plannedLine", plannedLine);
    data.set("body", body);
    return data;
  }

  return (
    <div className="mt-2" data-exercise-notepad={exerciseName}>
      <button
        type="button"
        data-notepad-toggle={exerciseName}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs font-semibold text-accent hover:border-accent"
      >
        <NoteIcon />
        {label}
      </button>
      {open ? (
        <div
          data-notepad-panel={exerciseName}
          className="mt-2 space-y-2 rounded-xl border border-line bg-background p-3"
        >
          <StatusBanner
            error={error || saveState.error}
            success={error || saveState.error ? undefined : saveState.success}
          />
          <label className="block">
            <span className="text-xs font-medium text-muted">Note or question</span>
            <textarea
              data-notepad-body={exerciseName}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Cue, question, or how this felt."
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-notepad-save={exerciseName}
              disabled={pending}
              onClick={() => saveAction(payload())}
              className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs font-semibold text-foreground hover:border-accent disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              data-notepad-ask={exerciseName}
              disabled={pending}
              onClick={async () => {
                setLiveReply("");
                const content = await start({
                  kind: "note",
                  message: body,
                  exerciseName,
                  programDayId,
                  logMode,
                  plannedLine,
                });
                if (content) setLiveReply(content);
              }}
              className="inline-flex min-h-9 items-center rounded-full bg-accent px-3 text-xs font-semibold text-black disabled:opacity-60"
            >
              {streaming ? "Asking…" : `Ask ${COACH_PUBLIC_NAME}`}
            </button>
            {streaming ? (
              <button
                type="button"
                data-notepad-stop={exerciseName}
                onClick={stop}
                className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs font-semibold"
              >
                Stop
              </button>
            ) : null}
          </div>
          {aiReply || streaming ? (
            <div
              data-notepad-reply={exerciseName}
              className="rounded-lg border border-accent/50 bg-card px-3 py-2"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                {COACH_PUBLIC_NAME}
                {aiOffline ? " · DEMO / offline" : ""}
                {streaming && !aiReply ? " · typing" : ""}
              </p>
              {streaming && !partial ? (
                <p className="mt-1 font-display text-xs uppercase tracking-wide">Typing…</p>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">{aiReply}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
