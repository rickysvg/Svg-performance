import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, profileIsComplete } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { getHomeToday, parseDayParam } from "@/lib/home";
import { processDueRemindersForUser } from "@/lib/reminders";
import { listHelpRequestsForMember } from "@/lib/help";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";
import { WeekStrip } from "@/components/home/WeekStrip";
import { NutritionRings } from "@/components/home/NutritionRings";
import { SHOP_HOME } from "@/lib/shop";
import { getDailyQuoteCard } from "@/lib/quotes";
import { DailyQuoteCard } from "@/components/quotes/DailyQuoteCard";
import { memberDifficultyCopy, recentDifficultyAverage } from "@/lib/difficulty";
import { getWeeklyWrapped } from "@/lib/wrapped";
import { WeeklyWrappedCard } from "@/components/home/WeeklyWrappedCard";
import { getTodayGuide } from "@/lib/today";
import { TodayGuide } from "@/components/home/TodayGuide";

function formatDate(value: string | null) {
  if (!value) return "No sessions yet";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const selected = parseDayParam(params.day);
  const [profile, sessions, today, reminderResult, helpRequests, quoteCard, wrap, guide] =
    await Promise.all([
      getProfileForUser(user.id),
      listWorkoutSessionsForUser(user.id),
      getHomeToday(user.id, selected),
      processDueRemindersForUser(user.id, user.email),
      listHelpRequestsForMember(user.id),
      getDailyQuoteCard(user.id),
      getWeeklyWrapped(user.id),
      getTodayGuide(user.id, selected),
    ]);
  const difficulty = recentDifficultyAverage(sessions);

  const units = profile?.preferredUnits ?? "lb";
  const progress = buildProgressSummary(sessions, units);
  const openHelp = helpRequests.filter((row) => row.status === "open");
  const greetingName = today.firstName || "athlete";

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-muted">Let&apos;s go,</p>
        <h1 className="text-4xl font-semibold tracking-tight">{greetingName}</h1>
      </div>

      {!profile || !profileIsComplete(profile) ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          Finish your profile so Home can show a real goal and units.{" "}
          <Link href="/profile" className="font-semibold text-accent underline">
            Open profile
          </Link>
        </div>
      ) : null}

      {today.needsDeepPrompt ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          2-minute deeper profile for better programming.{" "}
          <Link href="/onboarding/deeper" className="font-semibold text-accent underline">
            Add optional details
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

      <DailyQuoteCard
        quote={quoteCard.quote}
        unlocked={quoteCard.unlocked}
        teaser={quoteCard.teaser}
      />

      <TodayGuide guide={guide} />

      <WeeklyWrappedCard wrap={wrap} />

      <WeekStrip selected={today.selected} />

      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Daily nutrition goal</h2>
          <Link href="/nutrition" className="text-accent" aria-label="Open nutrition">
            ›
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted">
          Manual estimates vs your targets (DEMO defaults until you change them on Profile).
          Not a coach-assigned meal plan.
        </p>
        <div className="mt-4">
          <NutritionRings
            calories={today.foodToday.calories}
            proteinG={today.foodToday.proteinG}
            carbsG={today.foodToday.carbsG}
            fatG={today.foodToday.fatG}
            targets={today.targets}
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          {today.foodNudge ??
            `${today.foodToday.entryCount} item${
              today.foodToday.entryCount === 1 ? "" : "s"
            } logged this day.`}{" "}
          <Link href="/nutrition" className="text-accent underline">
            Log food
          </Link>
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          Days active this week
        </h2>
        <p className="mt-2 text-lg font-semibold">
          {today.activity.daysActive} of 7 days
        </p>
        <p className="mt-1 text-sm text-muted">{today.activity.message}</p>
        <p className="mt-3 text-xs text-muted">{memberDifficultyCopy(difficulty)}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Quick links</h2>
        {today.incompleteLesson ? (
          <Link
            href={`/learn/${today.incompleteLesson.slug}`}
            className="block rounded-2xl border border-line bg-card p-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">Unfinished lesson</p>
            <p className="mt-1 font-semibold">{today.incompleteLesson.title}</p>
            <p className="mt-1 text-sm text-muted">Continue when you have a few minutes.</p>
          </Link>
        ) : (
          <Link href="/learn" className="block rounded-2xl border border-line bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Learn</p>
            <p className="mt-1 font-semibold">Browse DEMO lessons</p>
          </Link>
        )}
        <Link href="/paths" className="block rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Training path</p>
          <p className="mt-1 font-semibold">{guide.path.path.title}</p>
          <p className="mt-1 text-sm text-muted">
            {guide.path.nextStep
              ? `Next: ${guide.path.nextStep.title}`
              : "DEMO milestones complete on this path."}
          </p>
        </Link>
        <Link href="/journal" className="block rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Journal</p>
          <p className="mt-1 font-semibold">Notes, goals, questions</p>
          <p className="mt-1 text-sm text-muted">Private until a coach writes feedback.</p>
        </Link>
        <Link href="/report" className="block rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Weekly report</p>
          <p className="mt-1 font-semibold">Automated SVG summary</p>
          <p className="mt-1 text-sm text-muted">Richer than the count wrap. Not a Ricky note.</p>
        </Link>
        <Link href="/plan" className="block rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">My plan</p>
          <p className="mt-1 font-semibold">Credits and upgrade path</p>
          <p className="mt-1 text-sm text-muted">Paid plans are additional to gym dues.</p>
        </Link>
        <Link href="/book" className="block rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Book with Ricky</p>
          <p className="mt-1 font-semibold">Mindset $75 / Strategy $125</p>
          <p className="mt-1 text-sm text-muted">Request times only — not a live calendar.</p>
        </Link>
        <Link href="/progress" className="block rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">My Progress</p>
          {progress.sessionCount === 0 ? (
            <p className="mt-1 text-sm text-muted">No completed workouts yet — charts wait on a saved session.</p>
          ) : (
            <p className="mt-1 text-sm">
              {progress.sessionCount} completed session{progress.sessionCount === 1 ? "" : "s"} · last{" "}
              {formatDate(progress.lastSessionAt)}
            </p>
          )}
        </Link>
        <article className="rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Coach help</p>
          <p className="mt-1 font-semibold">
            {openHelp.length > 0
              ? `${openHelp.length} open request${openHelp.length === 1 ? "" : "s"} · ${openHelp[0].status}`
              : "No open request"}
          </p>
          <p className="mt-1 text-sm text-muted">
            Status is open / seen / closed. Not a 24/7 chat promise.
          </p>
        </article>
        <a
          href={SHOP_HOME}
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl border border-line bg-card p-4"
        >
          <p className="text-xs uppercase tracking-wide text-muted">Shop</p>
          <p className="mt-1 font-semibold">SVG &amp; CO (live store)</p>
          <p className="mt-1 text-sm text-muted">We do not invent products or prices here.</p>
        </a>
      </section>

      {profile?.claimsGymMembership && !profile.gymMembershipVerified ? (
        <p className="text-xs text-muted">
          You checked “I train at SVG.” That is only a note. It does not unlock
          the $19 price until an admin verifies you.
        </p>
      ) : null}

      {profile?.goals ? (
        <p className="text-sm text-muted">Working toward: {profile.goals}</p>
      ) : null}

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
