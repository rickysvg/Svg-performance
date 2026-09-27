import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { FLEX_WEEKS, flexibilityWeekNumber, flexWeekCopy } from "@/lib/mobility";
import { latestMobilityAnchor } from "@/lib/mobility-store";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export default async function MobilityProgressionPage() {
  const user = await requireUser();
  const [pro, trial, profile, anchor] = await Promise.all([
    canUseFeature(user.id, "mobility_pro"),
    getTrialState(user.id),
    getProfileForUser(user.id),
    latestMobilityAnchor(user.id),
  ]);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const now = new Date();
  const week = flexibilityWeekNumber(anchor ?? now, now, timeZone);
  const current = flexWeekCopy(week);

  return (
    <main className="space-y-5">
      <Link href="/mobility" className="text-sm font-semibold text-accent">
        Mobility
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">6-week cycle</p>
        <h1 className="mt-1 text-3xl">Flexibility</h1>
        <p className="mt-2 text-sm text-muted">
          Goals: front split, side split, and a controlled head-height kick. Repeat the cycle. Full splits often take longer than six weeks.
        </p>
      </div>
      {pro ? (
        <>
          <section className="rounded-[1.5rem] bg-black px-5 py-5 text-white">
            <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">
              Week {week} of 6
            </p>
            <h2 className="mt-2 text-3xl text-white">{current.name}</h2>
            <p className="mt-2 text-sm text-white/80">{current.detail}</p>
          </section>
          <ol className="space-y-2">
            {FLEX_WEEKS.map((row) => (
              <li
                key={row.week}
                className={`rounded-2xl border px-4 py-3 ${
                  row.week === week ? "border-black bg-accent" : "border-line bg-card"
                }`}
              >
                <p className="font-display text-sm uppercase tracking-wide">
                  Week {row.week} · {row.name}
                </p>
                <p className="mt-1 text-sm">{row.detail}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            Thomas Kurz has written that usable dynamic flexibility can take about 8–10 weeks. This cycle is SVG’s schedule, not his program.
          </p>
        </>
      ) : (
        <UpgradePreview
          kind="mobility"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/mobility/progression"
        />
      )}
    </main>
  );
}
