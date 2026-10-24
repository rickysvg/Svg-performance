"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { submitWeeklyCheckInAction, type CheckInActionState } from "@/app/actions/weekly-checkin";
import { StatusBanner } from "@/components/StatusBanner";
import { BodyMap } from "@/components/checkin/BodyMap";
import { ScorePicker } from "@/components/checkin/ScorePicker";
import { formatOneDecimal } from "@/lib/body-metrics";
import { FORM_CHECK_MAX_BYTES, FORM_CHECK_MAX_SECONDS } from "@/lib/form-check-shared";
import type { BodyRegionId } from "@/lib/weekly-checkin-shared";

export function CheckInForm({
  suggestedWeight,
  suggestedBodyFat,
  sessionsCompleted,
  sessionsPlanned,
  sessionTitles,
  sparringSummary,
  storageNotice,
  priorScores,
}: {
  suggestedWeight: number | null;
  suggestedBodyFat?: number | null;
  sessionsCompleted: number;
  sessionsPlanned: number;
  sessionTitles: string[];
  sparringSummary: string;
  storageNotice: string | null;
  priorScores?: { sleep: number | null; energy: number | null; stress: number | null } | null;
}) {
  const [state, action, pending] = useActionState(
    submitWeeklyCheckInAction,
    {} as CheckInActionState,
  );
  const [sleep, setSleep] = useState<number | null>(priorScores?.sleep ?? 3);
  const [energy, setEnergy] = useState<number | null>(priorScores?.energy ?? 3);
  const [stress, setStress] = useState<number | null>(priorScores?.stress ?? 3);
  const [regions, setRegions] = useState<BodyRegionId[]>([]);
  const [localError, setLocalError] = useState("");
  const [duration, setDuration] = useState("");
  const [fileName, setFileName] = useState("");

  function toggle(id: BodyRegionId) {
    setRegions((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDuration("");
    setFileName("");
    setLocalError("");
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
      URL.revokeObjectURL(url);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        event.target.value = "";
        setLocalError("Could not read the clip length. Use a video up to 60 seconds.");
        return;
      }
      if (seconds > FORM_CHECK_MAX_SECONDS) {
        event.target.value = "";
        setLocalError("Keep the clip to 60 seconds or less.");
        return;
      }
      setDuration(String(Math.ceil(seconds)));
      setFileName(file.name);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      event.target.value = "";
      setLocalError("Could not read that clip. Use an mp4, mov, or webm up to 60 seconds.");
    };
    video.src = url;
  }

  const ready = sleep != null && energy != null && stress != null;

  return (
    <form data-testid="checkin-form" action={action} className="space-y-5">
      <StatusBanner error={localError || state.error} />
      <label className="block text-sm font-semibold">
        Bodyweight (lb)
        <input
          data-testid="checkin-bodyweight-lb"
          name="bodyweightLb"
          type="number"
          inputMode="decimal"
          min={50}
          max={500}
          step="0.1"
          required
          defaultValue={suggestedWeight == null ? "" : formatOneDecimal(suggestedWeight)}
          placeholder="175"
          className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] px-4 py-4 text-base text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805]"
        />
      </label>
      <label className="block text-sm font-semibold">
        Body fat % (optional)
        <input
          name="bodyFatPercent"
          type="number"
          inputMode="decimal"
          min={0.1}
          max={70}
          step="0.1"
          placeholder="—"
          aria-label="Body fat percent, optional"
          defaultValue={suggestedBodyFat ?? ""}
          data-checkin-body-fat
          className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] px-4 py-4 text-base text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805]"
        />
      </label>

      <ScorePicker name="sleepQuality" label="Sleep" hint="1 rough · 5 great" value={sleep} onChange={setSleep} />
      <ScorePicker name="energy" label="Energy" hint="1 flat · 5 ready" value={energy} onChange={setEnergy} />
      <ScorePicker name="stress" label="Stress" hint="1 calm · 5 maxed" value={stress} onChange={setStress} />

      <BodyMap selected={regions} onToggle={toggle} />
      <label className="block text-sm font-semibold">
        Notes on soreness or injury
        <textarea
          data-testid="checkin-soreness-notes"
          name="sorenessNotes"
          rows={2}
          maxLength={400}
          placeholder="Optional. What happened, and what still hurts?"
          className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805] px-4 py-3 text-base"
        />
      </label>

      <section className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted">Sessions logged this week</p>
        <p className="mt-1 text-lg font-semibold" data-session-count>
          {sessionsCompleted} of {sessionsPlanned}
        </p>
        <p className="mt-1 text-xs text-muted">
          Finished workouts from Monday through today. Sparring logs stay separate, so this number
          does not change when you log rounds.
        </p>
        {sessionTitles.length > 0 ? (
          <p className="mt-1 text-muted">{sessionTitles.join(" · ")}</p>
        ) : (
          <p className="mt-1 text-muted">Nothing saved in the logger yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted">Sparring</p>
        <p className="mt-1">
          {sparringSummary || "No sparring logged this week."}
        </p>
      </section>

      <label className="block text-sm font-semibold">
        Wins
        <textarea
          data-testid="checkin-wins"
          name="wins"
          rows={2}
          maxLength={600}
          placeholder="What moved forward?"
          className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805] px-4 py-3 text-base"
        />
      </label>
      <label className="block text-sm font-semibold">
        Struggles
        <textarea
          data-testid="checkin-struggles"
          name="struggles"
          rows={2}
          maxLength={600}
          placeholder="What got in the way?"
          className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805] px-4 py-3 text-base"
        />
      </label>
      <label className="block text-sm font-semibold">
        Notes
        <textarea
          data-testid="checkin-notes"
          name="memberNotes"
          rows={3}
          maxLength={600}
          placeholder="Anything else Ricky should know this week?"
          className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805] px-4 py-3 text-base"
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Form video <span className="font-normal text-muted">(optional)</span></p>
        {storageNotice ? <p className="text-sm text-muted">{storageNotice}</p> : null}
        <input
          data-testid="checkin-clip"
          name="clip"
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
          onChange={onFileChange}
          className="w-full rounded-2xl border border-line bg-[#0c0e11] text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805] px-4 py-3 text-sm"
        />
        <input type="hidden" name="durationSeconds" value={duration} />
        {fileName ? <p className="text-xs text-muted">{fileName} · {duration}s</p> : null}
        <p className="text-xs text-muted">Same private upload as form check. Up to 60 seconds.</p>
      </div>

      <button
        data-testid="checkin-send-check-in"
        type="submit"
        disabled={pending || !ready}
        className="touch-target w-full rounded-full bg-accent text-lg tracking-wide text-black disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send check-in"}
      </button>
      <p className="text-center text-xs text-muted">About two minutes. Ricky reads it once this week.</p>
    </form>
  );
}
