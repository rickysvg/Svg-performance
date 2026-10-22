"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { submitFeedbackAction, type FeedbackActionState } from "@/app/actions/feedback";
import { StatusBanner } from "@/components/StatusBanner";
import { Toast } from "@/components/Toast";
import {
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPES,
  type FeedbackType,
} from "@/lib/feedback-shared";

function FeedbackToast({ token }: { token?: number }) {
  const [visibleToken, setVisibleToken] = useState<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  if (token !== visibleToken) {
    setVisibleToken(token);
    setOpen(Boolean(token));
  }

  if (!open) return null;
  return (
    <Toast
      closeTestId="feedback-toast-close"
      key={token}
      message="Thanks. We got your feedback."
      tone="outline"
      placement="top"
      onDismiss={() => setOpen(false)}
      attrs={{ "data-feedback-toast": "1" }}
    />
  );
}

function FeedbackFields({
  action,
  pending,
  serverError,
  route,
  workoutId,
  appVersion,
  defaultType,
  storageNotice,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  serverError?: string;
  route: string;
  workoutId: string;
  appVersion: string;
  defaultType: FeedbackType | "";
  storageNotice: string | null;
}) {
  const [localError, setLocalError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setLocalError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (!file) return;
    if (file.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
      event.target.value = "";
      setLocalError("That screenshot is larger than 5 MB. Pick a smaller jpeg, png, or webp.");
      return;
    }
    if (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      event.target.value = "";
      setLocalError("Use a jpeg, png, or webp screenshot.");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <form data-testid="feedback-form" action={action} className="space-y-4" data-feedback-form="1">
      <StatusBanner error={localError || serverError} />
      <input type="hidden" name="route" value={route} />
      <input type="hidden" name="workoutId" value={workoutId} />
      <label className="block text-sm">
        Type
        <select
          name="type"
          required
          defaultValue={defaultType}
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        >
          <option value="" disabled>
            What kind of note?
          </option>
          {FEEDBACK_TYPES.map((type) => (
            <option key={type} value={type}>
              {FEEDBACK_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Message
        <textarea
          data-testid="feedback-message"
          name="message"
          required
          minLength={4}
          maxLength={2000}
          rows={6}
          placeholder="What happened, or what would help?"
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        />
      </label>
      <label className="block text-sm">
        Screenshot
        <span className="mt-0.5 block text-xs text-muted">Optional. jpeg, png, or webp, up to 5 MB.</span>
        <input
          data-testid="feedback-screenshot"
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={onFileChange}
          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-4 text-sm"
        />
      </label>
      {storageNotice ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">{storageNotice}</p>
      ) : null}
      {previewUrl ? (
        // Private preview of a file the member just picked. Not a remote image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Screenshot preview"
          className="max-h-64 w-full rounded-2xl border border-line object-contain bg-black"
        />
      ) : null}
      <p className="rounded-2xl border border-line bg-card px-4 py-3 text-xs text-muted" data-feedback-context="1">
        Attached with this note: {route}
        {workoutId ? " · this workout" : ""} · app {appVersion} · your account.
      </p>
      <button
        data-testid="feedback-send-feedback"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}

export function FeedbackForm({
  route,
  workoutId,
  appVersion,
  defaultType,
  storageNotice,
}: {
  route: string;
  workoutId: string;
  appVersion: string;
  defaultType: FeedbackType | "";
  storageNotice: string | null;
}) {
  const [state, action, pending] = useActionState(submitFeedbackAction, {} as FeedbackActionState);

  return (
    <>
      <FeedbackToast token={state.savedAt} />
      <FeedbackFields
        key={state.savedAt ?? "draft"}
        action={action}
        pending={pending}
        serverError={state.error}
        route={route}
        workoutId={workoutId}
        appVersion={appVersion}
        defaultType={defaultType}
        storageNotice={storageNotice}
      />
    </>
  );
}
