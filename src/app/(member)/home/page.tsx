import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, profileIsComplete } from "@/lib/profile";
import { getDemoProgram } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { DemoBadge } from "@/components/DemoBadge";
import { getTodayNutritionSummary } from "@/lib/nutrition";

function formatDate(value: string | null) {
  if (!value) return "No sessions yet";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function HomePage() {
  const user = await requireUser();
  const [profile, program, sessions, foodToday] = await Promise.all([
    getProfileForUser(user.id),
    getDemoProgram(),
    listWorkoutSessionsForUser(user.id),
    getTodayNutritionSummary(user.id),
  ]);

  const units = profile?.preferredUnits ?? "lb";
  const progress = buildProgressSummary(sessions, units);
  const completedDayIds = new Set(
    sessions
      .filter((session) => session.status === "complete" && session.programDayId)
      .map((session) => session.programDayId as string),
  );
  const todayDay =
    program.days.find((day) => !completedDayIds.has(day.id)) ?? program.days[0];
  const draft = sessions.find((session) => session.status === "draft");

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          {profile?.displayName ? `Hey ${profile.displayName}` : "Welcome"}
        </p>
        <h1 className="text-2xl font-semibold">Your training snapshot</h1>
      </div>

      {!profile || !profileIsComplete(profile) ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          Finish your profile so Home can show a real goal and units.{" "}
          <Link href="/profile" className="font-semibold text-accent underline">
            Open profile
          </Link>
        </div>
      ) : null}

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          What am I working toward?
        </h2>
        <p className="mt-2 text-lg font-semibold">
          {profile?.goals || "Add a goal on your profile."}
        </p>
        {profile?.experienceLevel ? (
          <p className="mt-2 text-sm text-muted">
            Experience: {profile.experienceLevel}
            {profile.weeklyAvailability.length
              ? ` · ${profile.weeklyAvailability.length} days marked available`
              : ""}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm uppercase tracking-wide text-muted">
            What should I do today?
          </h2>
          <DemoBadge />
        </div>
        {draft ? (
          <div className="mt-3">
            <p className="text-lg font-semibold">Finish your draft session</p>
            <p className="mt-1 text-sm text-muted">{draft.title}</p>
            <Link
              href={`/training/log/${draft.id}`}
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 font-semibold text-black"
            >
              Continue draft
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-lg font-semibold">{todayDay?.title}</p>
            <p className="mt-1 text-sm text-muted">{todayDay?.focus}</p>
            <Link
              href="/training"
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 font-semibold text-black"
            >
              Open today&apos;s DEMO session
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          What progress am I making?
        </h2>
        {progress.sessionCount === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No completed workouts yet. Log one from Training and it will show
            here after you refresh.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-lg font-semibold">
              {progress.sessionCount} completed session
              {progress.sessionCount === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-muted">
              Last: {progress.lastSessionTitle} · {formatDate(progress.lastSessionAt)}
            </p>
            <Link
              href="/progress"
              className="inline-flex text-sm text-accent underline-offset-4 hover:underline"
            >
              See charts
            </Link>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">
          Fuel today (manual estimates): {foodToday.entryCount} item
          {foodToday.entryCount === 1 ? "" : "s"} ·{" "}
          {Math.round(foodToday.calories)} kcal.{" "}
          <Link href="/nutrition" className="text-accent underline">
            Log food
          </Link>
        </p>
      </section>
    </main>
  );
}
