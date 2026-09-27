import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { dayKey } from "@/lib/timezone";
import {
  CAMP_NO_CUT_LINE,
  FIGHT_WEEK_WEIGHT_GUIDANCE,
  getFightCampRow,
  isFightDiscipline,
  isTemplateWeeks,
  buildCampSnapshot,
} from "@/lib/fight-camp";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { ProPill } from "@/components/pro/ProPill";
import { PageBackLink } from "@/components/fight-camp/PageBackLink";
import { FightCampForm } from "@/components/fight-camp/FightCampForm";
import { CancelCampForm } from "@/components/fight-camp/CancelCampForm";

export default async function FightCampPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const allowed = await canUseFeature(user.id, "fight_camp");
  if (!allowed) {
    const trial = await getTrialState(user.id);
    return (
      <main className="space-y-6">
        <div className="flex items-center gap-3">
          <PageBackLink />
          <h1 className="text-2xl">Fight camp</h1>
          <ProPill />
        </div>
        <UpgradePreview
          kind="fight_camp"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/fight-camp"
        />
      </main>
    );
  }

  const params = await searchParams;
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const todayKey = dayKey(new Date(), timeZone);
  const row = await getFightCampRow(user.id);
  const campRow = row && row.status === "active" && isTemplateWeeks(row.templateWeeks) ? row : null;
  const editing = params.edit === "1" || !campRow;

  if (!campRow || editing) {
    const discipline = campRow && isFightDiscipline(campRow.discipline) ? campRow.discipline : "";
    return (
      <main className="space-y-6">
        <div className="flex items-center gap-3">
          <PageBackLink />
          <h1 className="text-2xl">Fight camp</h1>
          <ProPill />
        </div>
        <p className="text-sm text-muted">
          Enter the fight date. We build a 12, 8, or 6 week camp: base, build, peak / sharpen,
          then a fight-week taper. {CAMP_NO_CUT_LINE} Fight week stays general, and weight stays
          with your coach or a doctor.
        </p>
        <FightCampForm
          todayKey={todayKey}
          editing={Boolean(campRow)}
          fightDate={campRow ? campRow.fightDateKey : ""}
          weightClass={campRow ? campRow.weightClass : ""}
          discipline={discipline}
        />
        {campRow ? (
          <p className="text-sm">
            <Link href="/fight-camp" className="font-semibold underline">
              Back to this camp
            </Link>
          </p>
        ) : null}
      </main>
    );
  }

  if (!isTemplateWeeks(campRow.templateWeeks)) {
    return null;
  }
  const discipline = isFightDiscipline(campRow.discipline) ? campRow.discipline : "";
  const camp = buildCampSnapshot({
    fightDateKey: campRow.fightDateKey,
    templateWeeks: campRow.templateWeeks,
    todayKey,
    discipline,
    weightClass: campRow.weightClass,
  });
  const meta = [camp.fightDateLabel, camp.disciplineLabel, camp.weightClass].filter(Boolean).join(" · ");

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <PageBackLink />
        <h1 className="text-2xl">Fight camp</h1>
        <ProPill />
      </div>

      <section className="rounded-[1.75rem] bg-black px-5 py-6 text-white">
        {camp.phase === "complete" ? (
          <p className="font-display text-4xl uppercase leading-none tracking-wide text-highlighter">
            Fight day has passed
          </p>
        ) : camp.daysToFight === 0 ? (
          <p className="font-display text-5xl uppercase leading-none tracking-wide text-highlighter">Fight day</p>
        ) : (
          <>
            <p className="font-display text-7xl leading-none text-highlighter">{camp.daysToFight}</p>
            <p className="mt-1 font-display text-2xl uppercase tracking-wide">
              {camp.daysToFight === 1 ? "Day to fight" : "Days to fight"}
            </p>
          </>
        )}
        <p className="mt-3 text-sm text-white/80">{meta}</p>
        {camp.phase === "pre-camp" ? (
          <p className="mt-2 text-sm">
            {camp.templateWeeks}-week camp starts in {camp.daysUntilCamp} day
            {camp.daysUntilCamp === 1 ? "" : "s"}.
          </p>
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-line bg-white px-4 py-4">
        <p className="text-xs uppercase tracking-[0.08em] text-muted">
          {camp.weekNumber
            ? `Week ${camp.weekNumber} of ${camp.templateWeeks}`
            : `${camp.templateWeeks}-week camp`}
        </p>
        <h2 className="mt-1 text-2xl">{camp.phaseLabel}</h2>
        <p className="mt-2 text-sm text-muted">{camp.todayFocus}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">This week</h2>
        <div className="grid gap-3">
          <GuidanceCard kicker="Training" body={camp.guidance.training} />
          <GuidanceCard kicker="Skill" body={camp.guidance.skill} />
          <GuidanceCard kicker="General" body={camp.guidance.general} />
        </div>
      </section>

      {camp.phase === "taper" ? (
        <section className="rounded-[1.5rem] border border-black bg-white px-4 py-4 text-sm">
          <p className="font-display text-sm uppercase tracking-wide">Safety first</p>
          <p className="mt-2 text-muted">{FIGHT_WEEK_WEIGHT_GUIDANCE}</p>
        </section>
      ) : (
        <p className="text-sm text-muted">{CAMP_NO_CUT_LINE}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg">Camp weeks</h2>
        <ol className="grid grid-cols-3 gap-2">
          {camp.weeks.map((week) => (
            <li
              key={week.weekNumber}
              className={
                week.state === "current"
                  ? "rounded-2xl bg-accent px-3 py-3 text-black"
                  : week.state === "done"
                    ? "rounded-2xl bg-black px-3 py-3 text-white"
                    : "rounded-2xl border border-line bg-card px-3 py-3"
              }
            >
              <p className="font-display text-lg uppercase leading-none tracking-wide">
                W{week.weekNumber}
              </p>
              <p className="mt-1 text-xs">{week.phaseLabel}</p>
            </li>
          ))}
        </ol>
        <ul className="space-y-2">
          {camp.weeks.map((week) => (
            <li key={`${week.weekNumber}-detail`} className="rounded-2xl border border-line bg-white px-4 py-3">
              <p className="text-sm font-semibold">
                {week.title} · {week.phaseLabel}
                {week.state === "current" ? " · this week" : ""}
              </p>
              <p className="mt-1 text-sm text-muted">{week.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-3">
        <Link
          href="/fight-camp?edit=1"
          className="touch-target flex w-full items-center justify-center rounded-full bg-black text-white"
        >
          Edit camp
        </Link>
        <CancelCampForm />
      </div>
    </main>
  );
}

function GuidanceCard({ kicker, body }: { kicker: string; body: string }) {
  return (
    <article className="rounded-[1.5rem] border border-line bg-white px-4 py-4">
      <p className="inline-flex rounded-full bg-accent px-2 py-1 font-display text-xs uppercase tracking-wide text-black">
        {kicker}
      </p>
      <p className="mt-3 text-sm">{body}</p>
    </article>
  );
}
