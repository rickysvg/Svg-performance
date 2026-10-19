import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { emptyHomeToday, formatDayParam, getHomeToday, homeLoad, parseDayParam } from "@/lib/home";
import { processDueRemindersForUser } from "@/lib/reminders";
import { DAILY_QUOTES, getDailyQuoteCard, teaserFromQuote } from "@/lib/quotes";
import { emptyTodayGuide, getTodayGuide } from "@/lib/today";
import { HomeQuickActions } from "@/components/home/HomeQuickActions";
import { HomeBodyWeight } from "@/components/home/HomeBodyWeight";
import { HomeToday } from "@/components/home/HomeToday";
import { SparringLogForm } from "@/components/training/SparringLogForm";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";
import { TodaySummaryButton } from "@/components/home/TodaySummaryButton";
import { resolveAiCoach } from "@/lib/coaches";
import { ReadinessCard } from "@/components/home/ReadinessCard";
import { getReadinessForDay } from "@/lib/mobility-store";
import { dayKey as zonedDayKey } from "@/lib/timezone";
import { ThirdWorkoutCard } from "@/components/upgrade/ThirdWorkoutCard";
import { getEffectivePlanId } from "@/lib/entitlements";
import { getTrialState, shouldShowThirdWorkoutCard } from "@/lib/trial";
import { getLatestBodyMetricsForUser } from "@/lib/body-metrics";
import { CheckInHomeBanner } from "@/components/checkin/CheckInHomeBanner";
import { TrialEndedPaywall } from "@/components/upgrade/TrialEndedPaywall";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const fallbackQuote = DAILY_QUOTES[0];
  const profile = await homeLoad("profile", getProfileForUser(user.id), null);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const selected = parseDayParam(params.day, new Date(), tz);
  const planId = await getEffectivePlanId(user.id);
  const [today, reminderResult, quoteCard, guide, trial, showThirdWorkout, latestMetrics] =
    await Promise.all([
      homeLoad("today", getHomeToday(user.id, selected, tz), emptyHomeToday(selected, tz)),
      homeLoad(
        "reminders",
        processDueRemindersForUser(user.id, user.email),
        { due: [], emailed: false, smtpConfigured: false },
      ),
      homeLoad("quote", getDailyQuoteCard(user.id, new Date(), tz), {
        quote: fallbackQuote,
        unlocked: false,
        teaser: teaserFromQuote(fallbackQuote),
      }),
      homeLoad("guide", getTodayGuide(user.id, selected, tz), emptyTodayGuide(selected, tz)),
      getTrialState(user.id),
      shouldShowThirdWorkoutCard(user.id, planId),
      homeLoad("weight", getLatestBodyMetricsForUser(user.id), new Map()),
    ]);
  const dayKey = zonedDayKey(new Date(), tz);
  const readiness = await homeLoad(
    "readiness",
    getReadinessForDay(user.id, dayKey),
    null,
  );
  const greetingName = today.firstName || "athlete";
  const weight = latestMetrics.get("weight");
  const units = profile?.preferredUnits === "kg" ? "lb" : profile?.preferredUnits || "lb";
  const coach = resolveAiCoach(profile?.aiCoachId);
  const trialEnded = planId === "member_access";

  return (
    <main className="space-y-6 pb-8">
      <section className="-mx-4 -mt-6 bg-[#CBF805] px-4 pb-8 pt-7 text-black">
        <p className="font-display text-sm uppercase tracking-[0.06em]">Let&apos;s go</p>
        <h1 className="mt-1 text-4xl">Welcome {greetingName}</h1>
        {profile?.goals ? <p className="mt-2 text-sm">{profile.goals}</p> : null}
      </section>

      {trialEnded ? <TrialEndedPaywall /> : null}

      <CheckInHomeBanner userId={user.id} now={new Date()} timeZone={tz} />

      <TodaySummaryButton name={coach.name} circle={coach.circle} coachId={coach.id} />

      <HomeBodyWeight value={weight ? weight.value : null} unit={units} />

      <Link
        href="/sparring"
        data-log-sparring
        className="touch-target flex items-center justify-center rounded-full border border-black bg-white text-sm font-semibold"
      >
        Log sparring
      </Link>

      <HomeQuickActions
        locked={
          planId === "member_access"
            ? [
                { href: "/coach", kind: "coach" as const },
                { href: "/nutrition", kind: "fuel" as const },
              ]
            : []
        }
        canStartTrial={trial.canStartTrial && !trialEnded}
        trialDays={trial.trialLengthDays}
      />

      {reminderResult.due.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-line bg-card px-4 py-4">
          {reminderResult.due.map((item) => (
            <p key={item.kind} className="text-sm text-muted">
              {item.message}
            </p>
          ))}
          <Link href="/profile" className="text-sm font-semibold underline">
            Reminder settings
          </Link>
        </section>
      ) : null}

      {showThirdWorkout ? (
        <ThirdWorkoutCard canStartTrial={trial.canStartTrial} trialDays={trial.trialLengthDays} />
      ) : null}

      {guide.today.easeNote || guide.today.coachCheckIn ? (
        <RecoveryNotice
          note={guide.today.easeNote}
          coachName={guide.today.coachCheckIn?.name}
          coachImage={guide.today.coachCheckIn?.image}
          message={guide.today.coachCheckIn?.message}
        />
      ) : null}

      <HomeToday guide={guide} locked={trialEnded} />

      {guide.today.outsideKind === "sparring" ? (
        <SparringLogForm
          dateKey={formatDayParam(guide.today.selected, tz)}
          weekday={guide.today.planWeekday}
          timeLabel={guide.today.outsideLabel.replace(/^Sparring\s*·\s*/, "")}
          saved={guide.today.sparringLog}
          coachName={coach.name}
          coachImage={coach.circle}
        />
      ) : null}

      <Link
        href="/nutrition"
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4"
      >
        <span>
          <span className="block text-xs uppercase tracking-wide text-muted">Fuel</span>
          <span className="font-semibold">
            {Math.round(today.foodToday.calories)} / {Math.round(today.targets.calories)} cal
          </span>
        </span>
        <span className="font-semibold">Log food</span>
      </Link>

      {quoteCard.unlocked ? (
        <p className="text-sm text-muted">“{quoteCard.quote.text}”</p>
      ) : null}

      <details className="rounded-2xl border border-line bg-card px-4 py-3">
        <summary className="cursor-pointer font-semibold">Readiness</summary>
        <div className="mt-3">
          <ReadinessCard
            dayKey={dayKey}
            initial={
              readiness
                ? {
                    sleep: readiness.sleep,
                    soreness: readiness.soreness,
                    energy: readiness.energy,
                    restingHr: readiness.restingHr,
                  }
                : null
            }
          />
        </div>
      </details>
    </main>
  );
}
