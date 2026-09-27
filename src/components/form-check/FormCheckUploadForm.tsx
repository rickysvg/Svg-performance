"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { uploadFormCheckAction, type FormCheckActionState } from "@/app/actions/form-check";
import { StatusBanner } from "@/components/StatusBanner";
import {
  FORM_CHECK_MAX_BYTES,
  FORM_CHECK_MAX_SECONDS,
  FORM_CHECK_MOVEMENTS,
  FORM_CHECK_TURNAROUND,
} from "@/lib/form-check-shared";

export function FormCheckUploadForm({
  remaining,
  limit,
  storageNotice,
}: {
  remaining: number;
  limit: number;
  storageNotice: string | null;
}) {
  const [state, action, pending] = useActionState(uploadFormCheckAction, {} as FormCheckActionState);
  const [localError, setLocalError] = useState("");
  const [duration, setDuration] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [movement, setMovement] = useState("");

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDuration("");
    setLocalError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (!file) return;
    if (file.size > FORM_CHECK_MAX_BYTES) {
      event.target.value = "";
      setLocalError("That clip is larger than 24 MB. Keep it to 60 seconds or less.");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      if (!Number.isFinite(seconds) || seconds <= 0) {
        URL.revokeObjectURL(url);
        event.target.value = "";
        setLocalError("Could not read the clip length. Use a video up to 60 seconds.");
        return;
      }
      if (seconds > FORM_CHECK_MAX_SECONDS) {
        URL.revokeObjectURL(url);
        event.target.value = "";
        setLocalError("Keep the clip to 60 seconds or less.");
        return;
      }
      setDuration(String(Math.ceil(seconds)));
      setPreviewUrl(url);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      event.target.value = "";
      setLocalError("Could not read that clip. Use an mp4, mov, or webm up to 60 seconds.");
    };
    video.src = url;
  }

  if (remaining <= 0) {
    return (
      <section className="rounded-[1.5rem] border border-line bg-card px-4 py-4 text-sm">
        <p className="font-semibold">Both checks are used this month</p>
        <p className="mt-1 text-muted">
          {limit} form checks a month. A new one opens next month. {FORM_CHECK_TURNAROUND}
        </p>
      </section>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <StatusBanner error={localError || state.error} />
      {storageNotice ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">{storageNotice}</p>
      ) : null}
      <div className="overflow-hidden rounded-[1.5rem] bg-black">
        {previewUrl ? (
          <video src={previewUrl} controls className="aspect-video w-full bg-black" />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl text-black">
              ▶
            </span>
            <p className="text-sm text-white/80">Up to 60 seconds · mp4, mov, or webm</p>
          </div>
        )}
      </div>
      <label className="block text-sm">
        Clip
        <input
          name="clip"
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
          required
          onChange={onFileChange}
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-sm"
        />
      </label>
      <input type="hidden" name="durationSeconds" value={duration} />
      <label className="block text-sm">
        Exercise
        <select
          name="movement"
          required
          value={movement}
          onChange={(event) => setMovement(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        >
          <option value="" disabled>
            Pick the movement
          </option>
          {FORM_CHECK_MOVEMENTS.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      {movement === "other" ? (
        <label className="block text-sm">
          Movement name
          <input
            name="customMovement"
            required
            maxLength={80}
            placeholder="Name the lift or technique"
            className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
          />
        </label>
      ) : (
        <input type="hidden" name="customMovement" value="" />
      )}
      <label className="block text-sm">
        Note for your coach
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="What should they look at?"
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !duration}
        className="touch-target w-full rounded-full bg-accent text-lg tracking-wide text-black disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send for review"}
      </button>
      <p className="text-center text-sm text-muted">
        A real coach reviews this clip. The reply is signed SVG Coach. {FORM_CHECK_TURNAROUND}
      </p>
    </form>
  );
}
