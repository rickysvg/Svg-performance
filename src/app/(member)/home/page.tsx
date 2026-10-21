import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { emptyHomeToday, formatDayParam, getHomeToday, homeLoad, parseDayParam } from "@/lib/home";
import { processDueRemindersForUser } from "@/lib/reminders";
import { DAILY_QUOTES, getDailyQuoteCard, teaserFromQuote } from "@/lib/quotes";
import { emptyTodayGuide, getTodayGuide } from "@/lib/today";
import { HomeDailyQuote } from "@/components/home/HomeDailyQuote";
import { HomeQuickActions } from "@/components/home/HomeQuickActions";
import { HomeBodyWeight } from "@/components/home/HomeBodyWeight";
import { HomeTelemetry } from "@/components/home/HomeTelemetry";
import { HomeToday } from "@/components/home/HomeToday";
import { SparringLogForm } from "@/components/training/SparringLogForm";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";
import { TodaySummaryButton } from "@/components/home/TodaySummaryButton";
import { resolveAiCoach } from "@/lib/coaches";
import { dedupeGoalLine } from "@/lib/onboarding";
import { ReadinessCard } from "@/components/home/ReadinessCard";
import { getReadinessForDay } from "@/lib/mobility-store";
import { dayKey as zonedDayKey } from "@/lib/timezone";
import { ThirdWorkoutCard } from "@/components/upgrade/ThirdWorkoutCard";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planIsPro } from "@/lib/plans";
import { isDashboardAdmin } from "@/lib/admin-access";
import { getTrialState, shouldShowThirdWorkoutCard } from "@/lib/trial";
import { getRecentBodyFatForUser, getRecentWeightsForUser } from "@/lib/body-metrics";
import { bodyFatReadout, homeTrainingReadout } from "@/lib/home-side-stats";
import { massCaption, massGaugeScale } from "@/lib/mass-caption";
import { emptyHomeTelemetry, getHomeTelemetry } from "@/lib/home-telemetry";
import { getFightCampRow } from "@/lib/fight-camp";
import { telemetryGraphTitle } from "@/lib/telemetry-title";
import { latestSparringSessionRating } from "@/lib/outside-log";
import { CheckInHomeBanner } from "@/components/checkin/CheckInHomeBanner";
import { TrialEndedPaywall } from "@/components/upgrade/TrialEndedPaywall";
import { VipUpsellSlot } from "@/components/vip/VipUpsellSlot";

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
  const [today, reminderResult, quoteCard, guide, trial, showThirdWorkout, recentWeights, recentFat, sparringRating, telemetry, camp] =
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
      homeLoad("weight", getRecentWeightsForUser(user.id, 8), []),
      homeLoad("bodyFat", getRecentBodyFatForUser(user.id, 2), []),
      homeLoad("sparring", latestSparringSessionRating(user.id), null),
      homeLoad(
        "telemetry",
        getHomeTelemetry({ userId: user.id, timeZone: tz }),
        emptyHomeTelemetry(new Date(), tz),
      ),
      homeLoad("camp", getFightCampRow(user.id), null),
    ]);
  const dayKey = zonedDayKey(new Date(), tz);
  const telemetryTitle = telemetryGraphTitle({
    status: camp?.status,
    fightDateKey: camp?.fightDateKey,
    todayKey: dayKey,
  });
  const sideStats = {
    bodyFat: bodyFatReadout(recentFat[0]?.value ?? null, recentFat[1]?.value ?? null),
    training: homeTrainingReadout({
      campStatus: camp?.status,
      fightDateKey: camp?.fightDateKey,
      todayKey: dayKey,
      streakDays: telemetry.streakCurrent,
    }),
  };
  const readiness = await homeLoad(
    "readiness",
    getReadinessForDay(user.id, dayKey),
    null,
  );
  const greetingName = today.firstName || "athlete";
  const weight = recentWeights[0] ?? null;
  const units = weight?.unit || (profile?.preferredUnits === "kg" ? "lb" : profile?.preferredUnits || "lb");
  const massLine = massCaption(weight, recentWeights[1] ?? null, tz);
  const massGauge = massGaugeScale({
    value: weight?.value ?? null,
    goal: profile?.goalWeight ?? null,
    recent: recentWeights.map((row) => row.value),
  });
  const coach = resolveAiCoach(profile?.aiCoachId);
  const trialEnded = planId === "member_access";

  return (
    <main className="space-y-6 pb-8">
      <section className="hc-panel hc-carbon -mx-4 -mt-6 px-4 pb-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="hc-kicker">Let&apos;s go</p>
          <span className="bg-[#CBF805] px-2 py-1 font-telemetry text-[10px] uppercase tracking-[0.16em] text-black">
            <span className="hc-live mr-1 inline-block h-1.5 w-1.5 rounded-full bg-black align-middle" aria-hidden />
            Live
          </span>
        </div>
        <h1 className="mt-3 text-4xl">Welcome {greetingName}</h1>
        <HomeDailyQuote
          text={quoteCard.unlocked ? quoteCard.quote.text : quoteCard.teaser}
          attribution={quoteCard.unlocked ? quoteCard.quote.attribution : ""}
        />
        {profile?.goals ? (
          <p className="mt-2 max-w-[22rem] text-sm text-muted">{dedupeGoalLine(profile.goals)}</p>
        ) : null}
      </section>

      {trialEnded ? <TrialEndedPaywall /> : null}

      <VipUpsellSlot userId={user.id} />

      <CheckInHomeBanner userId={user.id} now={new Date()} timeZone={tz} />

      <TodaySummaryButton name={coach.name} circle={coach.circle} coachId={coach.id} />

      <HomeBodyWeight
        value={weight ? weight.value : null}
        unit={units}
        caption={massLine}
        gauge={massGauge}
        side={sideStats}
      />

      <HomeQuickActions
        imagery={profile?.athleteImagery}
        sparringRating={sparringRating}
        locked={[
          ...(!planIsPro(planId) && !isDashboardAdmin(user)
            ? [{ href: "/coach", kind: "coach" as const }]
            : []),
          ...(planId === "member_access"
            ? [{ href: "/nutrition", kind: "fuel" as const }]
            : []),
        ]}
        canStartTrial={trial.canStartTrial && !trialEnded}
        trialDays={trial.trialLengthDays}
      />

      {reminderResult.due.length > 0 ? (
        <section className="hc-panel space-y-2 px-4 py-4">
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

      <HomeTelemetry data={telemetry} title={telemetryTitle} />

      <Link
        href="/nutrition"
        className="hc-panel flex min-h-14 items-center justify-between gap-3 px-4"
      >
        <span>
          <span className="block text-xs uppercase tracking-wide text-muted">Fuel</span>
          <span className="font-semibold">
            {Math.round(today.foodToday.calories)} / {Math.round(today.targets.calories)} cal
          </span>
        </span>
        <span className="font-semibold">Log food</span>
      </Link>

      <details className="hc-panel px-4 py-3">
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
