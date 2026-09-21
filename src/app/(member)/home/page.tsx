import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, profileIsComplete } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { DemoBadge } from "@/components/DemoBadge";
import { EmptyState } from "@/components/EmptyState";
import { getHomeToday } from "@/lib/home";
import { processDueRemindersForUser } from "@/lib/reminders";
import { listHelpRequestsForMember } from "@/lib/help";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";

function formatDate(value: string | null) {
  if (!value) return "No sessions yet";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function HomePage() {
  const user = await requireUser();
  const [profile, sessions, today, reminderResult, helpRequests] = await Promise.all([
    getProfileForUser(user.id),
    listWorkoutSessionsForUser(user.id),
    getHomeToday(user.id),
    processDueRemindersForUser(user.id, user.email),
    listHelpRequestsForMember(user.id),
  ]);

  const units = profile?.preferredUnits ?? "lb";
  const progress = buildProgressSummary(sessions, units);
  const openHelp = helpRequests.filter((row) => row.status === "open");

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

      {reminderResult.due.length > 0 ? (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted">Reminders</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {reminderResult.due.map((item) => (
              <li key={item.kind}>{item.message}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {reminderResult.smtpConfigured
              ? reminderResult.emailed
                ? "An email was also sent because SMTP is configured."
                : "SMTP is configured, but email could not be sent this time. The in-app note is enough."
              : "Email is off until SMTP is set. These notes stay on Home only."}{" "}
            <Link href="/profile" className="text-accent underline">
              Change reminder settings
            </Link>
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          Days active this week
        </h2>
        <p className="mt-2 text-lg font-semibold">
          {today.activity.daysActive} of 7 days
        </p>
        <p className="mt-1 text-sm text-muted">{today.activity.message}</p>
      </section>

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
        {profile?.claimsGymMembership && !profile.gymMembershipVerified ? (
          <p className="mt-3 text-xs text-muted">
            You checked “I train at SVG.” That is only a note. It does not unlock
            the $19 price until an admin verifies you.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm uppercase tracking-wide text-muted">
            Today
          </h2>
          <DemoBadge />
        </div>
        {today.draft ? (
          <div className="mt-3">
            <p className="text-lg font-semibold">Finish your draft session</p>
            <p className="mt-1 text-sm text-muted">{today.draft.title}</p>
            <Link
              href={`/training/log/${today.draft.id}`}
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 font-semibold text-black"
            >
              Continue draft
            </Link>
          </div>
        ) : today.suggestedDay ? (
          <div className="mt-3">
            <p className="text-lg font-semibold">{today.suggestedDay.title}</p>
            <p className="mt-1 text-sm text-muted">{today.suggestedDay.focus}</p>
            <Link
              href="/training"
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 font-semibold text-black"
            >
              Open today&apos;s DEMO session
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No DEMO day is loaded yet. Open Training after setup.
          </p>
        )}
        <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <p>
            {today.foodNudge ??
              `Fuel today (manual estimates): ${today.foodToday.entryCount} item${
                today.foodToday.entryCount === 1 ? "" : "s"
              } · ${Math.round(today.foodToday.calories)} kcal.`}{" "}
            <Link href="/nutrition" className="text-accent underline">
              Log food
            </Link>
          </p>
          {today.incompleteLesson ? (
            <p>
              Lesson still open: {today.incompleteLesson.title}.{" "}
              <Link
                href={`/learn/${today.incompleteLesson.slug}`}
                className="text-accent underline"
              >
                Continue
              </Link>
            </p>
          ) : (
            <p className="text-muted">
              No unfinished published lesson right now.{" "}
              <Link href="/learn" className="text-accent underline">
                Browse Learn
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          What progress am I making?
        </h2>
        {progress.sessionCount === 0 ? (
          <EmptyState title="No completed workouts yet" action={
            <Link href="/training" className="text-accent underline">
              Log one from Training
            </Link>
          }>
            Home will show your latest session after you save it.
          </EmptyState>
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
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          Ask a coach
        </h2>
        <p className="mt-2 text-sm text-muted">
          This is a request with a real status (open, seen, closed). It is not a
          24/7 chat promise. Use it when you want a human coach, not the AI.
        </p>
        {openHelp.length > 0 ? (
          <p className="mt-3 text-sm">
            You have {openHelp.length} open request
            {openHelp.length === 1 ? "" : "s"}. Latest: {openHelp[0].topic} —{" "}
            {openHelp[0].status}.
          </p>
        ) : null}
        <div className="mt-4">
          <HelpRequestForm />
        </div>
        {helpRequests.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {helpRequests.slice(0, 5).map((row) => (
              <li key={row.id} className="border-t border-line pt-2">
                <span className="font-medium">{row.topic}</span> · {row.status}
                <span className="block text-muted">{row.note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
