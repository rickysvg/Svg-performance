"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  applySavedWorkoutAction,
  deleteSavedWorkoutAction,
  renameSavedWorkoutAction,
  startSavedWorkoutAction,
  type SavedWorkoutActionState,
} from "@/app/actions/my-workouts";
import {
  APPLY_TOAST,
  APPLY_TOAST_MS,
  REPLACE_LOGGED_CONFIRM,
  RENAME_TOAST_MS,
  applySheetSettle,
  renameSheetSettle,
} from "@/lib/workout-sheet";

export function MyWorkoutCard({
  id,
  name,
  exerciseCount,
  lastUsedLabel,
  todayKey,
}: {
  id: string;
  name: string;
  exerciseCount: number;
  lastUsedLabel: string;
  todayKey: string;
}) {
  const [applyOpen, setApplyOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [displayName, setDisplayName] = useState(name);
  const [toast, setToast] = useState("");
  const applyLock = useRef(false);
  const applyStarted = useRef(false);
  const [rename, renameAction, renamePending] = useActionState(
    renameSavedWorkoutAction,
    {} as SavedWorkoutActionState,
  );
  const [applyState, applyAction, applyPending] = useActionState(
    applySavedWorkoutAction,
    {} as SavedWorkoutActionState,
  );
  useEffect(() => {
    setDisplayName(name);
  }, [name]);
  useEffect(() => {
    const settled = renameSheetSettle({ renamed: Boolean(rename.renamed), name: rename.name });
    if (!settled.close || !settled.toast) return;
    setDisplayName(rename.name ?? "");
    setRenameOpen(false);
    setToast(settled.toast);
    const timer = window.setTimeout(() => setToast(""), RENAME_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [rename.renamed, rename.name]);
  useEffect(() => {
    const settled = applySheetSettle({
      pending: applyPending,
      started: applyStarted.current,
      applied: Boolean(applyState.applied),
    });
    if (settled.open === null) return;
    applyLock.current = settled.locked;
    applyStarted.current = false;
    setApplyOpen(settled.open);
    if (!settled.toast) return;
    setToast(settled.toast);
    const timer = window.setTimeout(() => setToast(""), APPLY_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [applyPending, applyState]);
  const count = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;

  return (
    <article data-my-workout={id} className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-lg normal-case leading-tight" data-my-workout-name>
        {displayName}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {count} · Last used {lastUsedLabel}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <form data-testid={`my-workout-${id}-start`} action={startSavedWorkoutAction}>
          <input type="hidden" name="savedWorkoutId" value={id} />
          <button
            type="submit"
            data-start-my-workout
            className="touch-target w-full rounded-full bg-accent text-sm font-semibold text-black"
          >
            Start now
          </button>
        </form>
        <button
          type="button"
          data-apply-day
          onClick={() => setApplyOpen(true)}
          className="touch-target w-full rounded-full border border-line text-sm font-semibold"
        >
          Apply to a day
        </button>
        <button
          type="button"
          data-rename-workout
          onClick={() => setRenameOpen(true)}
          className="touch-target w-full rounded-full border border-line text-sm"
        >
          Rename
        </button>
        <Link
          href={`/training/my-workouts/${id}`}
          data-edit-workout
          className="touch-target inline-flex w-full items-center justify-center rounded-full border border-line text-sm"
        >
          Edit
        </Link>
      </div>
      <button
        type="button"
        data-delete-saved
        onClick={() => setDeleteOpen(true)}
        className="mt-2 text-sm font-semibold text-danger"
      >
        Delete
      </button>
      {toast ? (
        <p
          className="mt-2 text-sm text-muted"
          data-rename-toast={toast === APPLY_TOAST ? undefined : ""}
          data-apply-toast={toast === APPLY_TOAST ? "" : undefined}
        >
          {toast}
        </p>
      ) : null}

      {renameOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6">
          <form
            action={renameAction}
            data-rename-sheet
            className="w-full max-w-sm space-y-3 rounded-3xl bg-card px-5 py-5"
          >
            <p className="font-display text-lg uppercase tracking-wide">Rename</p>
            <input type="hidden" name="savedWorkoutId" value={id} />
            <input
              key={displayName}
              data-testid={`my-workout-${id}-name`}
              name="name"
              defaultValue={displayName}
              maxLength={80}
              data-rename-name
              className="w-full rounded-xl border border-line bg-background px-3 py-3 normal-case"
            />
            <p className="text-sm text-muted">Stored as “{displayName}”.</p>
            {rename.error ? <p className="text-sm text-danger">{rename.error}</p> : null}
            <button
              type="submit"
              disabled={renamePending}
              className="touch-target w-full rounded-full bg-accent font-semibold text-black"
            >
              Save name
            </button>
            <button type="button" onClick={() => setRenameOpen(false)} className="touch-target w-full text-sm">
              Cancel
            </button>
          </form>
        </div>
      ) : null}

      {applyOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-day-title"
            data-apply-sheet
            className="w-full max-w-sm rounded-3xl bg-card px-5 py-5"
          >
            <p id="apply-day-title" className="font-display text-lg uppercase tracking-wide">
              Apply to a day
            </p>
            <p className="mt-2 text-sm text-muted">
              Other days keep the 3-week block. This day uses your list.
            </p>
            <form
              data-testid={`my-workout-${id}-apply`}
              action={applyAction}
              className="mt-4 space-y-2"
              onSubmit={(event) => {
                if (applyLock.current || applyPending) {
                  event.preventDefault();
                  return;
                }
                applyLock.current = true;
                applyStarted.current = true;
              }}
            >
              <input type="hidden" name="savedWorkoutId" value={id} />
              <label className="block text-sm">
                <span className="font-medium">Date</span>
                <input
                  data-testid={`my-workout-${id}-day`}
                  type="date"
                  name="dayKey"
                  data-apply-day-date
                  required
                  defaultValue={todayKey}
                  className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
                />
              </label>
              {applyState.error && applyState.error !== REPLACE_LOGGED_CONFIRM ? (
                <p className="text-sm text-danger" data-apply-error>
                  {applyState.error}
                </p>
              ) : null}
              <button
                type="submit"
                name="mode"
                value="replace"
                data-apply-replace
                disabled={applyPending}
                className="touch-target w-full rounded-full bg-accent text-sm font-semibold text-black disabled:opacity-60"
              >
                Replace that day&apos;s workout
              </button>
              {applyState.error === REPLACE_LOGGED_CONFIRM ? (
                <div data-replace-logged-confirm role="group" aria-label="Confirm replace">
                  <p className="text-sm">{REPLACE_LOGGED_CONFIRM}</p>
                  <button
                    type="submit"
                    name="confirm"
                    value="replace"
                    data-apply-replace-confirm
                    disabled={applyPending}
                    className="touch-target mt-2 w-full rounded-full border border-line text-sm font-semibold disabled:opacity-60"
                  >
                    Replace anyway
                  </button>
                </div>
              ) : null}
              <button
                type="submit"
                name="mode"
                value="extra"
                data-apply-extra
                disabled={applyPending}
                className="touch-target w-full rounded-full border border-line text-sm font-semibold disabled:opacity-60"
              >
                Add as an extra session
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                applyLock.current = false;
                applyStarted.current = false;
                setApplyOpen(false);
              }}
              className="touch-target mt-2 w-full text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-saved-title"
            data-delete-confirm
            className="w-full max-w-sm rounded-3xl bg-card px-5 py-5"
          >
            <p id="delete-saved-title" className="font-display text-lg uppercase tracking-wide text-danger">
              Delete this workout?
            </p>
            <p className="mt-2 text-sm text-muted">This can&apos;t be undone.</p>
            <form data-testid={`my-workout-${id}-delete`} action={deleteSavedWorkoutAction} className="mt-5">
              <input type="hidden" name="savedWorkoutId" value={id} />
              <button
                type="submit"
                data-delete-confirm-submit
                className="touch-target w-full rounded-full bg-danger text-base font-semibold text-white"
              >
                Delete
              </button>
            </form>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="touch-target mt-2 w-full rounded-full border border-line text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
