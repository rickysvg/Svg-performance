import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser } from "@/lib/profile";
import { timeZoneForUser } from "@/lib/profile";
import { checkInGaps, listMobilityCheckIns } from "@/lib/mobility-store";
import { lengthToCm, lengthUnitForLoad } from "@/lib/length-units";
import { splitProgressCm } from "@/lib/mobility";
import { dayKey as zonedDayKey } from "@/lib/timezone";
import { CheckInForm } from "@/components/mobility/CheckInForm";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export default async function MobilityCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const [pro, trial, profile, rows] = await Promise.all([
    canUseFeature(user.id, "mobility_pro"),
    getTrialState(user.id),
    getProfileForUser(user.id),
    listMobilityCheckIns(user.id),
  ]);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const unit = lengthUnitForLoad(profile?.preferredUnits ?? "lb");
  const latest = rows[rows.length - 1];
  const gaps = latest ? checkInGaps(latest) : null;
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const averageSplit = (row: NonNullable<typeof latest> | undefined) => {
    if (!row || row.frontSplitLeft == null || row.frontSplitRight == null) return null;
    return (
      (lengthToCm(row.frontSplitLeft, row.lengthUnit) + lengthToCm(row.frontSplitRight, row.lengthUnit)) /
      2
    );
  };
  const frontDelta = splitProgressCm(averageSplit(previous ?? undefined), averageSplit(latest));
  const maxSit = Math.max(
    1,
    ...rows.map((row) =>
      row.sitReachValue == null ? 0 : lengthToCm(row.sitReachValue, row.sitReachUnit || row.lengthUnit),
    ),
  );

  return (
    <main className="space-y-6">
      <Link href="/mobility" className="text-sm font-semibold text-accent">
        Mobility
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Every 2 weeks</p>
        <h1 className="mt-1 text-3xl">Check-in</h1>
        <p className="mt-2 text-sm text-muted">
          A left/right gap over 10% gets a flag. Progress is the change, not pass or fail.
        </p>
      </div>
      {query.saved ? (
        <p className="rounded-full bg-accent px-4 py-2 text-center text-sm text-black">Check-in saved.</p>
      ) : null}
      {gaps && (gaps.frontSplit || gaps.hip || gaps.ankle || gaps.kickFront || gaps.kickSide) ? (
        <p className="rounded-2xl bg-black px-4 py-3 text-sm text-white">
          Left/right gap over 10% on{" "}
          {[
            gaps.frontSplit ? "front split" : "",
            gaps.hip ? "90/90" : "",
            gaps.ankle ? "ankle" : "",
            gaps.kickFront ? "front kick" : "",
            gaps.kickSide ? "side kick" : "",
          ]
            .filter(Boolean)
            .join(", ")}
          . Keep the easy side honest. Do not force the tight side.
        </p>
      ) : null}
      {pro ? (
        <section className="space-y-3">
          <h2 className="text-lg">Trend</h2>
          {frontDelta != null ? (
            <p className="text-sm">
              Average front-split distance moved {frontDelta > 0 ? "closer to the floor" : "the other way"} by{" "}
              {Math.abs(frontDelta).toFixed(1)} cm since the previous check-in.
            </p>
          ) : (
            <p className="text-sm text-muted">Two check-ins will show whether the split is moving.</p>
          )}
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No check-ins yet.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const sit =
                  row.sitReachValue == null
                    ? 0
                    : lengthToCm(row.sitReachValue, row.sitReachUnit || row.lengthUnit);
                return (
                  <li key={row.id} className="rounded-2xl border border-line px-3 py-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{zonedDayKey(row.performedAt, timeZone)}</span>
                      <span className="text-muted">
                        reach {row.sitReachLevel || (row.sitReachValue != null ? `${row.sitReachValue} ${row.sitReachUnit}` : "—")}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-line">
                      <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(8, (sit / maxSit) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <UpgradePreview
          kind="mobility"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/mobility/check-in"
        />
      )}
      <CheckInForm unit={unit} />
    </main>
  );
}
