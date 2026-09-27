import Link from "next/link";
import { BIKE_ZONE_CREDIT } from "@/lib/bike-sessions";
import { WEEKDAYS } from "@/lib/constants";
import type { DayPlan } from "@/lib/week-plan";
import { trainDayExtra } from "@/lib/train-extras";
import { DELOAD_LABEL } from "@/lib/training-cycle";

export function TrainWeekBoard({
  week,
  weekIndex,
  emphasis,
}: {
  week: Record<string, DayPlan>;
  weekIndex: number;
  emphasis?: string | null;
}) {
  const deload = WEEKDAYS.some((day) => week[day]?.deload);
  const testing = WEEKDAYS.some((day) => week[day]?.testingWeek);
  return (
    <section className="space-y-3" data-train-week>
      <div>
        <h2 className="text-lg">This week</h2>
        <p className="mt-1 text-sm text-muted">
          Warm-up opens every training day. Mon/Wed get a plyo block. Bike tags: Aerobic Base, Threshold, Sprint.
        </p>
      </div>
      {deload ? (
        <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
      ) : null}
      {testing ? (
        <Link href="/training/testing" className="block rounded-2xl bg-black px-4 py-3 text-sm text-white">
          Testing Week is on. Log the jumps, the strength estimate, and the bike tests.
        </Link>
      ) : null}
      <ol className="space-y-2">
        {WEEKDAYS.map((weekday) => {
          const day = week[weekday];
          if (!day) return null;
          const extra = trainDayExtra({
            weekday,
            active: day.active,
            sessions: day.sessions,
            weekIndex,
            emphasis,
            deload: day.deload,
          });
          return (
            <li key={weekday} className="rounded-2xl border border-line bg-card px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-sm uppercase tracking-wide">{weekday.slice(0, 3)}</p>
                <p className="text-sm text-muted">{day.active ? day.summary : day.summary}</p>
              </div>
              {extra.warmup ? (
                <p className="mt-1 text-sm">Dynamic warm-up · 3–4 min</p>
              ) : null}
              {extra.plyoTitle ? (
                <p className="text-sm">
                  {extra.plyoTitle} · 8–10 min
                  {extra.plyoFirst ? ` · ${extra.plyoFirst} first` : ""}
                </p>
              ) : null}
              {extra.bikeLabel ? (
                <p className="text-sm">
                  <span className="font-semibold">{extra.bikeLabel}</span>
                  {extra.bikeGuide ? ` — ${extra.bikeGuide}` : ""}
                </p>
              ) : null}
              {extra.neck ? (
                <p className="text-sm">Neck isometrics on Friday GPP · gentle ramp</p>
              ) : null}
              {extra.deload ? <p className="text-sm font-medium">Deload · fewer sets</p> : null}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">
        Bike zones inspired by{" "}
        <a href={BIKE_ZONE_CREDIT.url} className="underline" target="_blank" rel="noreferrer">
          {BIKE_ZONE_CREDIT.coach}
        </a>
        . SVG’s labels, not his program.
      </p>
    </section>
  );
}
