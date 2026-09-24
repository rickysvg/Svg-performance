import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  countWorkoutSessionsForUser,
  listDraftSessionsForUser,
} from "@/lib/workouts";
import { canUseFeature } from "@/lib/entitlements";
import { getProfileForUser } from "@/lib/profile";
import { skillEquipmentNote } from "@/lib/skill-programs";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import {
  buildCoreWeekPlan,
  nextActiveWeekday,
  planForDate,
  resolvePlanSessions,
  weekStrip,
} from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { WeekStrip } from "@/components/training/WeekStrip";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";

export default async function TrainingPage() {
  const user = await requireUser();
  const now = new Date();
  const [catalog, drafts, sessionCount, conditioning, profile] = await Promise.all([
    findDemoTrainingCatalog(),
    listDraftSessionsForUser(user.id),
    countWorkoutSessionsForUser(user.id),
    canUseFeature(user.id, "conditioning"),
    getProfileForUser(user.id),
  ]);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
  };
  const todayPlan = planForDate(prefs, now);
  const planned = resolvePlanSessions(
    todayPlan,
    scaleDemoCatalog(catalog, {
      experienceLevel: profile?.experienceLevel,
      competitionStatus: profile?.competitionStatus,
    }),
  );
  const strip = weekStrip(prefs, now);
  const week = buildCoreWeekPlan(prefs, bikeWeekIndex(now));
  const nextDay = todayPlan.active ? null : nextActiveWeekday(prefs, now);
  const hasSkill = planned.some((session) => session.kind === "skill");
  const equipmentNote = hasSkill ? skillEquipmentNote(profile?.equipment) : "";
  const draftsByDay = new Map(
    drafts
      .filter((session) => session.programDayId)
      .map((session) => [session.programDayId as string, session.id]),
  );

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Training</h1>
          <p className="mt-1 text-sm text-muted">
            Core week plan (DEMO) — one shared weekday skeleton. Not Elite
            coaching or a custom fight camp.
          </p>
        </div>
        <DemoBadge />
      </div>

      <WeekStrip days={strip} />

      <p className="text-sm">
        <Link href="/training/calendar" className="font-semibold text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        <span className="text-muted"> — this week’s Core days in a list</span>
      </p>

      <section className="space-y-3">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-wide text-accent">
            Today’s plan · {todayPlan.weekday}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {todayPlan.active
              ? todayPlan.summary
              : nextDay
                ? `Rest today · next up ${nextDay}`
                : "Rest day"}
          </h2>
          {todayPlan.skipReason && !todayPlan.active ? (
            <p className="mt-1 text-sm text-muted">{todayPlan.skipReason}</p>
          ) : null}
          {equipmentNote ? <p className="mt-1 text-sm text-muted">{equipmentNote}</p> : null}
        </div>
        {planned.map((session) => (
          <PlanSessionCard
            key={`${session.slot}-${session.dayId ?? session.label}`}
            session={session}
            compact
            highlight={session.slot === "A" && planned.length > 1}
            draftId={session.dayId ? draftsByDay.get(session.dayId) : undefined}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Fighter Conditioning</h2>
        {conditioning ? (
          <p className="mt-2 text-sm text-muted">
            Shared combat S&amp;C / mobility blocks publish here when ready. This Core
            week stays labeled DEMO and is not a 1:1 assigned fight camp.
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

      <details className="rounded-2xl border border-line bg-card p-5">
        <summary className="cursor-pointer font-semibold">This Core week</summary>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.values(week).map((day) => (
            <li key={day.weekday} className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0">
              <span className="font-medium">{day.weekday}</span>
              <span className="text-right text-muted">
                {day.active
                  ? day.sessions.map((session) => session.label).join(" + ")
                  : day.summary}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-sm">
        <Link href="/training/calendar" className="text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        {" · "}
        <Link href="/training/history" className="text-accent underline-offset-4 hover:underline">
          Workout history ({sessionCount})
        </Link>
      </p>
    </main>
  );
}
