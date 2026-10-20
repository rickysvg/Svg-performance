import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { dayKey, memberDayTimeZone, readTimeZoneCookie, zonedParts } from "@/lib/timezone";
import { getSparringLog, sparringDateError } from "@/lib/outside-log";
import { SparringLogForm } from "@/components/training/SparringLogForm";
import { resolveAiCoach } from "@/lib/coaches";

function weekdayForDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return "";
  const instant = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return zonedParts(instant, "UTC").weekday;
}

export default async function SparringPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const profile = await getProfileForUser(user.id);
  const timeZone = memberDayTimeZone(profile?.timeZone ?? null, await readTimeZoneCookie());
  const today = dayKey(new Date(), timeZone);
  const requested = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  const future = sparringDateError(requested, new Date(), timeZone);
  const dateKey = future ? today : requested;
  const saved = await getSparringLog(user.id, dateKey);
  const coach = resolveAiCoach(profile?.aiCoachId);

  return (
    <main className="space-y-4" data-sparring-page>
      <div>
        <p className="font-display text-xs uppercase tracking-wide text-accent">Sparring</p>
        <h1 className="mt-1 text-2xl">Log sparring</h1>
        <p className="mt-2 text-sm text-muted">
          Any day. Session rating, body rating, sore spots, and notes. Future dates stay closed.
        </p>
      </div>
      <form method="get" className="flex items-end gap-2">
        <label className="block min-w-0 flex-1 text-sm">
          Day
          <input
            type="date"
            name="day"
            max={today}
            defaultValue={dateKey}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <button type="submit" className="touch-target rounded-full border border-line px-4 text-sm font-semibold">
          Show
        </button>
      </form>
      {future ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm" data-sparring-future>
          {future}
        </p>
      ) : null}
      <SparringLogForm
        key={dateKey}
        dateKey={dateKey}
        weekday={weekdayForDateKey(dateKey)}
        saved={saved}
        coachName={coach.name}
        coachImage={coach.circle}
        anyDay
      />
      <Link href="/home" className="text-sm text-muted">
        Home
      </Link>
    </main>
  );
}
