import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { listTestingResults } from "@/lib/mobility-store";
import { lengthToCm, lengthUnitForLoad } from "@/lib/length-units";
import { isTestingWeek, TESTING_EVERY_WEEKS, TESTING_LABEL } from "@/lib/training-cycle";
import {
  TESTING_CREDITS,
  formatDelta,
  strengthToLb,
  testingDelta,
} from "@/lib/testing-week";
import { TestingForm } from "@/components/training/TestingForm";
import { dayKey as zonedDayKey } from "@/lib/timezone";
import type { LoadUnit } from "@/lib/units";

export default async function TestingWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const results = await listTestingResults(user.id);
  const units: LoadUnit = "lb";
  const lengthUnit = lengthUnitForLoad(units);
  const distanceUnit = "mi";
  const testing = isTestingWeek(new Date(), timeZone);
  const latest = results[0];
  const previous = results[1];
  const jumpDelta =
    latest && previous
      ? testingDelta(
          latest.broadJumpValue == null
            ? null
            : lengthToCm(latest.broadJumpValue, latest.broadJumpUnit),
          previous.broadJumpValue == null
            ? null
            : lengthToCm(previous.broadJumpValue, previous.broadJumpUnit),
        )
      : null;
  const strengthDelta =
    latest && previous
      ? testingDelta(
          latest.strengthEstimate == null
            ? null
            : strengthToLb(latest.strengthEstimate, latest.strengthUnit === "kg" ? "kg" : "lb"),
          previous.strengthEstimate == null
            ? null
            : strengthToLb(previous.strengthEstimate, previous.strengthUnit === "kg" ? "kg" : "lb"),
        )
      : null;

  return (
    <main className="space-y-6">
      <Link href="/training" className="text-sm font-semibold text-accent">
        Train
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">
          Every {TESTING_EVERY_WEEKS} weeks
        </p>
        <h1 className="mt-1 text-3xl">Testing Week</h1>
        <p className="mt-2 text-sm text-muted">{TESTING_LABEL}</p>
        <p className="mt-2 text-sm">{testing ? "This week is a testing week." : "Not a testing week on your calendar. You can still log a test."}</p>
      </div>
      {query.saved ? (
        <p className="rounded-full bg-accent px-4 py-2 text-center text-sm text-black">Test saved.</p>
      ) : null}
      {(jumpDelta != null || strengthDelta != null) && (
        <section className="rounded-2xl bg-black px-4 py-4 text-white">
          <h2 className="text-lg text-white">Since last test</h2>
          <p className="mt-2 text-sm">Broad jump {formatDelta(jumpDelta, "cm")}</p>
          <p className="text-sm">Strength estimate {formatDelta(strengthDelta, "lb")}</p>
        </section>
      )}
      <TestingForm loadUnit={units} lengthUnit={lengthUnit} distanceUnit={distanceUnit} />
      <p className="text-sm">
        <Link href="/mobility/check-in" className="font-semibold text-accent">
          Add the mobility check-in
        </Link>
      </p>
      {results.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {results.map((row) => (
            <li key={row.id} className="rounded-2xl border border-line px-3 py-2">
              <p className="font-medium">{zonedDayKey(row.performedAt, timeZone)}</p>
              <p className="text-muted">
                Jump {row.broadJumpValue ?? "—"} {row.broadJumpUnit} · {row.strengthExercise || "Strength"}{" "}
                {row.strengthEstimate ?? "—"} {row.strengthUnit} est. · Sprint {row.bikeSprintValue ?? "—"}{" "}
                {row.bikeSprintUnit} · 5 min {row.bikeFiveMinValue ?? "—"} {row.bikeFiveMinUnit}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="space-y-1 text-xs text-muted">
        {TESTING_CREDITS.map((credit) => (
          <li key={credit.url}>
            Inspired by {credit.coach} — {credit.idea}.{" "}
            <a href={credit.url} className="underline" target="_blank" rel="noreferrer">
              Their page
            </a>
            .
          </li>
        ))}
      </ul>
    </main>
  );
}
