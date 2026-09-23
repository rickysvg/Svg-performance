import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { startSessionAction } from "@/app/actions/workouts";
import { WatchFormInline } from "@/components/training/WatchForm";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { lookupFormVideo } from "@/lib/form-videos";
import { canUseFeature } from "@/lib/entitlements";
import { getProfileForUser } from "@/lib/profile";
import { sessionKindLabel } from "@/lib/exercise-media";
import {
  filterSkillDaysForFocus,
  skillEquipmentNote,
  suggestTodayWork,
} from "@/lib/skill-programs";

type CatalogDay = {
  id: string;
  title: string;
  focus: string;
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
    reps: string;
    loadText: string;
    restSeconds: number;
    formVideoUrl: string;
    formVideoPending: boolean;
  }>;
};

function DayCard({
  day,
  highlight,
}: {
  day: CatalogDay;
  highlight?: boolean;
}) {
  const kind = sessionKindLabel({ title: day.title, focus: day.focus });
  return (
    <article
      className={`rounded-2xl border bg-card p-5 ${
        highlight ? "border-accent/70" : "border-line"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        {kind}
        {highlight ? " · suggested today" : ""}
      </p>
      <h3 className="mt-1 text-lg font-semibold">{day.title}</h3>
      <p className="text-sm text-muted">{day.focus}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {day.exercises.map((exercise) => {
          const form = lookupFormVideo(exercise.name, day.exercises);
          return (
            <li
              key={exercise.id}
              className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0"
            >
              <span className="flex min-w-0 items-center gap-3">
                <ExerciseThumb
                  name={exercise.name}
                  formVideoUrl={form.url}
                  formVideoPending={form.pending}
                  size={48}
                />
                <span>
                  <span className="font-medium">{exercise.name}</span>
                  <span className="block text-muted">
                    {exercise.sets} × {exercise.reps} · {exercise.loadText} · rest{" "}
                    {exercise.restSeconds}s
                  </span>
                </span>
              </span>
              <WatchFormInline url={form.url} pending={form.pending} />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={`/training/${day.id}`}
          className="touch-target inline-flex items-center rounded-full border border-line px-4 text-sm"
        >
          View details
        </Link>
        <form action={startSessionAction}>
          <input type="hidden" name="programDayId" value={day.id} />
          <button
            type="submit"
            className="touch-target rounded-full bg-accent px-4 text-sm font-semibold text-black"
          >
            Start this session
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function TrainingPage() {
  const user = await requireUser();
  const [catalog, sessions, conditioning, profile] = await Promise.all([
    findDemoTrainingCatalog(),
    listWorkoutSessionsForUser(user.id),
    canUseFeature(user.id, "conditioning"),
    getProfileForUser(user.id),
  ]);
  const { strength, skill } = catalog;
  const completedDayIds = new Set(
    sessions
      .filter((session) => session.status === "complete" && session.programDayId)
      .map((session) => session.programDayId as string),
  );
  const skillDays = filterSkillDaysForFocus(skill?.days ?? [], profile?.primaryFocus);
  const suggested = suggestTodayWork({
    strengthDays: strength?.days ?? [],
    skillDays: skill?.days ?? [],
    completedDayIds,
    prefs: {
      goalKey: profile?.goalKey,
      primaryFocus: profile?.primaryFocus,
    },
  });
  const equipmentNote = skillDays.length > 0 ? skillEquipmentNote(profile?.equipment) : "";

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Training</h1>
          <p className="mt-1 text-sm text-muted">
            Strength stays on for everyone. Martial-arts DEMO days follow your
            intake focus. Labeled DEMO — not a custom fight camp.
          </p>
        </div>
        <DemoBadge />
      </div>
      <p className="text-sm">
        <Link href="/training/calendar" className="font-semibold text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        <span className="text-muted"> — this week’s DEMO days in a list</span>
      </p>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Fighter Conditioning</h2>
        {conditioning ? (
          <p className="mt-2 text-sm text-muted">
            Shared combat S&amp;C / mobility blocks publish here when ready. This DEMO
            starter stays labeled DEMO and is not a 1:1 assigned fight camp.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Structured fighter conditioning is on the $49 / $59 plan.{" "}
            <Link href="/pricing" className="text-accent underline">
              See App Plans
            </Link>
          </p>
        )}
      </section>

      {suggested ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Suggested today</h2>
          <DayCard day={suggested} highlight />
        </section>
      ) : null}

      {skillDays.length > 0 ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-accent/40 bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">
              DEMO martial arts
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {skill?.title ?? "DEMO Combat Skills"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {skill?.description ??
                "Skill sessions matched to your intake. External YouTube form links — not SVG-produced film."}
            </p>
            {equipmentNote ? (
              <p className="mt-2 text-sm text-muted">{equipmentNote}</p>
            ) : null}
          </div>
          {skillDays.map((day) => (
            <DayCard key={day.id} day={day} highlight={day.id === suggested?.id} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="rounded-2xl border border-accent/40 bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            DEMO strength
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {strength?.title ?? "DEMO program not loaded yet"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {strength?.description ??
              "This hosted preview has no seeded DEMO days yet. Your account is fine. An admin can run the laptop seed, or we can load the template later. It is not a live billing or Gymdesk issue."}
          </p>
        </div>
        {(strength?.days ?? []).map((day) => (
          <DayCard key={day.id} day={day} highlight={day.id === suggested?.id} />
        ))}
      </section>

      <p className="text-sm">
        <Link href="/training/calendar" className="text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        {" · "}
        <Link href="/training/history" className="text-accent underline-offset-4 hover:underline">
          Workout history ({sessions.length})
        </Link>
      </p>
    </main>
  );
}
