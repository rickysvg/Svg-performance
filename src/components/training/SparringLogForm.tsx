"use client";

import { useActionState, useState } from "react";
import { saveSparringLogAction, type SparringLogState } from "@/app/actions/outside-log";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";
import { SORE_SPOTS, SORE_SPOT_LABELS, type SparringLog } from "@/lib/outside-log";

function RatingRow({
  name,
  label,
  hint,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <input type="hidden" name={name} value={value} />
      <div className="mt-2 grid grid-cols-5 gap-2" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === String(score);
          return (
            <button
              key={score}
              type="button"
              data-testid={`chrome-radio-${score}`}
              aria-pressed={selected}
              aria-label={`${label} ${score}`}
              onClick={() => onChange(String(score))}
              className={`touch-target flex items-center justify-center rounded-full border border-black text-sm font-semibold ${
                selected ? "bg-accent" : "bg-white"
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SparringLogForm({
  dateKey,
  weekday,
  timeLabel,
  saved,
  coachName,
  coachImage,
  anyDay = false,
}: {
  dateKey: string;
  weekday: string;
  timeLabel?: string;
  saved: SparringLog | null;
  coachName?: string;
  coachImage?: string;
  /** Standalone logger. Does not change the day's gym type. */
  anyDay?: boolean;
}) {
  const [state, action, pending] = useActionState(saveSparringLogAction, {} as SparringLogState);
  const [intensity, setIntensity] = useState(saved?.intensity ?? "");
  const [partner, setPartner] = useState(saved?.partner ?? "");
  const [sessionRating, setSessionRating] = useState(
    saved?.sessionRating == null ? "" : String(saved.sessionRating),
  );
  const [bodyRating, setBodyRating] = useState(saved?.bodyRating == null ? "" : String(saved.bodyRating));
  const [ratingError, setRatingError] = useState("");
  const [trackedSave, setTrackedSave] = useState(state);
  if (state !== trackedSave) {
    setTrackedSave(state);
    if (state.saved) {
      if (typeof state.intensity === "string") setIntensity(state.intensity);
      if (typeof state.partner === "string") setPartner(state.partner);
    }
  }
  const checkIn = state.checkIn || saved?.coachCheckIn || "";

  return (
    <form
      action={action}
      className="space-y-3 rounded-2xl border border-line bg-card p-4"
      data-sparring-log
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const rounds = Number(String(data.get("rounds") ?? "").trim());
        const minutes = Number(String(data.get("minutesPerRound") ?? "").trim());
        const complete =
          Number.isInteger(rounds) &&
          rounds >= 1 &&
          Number.isInteger(minutes) &&
          minutes >= 1 &&
          Boolean(sessionRating) &&
          Boolean(bodyRating);
        if (complete) {
          setRatingError("");
          return;
        }
        event.preventDefault();
        setRatingError(
          "Enter rounds, minutes, a session rating, and a body rating. Nothing was saved.",
        );
      }}
    >
      <div>
        <p className="font-display text-xs uppercase tracking-wide text-accent">Sparring</p>
        <h3 className="mt-1 text-lg">
          {weekday}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {anyDay
            ? "Rate the session and how your body feels. This does not change the gym-day type. A rough score still eases the next day. Nothing is saved until you press Save."
            : "No app workout today. Log rounds when you are done, then rate the session and how your body feels. Nothing is saved until you press Save."}
        </p>
      </div>
      <input type="hidden" name="dateKey" value={dateKey} />
      <input type="hidden" name="weekday" value={weekday} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Rounds completed
          <input
            data-testid="chrome-rounds"
            name="rounds"
            type="number"
            min={1}
            max={30}
            defaultValue={saved?.rounds ?? ""}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Minutes per round
          <input
            data-testid="chrome-minutes-per-round"
            name="minutesPerRound"
            type="number"
            min={1}
            max={15}
            defaultValue={saved?.minutesPerRound ?? ""}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <label className="block text-sm">
        Intensity (optional)
        <select
          name="intensity"
          value={intensity}
          onChange={(event) => setIntensity(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          <option value="">Skip</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <RatingRow
        name="sessionRating"
        label="Session rating"
        hint="How it went. 1 was rough, 5 went well."
        value={sessionRating}
        onChange={setSessionRating}
      />
      <RatingRow
        name="bodyRating"
        label="Body rating"
        hint="How the body feels. 1 is wrecked, 5 feels fresh."
        value={bodyRating}
        onChange={setBodyRating}
      />
      {ratingError ? (
        <p className="text-sm text-signal" role="alert">
          {ratingError}
        </p>
      ) : null}
      <fieldset>
        <legend className="text-sm font-medium">Sore spots</legend>
        <p className="text-xs text-muted">Tap anywhere that is sore. Head eases the next day.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SORE_SPOTS.map((spot) => (
            <label key={spot}>
              <input
                data-testid={`chrome-sore-spots-${spot}`}
                type="checkbox"
                name="soreSpots"
                value={spot}
                defaultChecked={saved?.soreSpots.includes(spot)}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-11 items-center rounded-full border border-black bg-white px-3 text-sm peer-checked:bg-accent">
                {SORE_SPOT_LABELS[spot]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        Partner (optional)
        <input
          data-testid="chrome-partner"
          name="partner"
          value={partner}
          onChange={(event) => setPartner(event.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Notes (optional)
        <textarea
          data-testid="chrome-notes"
          name="notes"
          rows={2}
          defaultValue={saved?.notes ?? ""}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-accent">Saved.</p> : null}
      {checkIn ? (
        <RecoveryNotice
          note={state.easeNote}
          coachName={state.coachName || coachName}
          coachImage={state.coachImage || coachImage}
          message={checkIn}
        />
      ) : null}
      <button
        data-testid="chrome-save"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
